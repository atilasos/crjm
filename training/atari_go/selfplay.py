"""Self-play e gating com inferência em batch partilhado entre jogos.

- Self-play: G jogos concorrentes por worker (default 128), 160 sims/lance,
  Dirichlet na raiz, temperatura 1.0 nos primeiros 8 lances e argmax depois.
- Gating: dois modelos, metade dos jogos com cada cor, argmax sem ruído.
- Vários workers (processos) para usar os núcleos de CPU; cada worker tem a
  sua cópia do modelo na GPU e faz o batching entre os SEUS jogos concorrentes.
- Empate -> z = 0. Sem resign.
"""

from __future__ import annotations

import multiprocessing as mp
import time
from dataclasses import dataclass

import numpy as np
import torch

from atari_go import mcts, rules
from atari_go.net import AtariGoNet, encode_features

TEMP_MOVES = 8  # temperatura 1.0 nos primeiros 8 lances, depois argmax


@dataclass
class GameSamples:
    boards: np.ndarray      # (n, 81) int8 — antes da jogada
    to_play: np.ndarray     # (n,) int8
    last_move: np.ndarray   # (n,) int16 (-1 sem última jogada)
    legal_mask: np.ndarray  # (n, 81) bool
    pi: np.ndarray          # (n, 81) float32 — alvo de policy (visitas normalizadas)
    z: np.ndarray           # (n,) float32 — resultado na perspetiva de to_play
    plies: int
    winner: int             # 0 empate, 1 pretas, 2 brancas


class NetEvaluator:
    """Avalia batches de posições com um ou mais modelos (por net_key)."""

    def __init__(self, nets: dict[str, AtariGoNet], device: str, fp16: bool = True):
        self.nets = nets
        self.device = device
        self.fp16 = fp16 and device.startswith("cuda")
        for net in nets.values():
            net.to(device).eval()

    def __call__(self, net_key: str, reqs: list[tuple[np.ndarray, int, int]]):
        feats = np.stack([encode_features(b, tp, lm) for b, tp, lm in reqs])
        x = torch.from_numpy(feats).to(self.device, non_blocking=True)
        with torch.no_grad():
            if self.fp16:
                with torch.autocast("cuda", dtype=torch.float16):
                    logits, values = self.nets[net_key](x)
            else:
                logits, values = self.nets[net_key](x)
            policies = torch.softmax(logits.float(), dim=-1)
        return policies.cpu().numpy(), values.float().cpu().numpy()


def _pick_move(visits: np.ndarray, ply: int, rng: np.random.Generator, temp_moves: int) -> int:
    if ply < temp_moves:
        pi = visits / visits.sum()
        return int(rng.choice(rules.NUM_CELLS, p=pi))
    best = np.flatnonzero(visits == visits.max())
    return int(rng.choice(best))


def selfplay_game(sims: int, rng: np.random.Generator, net_key: str = "best",
                  temp_moves: int = TEMP_MOVES):
    """Gerador de um jogo de self-play; devolve GameSamples."""
    board = rules.new_board()
    to_play = rules.BLACK
    last_move = -1
    hist: list[tuple[np.ndarray, int, int, np.ndarray, np.ndarray]] = []
    winner = 0
    for ply in range(rules.NUM_CELLS):
        visits, legal = yield from mcts.mcts_decide(
            board, to_play, last_move, sims, net_key, rng,
            dirichlet=(mcts.DIRICHLET_ALPHA, mcts.DIRICHLET_EPS),
        )
        legal_mask = np.zeros(rules.NUM_CELLS, dtype=bool)
        legal_mask[legal] = True
        pi = (visits / visits.sum()).astype(np.float32)
        hist.append((board.copy(), to_play, last_move, legal_mask, pi))
        move = _pick_move(visits, ply, rng, temp_moves)
        board, status = rules.play(board, to_play, move)
        last_move = move
        if status == rules.WIN:
            winner = to_play
            break
        if status == rules.DRAW:
            winner = 0
            break
        to_play = rules.opponent(to_play)

    n = len(hist)
    z = np.zeros(n, dtype=np.float32)
    for i, (_, tp, _, _, _) in enumerate(hist):
        if winner != 0:
            z[i] = 1.0 if tp == winner else -1.0
    return GameSamples(
        boards=np.stack([h[0] for h in hist]),
        to_play=np.array([h[1] for h in hist], dtype=np.int8),
        last_move=np.array([h[2] for h in hist], dtype=np.int16),
        legal_mask=np.stack([h[3] for h in hist]),
        pi=np.stack([h[4] for h in hist]),
        z=z,
        plies=n,
        winner=winner,
    )


def gate_game(black_key: str, white_key: str, sims: int, rng: np.random.Generator):
    """Gerador de um jogo de gating (argmax, sem Dirichlet). Devolve o vencedor (0/1/2)."""
    board = rules.new_board()
    to_play = rules.BLACK
    last_move = -1
    for _ in range(rules.NUM_CELLS):
        key = black_key if to_play == rules.BLACK else white_key
        visits, _ = yield from mcts.mcts_decide(
            board, to_play, last_move, sims, key, rng, dirichlet=None,
        )
        best = np.flatnonzero(visits == visits.max())
        move = int(rng.choice(best))
        board, status = rules.play(board, to_play, move)
        last_move = move
        if status == rules.WIN:
            return to_play
        if status == rules.DRAW:
            return 0
        to_play = rules.opponent(to_play)
    return 0


