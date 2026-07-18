"""Extração de conhecimento pedagógico da rede AlphaZero (F2 dos percursos).

Produz dois artefactos a partir do campeão `runs/<run-id>/best.pt`:

1. `openings.json` — mapa de aberturas: priors da policy e visitas de MCTS
   na posição inicial e após cada uma das melhores primeiras jogadas.
2. `puzzle_candidates.json` (+ `puzzle_candidates.txt` legível) — posições
   dos jogos de self-play onde a rede, verificada por MCTS fresco a
   `--sims` simulações, concentra as visitas numa única jogada com uma
   queda de valor clara para a segunda melhor: candidatos a puzzles
   «encontra a jogada» para curadoria humana.

Uso (no container GPU):
    python -m atari_go.extract_lessons --run-id az-v1 \
        --iters 27,28,29 --sims 800 --max-candidates 30
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch

from . import mcts, rules
from .net import AtariGoNet, encode_features

RUNS_DIR = Path(__file__).resolve().parent.parent / "runs"


class Evaluator:
    def __init__(self, run_id: str) -> None:
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        ckpt = torch.load(RUNS_DIR / run_id / "best.pt", map_location="cpu", weights_only=True)
        net = AtariGoNet()
        net.load_state_dict(ckpt["model"])
        net.to(self.device).eval()
        self.net = net

    def evaluate(self, board: np.ndarray, to_play: int, last_move: int) -> tuple[np.ndarray, float]:
        x = torch.from_numpy(encode_features(board, to_play, None if last_move < 0 else last_move))
        x = x.unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits, value = self.net(x)
        policy = torch.softmax(logits.float(), dim=-1)[0].cpu().numpy()
        return policy, float(value.float().item())


def sync_search(
    ev: Evaluator, board: np.ndarray, to_play: int, last_move: int, sims: int
) -> mcts.Node:
    """MCTS síncrono sem ruído (verificação determinística)."""
    policy, _ = ev.evaluate(board, to_play, last_move)
    root = mcts.Node(board.copy(), to_play, last_move)
    root.expand(policy)
    for _ in range(sims):
        node = root
        path: list[tuple[mcts.Node, int]] = []
        while True:
            edge = mcts._select_edge(node, mcts.C_PUCT)
            path.append((node, edge))
            child = node.children.get(edge)
            if child is None:
                child = mcts._make_child(node, edge)
                if child.terminal is not None:
                    value = child.terminal
                else:
                    policy, value = ev.evaluate(child.board, child.to_play, child.last_move)
                    child.expand(policy)
                break
            if child.terminal is not None:
                value = child.terminal
                break
            node = child
        for parent, edge in reversed(path):
            value = -value
            parent.N[edge] += 1
            parent.W[edge] += value
    return root


def root_stats(root: mcts.Node) -> list[dict]:
    """Jogadas da raiz ordenadas por visitas, com Q na perspetiva de quem joga."""
    stats = []
    for i, cell in enumerate(root.legal):
        n = int(root.N[i])
        q = float(root.W[i] / root.N[i]) if n > 0 else None
        stats.append({"move": int(cell), "visits": n, "q": q, "prior": float(root.P[i])})
    stats.sort(key=lambda s: s["visits"], reverse=True)
    return stats


def board_rows(board: np.ndarray, to_play: int) -> list[str]:
    """Linhas 9×9 com X = quem joga, O = adversário (convenção dos diagramas)."""
    symbols = {0: ".", to_play: "X", rules.opponent(to_play): "O"}
    return [
        "".join(symbols[int(board[r * 9 + c])] for c in range(9))
        for r in range(9)
    ]


def classify(board: np.ndarray, to_play: int, move: int) -> str:
    # rules.play não muta o input; _captures_after_placement muta e é privada.
    if rules.play(board, to_play, move)[1] == rules.WIN:
        return "captura-imediata"
    opp = rules.opponent(to_play)
    for opp_move in rules.legal_moves(board, opp):
        if rules.play(board, opp, int(opp_move))[1] == rules.WIN:
            return "defesa-de-captura"
    return "estrategica"


def extract_openings(ev: Evaluator, sims: int) -> dict:
    board = rules.new_board()
    policy, value = ev.evaluate(board, 1, -1)
    root = sync_search(ev, board, 1, -1, sims)
    stats = root_stats(root)
    top = stats[:8]
    replies = []
    for entry in top[:4]:
        nxt, status = rules.play(board.copy(), 1, entry["move"])
        if status != rules.ONGOING:
            continue
        reply_root = sync_search(ev, nxt, 2, entry["move"], sims)
        replies.append({
            "after_move": entry["move"],
            "top_replies": root_stats(reply_root)[:5],
        })
    return {
        "empty_board": {
            "value_black": value,
            "policy_prior": [round(float(p), 5) for p in policy],
            "top_moves": top,
        },
        "replies": replies,
    }


def extract_candidates(
    ev: Evaluator,
    run_id: str,
    iters: list[int],
    sims: int,
    max_candidates: int,
    min_share: float,
    min_gap: float,
) -> list[dict]:
    candidates: list[dict] = []
    seen: set[bytes] = set()
    for it in iters:
        path = RUNS_DIR / run_id / "selfplay" / f"iter_{it:03d}.npz"
        data = np.load(path)
        boards, to_play, last_move, pi = (
            data["boards"], data["to_play"], data["last_move"], data["pi"],
        )
        stones = (boards != 0).sum(axis=1)
        # pré-filtro barato: meio-jogo e busca de treino já concentrada
        mask = (stones >= 6) & (stones <= 30) & (pi.max(axis=1) >= 0.5)
        indices = np.flatnonzero(mask)
        print(f"iter {it}: {indices.size} pré-candidatos de {boards.shape[0]} posições")
        for idx in indices:
            if len(candidates) >= max_candidates:
                return candidates
            board = boards[idx].astype(np.int8)
            key = board.tobytes() + bytes([int(to_play[idx])])
            if key in seen:
                continue
            seen.add(key)
            root = sync_search(ev, board, int(to_play[idx]), int(last_move[idx]), sims)
            stats = [s for s in root_stats(root) if s["visits"] > 0]
            if len(stats) < 2 or stats[0]["q"] is None or stats[1]["q"] is None:
                continue
            share = stats[0]["visits"] / max(1, sum(s["visits"] for s in stats))
            gap = stats[0]["q"] - stats[1]["q"]
            if share < min_share or gap < min_gap:
                continue
            best = stats[0]["move"]
            candidates.append({
                "source": {"iter": int(it), "index": int(idx)},
                "to_play": int(to_play[idx]),
                "last_move": int(last_move[idx]),
                "stones": int(stones[idx]),
                "rows": board_rows(board, int(to_play[idx])),
                "best_move": best,
                "best_rc": [best // 9, best % 9],
                "share": round(share, 3),
                "q_gap": round(gap, 3),
                "tactic": classify(board, int(to_play[idx]), best),
                "top_moves": stats[:4],
            })
    return candidates


def render_preview(candidates: list[dict]) -> str:
    lines = []
    for i, c in enumerate(candidates):
        lines.append(
            f"#{i} iter={c['source']['iter']} idx={c['source']['index']} "
            f"toPlay={c['to_play']} stones={c['stones']} share={c['share']} "
            f"gap={c['q_gap']} tactic={c['tactic']} best={c['best_move']} (r{c['best_rc'][0]} c{c['best_rc'][1]})"
        )
        marked = [list(row) for row in c["rows"]]
        r, col = c["best_rc"]
        marked[r][col] = "!"
        lines.extend("  " + "".join(row) for row in marked)
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default="az-v1")
    parser.add_argument("--iters", default="27,28,29")
    parser.add_argument("--sims", type=int, default=800)
    parser.add_argument("--max-candidates", type=int, default=30)
    parser.add_argument("--min-share", type=float, default=0.6)
    parser.add_argument("--min-gap", type=float, default=0.4)
    args = parser.parse_args()

    ev = Evaluator(args.run_id)
    print(f"modelo {args.run_id}/best.pt em {ev.device}")
    out_dir = RUNS_DIR / args.run_id / "lessons" / time.strftime("%Y-%m-%dT%H-%M-%S")
    out_dir.mkdir(parents=True, exist_ok=True)

    started = time.monotonic()
    openings = extract_openings(ev, args.sims)
    (out_dir / "openings.json").write_text(json.dumps(openings, indent=2))
    print(f"aberturas em {time.monotonic() - started:.1f}s; "
          f"top: {[(s['move'], s['visits']) for s in openings['empty_board']['top_moves'][:5]]}")

    iters = [int(x) for x in args.iters.split(",")]
    candidates = extract_candidates(
        ev, args.run_id, iters, args.sims, args.max_candidates, args.min_share, args.min_gap,
    )
    (out_dir / "puzzle_candidates.json").write_text(json.dumps(candidates, indent=2))
    (out_dir / "puzzle_candidates.txt").write_text(render_preview(candidates))
    print(f"{len(candidates)} candidatos em {time.monotonic() - started:.1f}s → {out_dir}")


if __name__ == "__main__":
    main()