def concat_samples(games: list[GameSamples]) -> dict[str, np.ndarray]:
    return {
        "boards": np.concatenate([g.boards for g in games]),
        "to_play": np.concatenate([g.to_play for g in games]),
        "last_move": np.concatenate([g.last_move for g in games]),
        "legal_mask": np.concatenate([g.legal_mask for g in games]),
        "pi": np.concatenate([g.pi for g in games]),
        "z": np.concatenate([g.z for g in games]),
    }


# ---------------------------------------------------------------------------
# Workers (multiprocessing spawn; cada worker tem a sua cópia do modelo na GPU)
# ---------------------------------------------------------------------------

def _selfplay_worker(state_dict, games: int, sims: int, concurrency: int,
                     seed: int, device: str, queue) -> None:
    torch.set_num_threads(1)
    net = AtariGoNet()
    net.load_state_dict(state_dict)
    evaluator = NetEvaluator({"best": net}, device)
    base_rng = np.random.default_rng(seed)

    def make_game(gid: int):
        rng = np.random.default_rng(base_rng.integers(0, 2**63))
        return selfplay_game(sims, rng)

    results = mcts.drive(make_game, games, concurrency, evaluator)
    queue.put(concat_samples(results) | {
        "plies": np.array([g.plies for g in results], dtype=np.int32),
        "winners": np.array([g.winner for g in results], dtype=np.int8),
    })


def _gate_worker(cand_sd, best_sd, games_cand_black: int, games_best_black: int,
                 sims: int, concurrency: int, seed: int, device: str, queue) -> None:
    torch.set_num_threads(1)
    cand, best = AtariGoNet(), AtariGoNet()
    cand.load_state_dict(cand_sd)
    best.load_state_dict(best_sd)
    evaluator = NetEvaluator({"cand": cand, "best": best}, device)
    base_rng = np.random.default_rng(seed)
    total = games_cand_black + games_best_black

    def make_game(gid: int):
        rng = np.random.default_rng(base_rng.integers(0, 2**63))
        if gid < games_cand_black:
            return gate_game("cand", "best", sims, rng)
        return gate_game("best", "cand", sims, rng)

    winners = mcts.drive(make_game, total, concurrency, evaluator)
    cand_wins = draws = 0
    for gid, w in enumerate(winners):
        cand_is_black = gid < games_cand_black
        if w == 0:
            draws += 1
        elif (w == rules.BLACK) == cand_is_black:
            cand_wins += 1
    queue.put({"cand_wins": cand_wins, "draws": draws, "games": total})


def _split(n: int, parts: int) -> list[int]:
    base, rem = divmod(n, parts)
    return [base + (1 if i < rem else 0) for i in range(parts)]


def run_selfplay(net: AtariGoNet, games: int, sims: int, concurrency: int,
                 workers: int, seed: int, device: str) -> tuple[dict[str, np.ndarray], dict]:
    """Corre self-play em `workers` processos; devolve (samples, métricas)."""
    t0 = time.time()
    state_dict = {k: v.cpu() for k, v in net.state_dict().items()}
    ctx = mp.get_context("spawn")
    queue = ctx.Queue()
    procs = []
    for w, g in enumerate(_split(games, workers)):
        if g == 0:
            continue
        p = ctx.Process(target=_selfplay_worker,
                        args=(state_dict, g, sims, min(concurrency, g), seed + 7919 * w,
                              device, queue))
        p.start()
        procs.append(p)
    parts = [queue.get() for _ in procs]
    for p in procs:
        p.join()
    samples = {k: np.concatenate([part[k] for part in parts])
               for k in ("boards", "to_play", "last_move", "legal_mask", "pi", "z")}
    plies = np.concatenate([part["plies"] for part in parts])
    winners = np.concatenate([part["winners"] for part in parts])
    dt = time.time() - t0
    metrics = {
        "games": games,
        "positions": int(samples["z"].shape[0]),
        "seconds": round(dt, 1),
        "games_per_min": round(games / dt * 60.0, 1),
        "mean_plies": round(float(plies.mean()), 2),
        "black_wins": int((winners == rules.BLACK).sum()),
        "white_wins": int((winners == rules.WHITE).sum()),
        "draws": int((winners == 0).sum()),
    }
    return samples, metrics


def run_gating(cand: AtariGoNet, best: AtariGoNet, games: int, sims: int,
               concurrency: int, workers: int, seed: int, device: str) -> dict:
    """Candidato vs melhor; metade dos jogos com cada cor. Score: vitória=1, empate=0.5."""
    t0 = time.time()
    cand_sd = {k: v.cpu() for k, v in cand.state_dict().items()}
    best_sd = {k: v.cpu() for k, v in best.state_dict().items()}
    ctx = mp.get_context("spawn")
    queue = ctx.Queue()
    procs = []
    cb_split = _split(games // 2, workers)
    bb_split = _split(games - games // 2, workers)
    for w, (gcb, gbb) in enumerate(zip(cb_split, bb_split)):
        if gcb + gbb == 0:
            continue
        p = ctx.Process(target=_gate_worker,
                        args=(cand_sd, best_sd, gcb, gbb, sims,
                              min(concurrency, gcb + gbb), seed + 104729 * w, device, queue))
        p.start()
        procs.append(p)
    parts = [queue.get() for _ in procs]
    for p in procs:
        p.join()
    cand_wins = sum(p["cand_wins"] for p in parts)
    draws = sum(p["draws"] for p in parts)
    total = sum(p["games"] for p in parts)
    score = (cand_wins + 0.5 * draws) / total
    return {
        "games": total,
        "cand_wins": cand_wins,
        "best_wins": total - cand_wins - draws,
        "draws": draws,
        "score": round(score, 4),
        "seconds": round(time.time() - t0, 1),
    }
