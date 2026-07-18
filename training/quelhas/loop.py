"""Ciclo AlphaZero: self-play -> treino -> gating, com checkpoints retomáveis.

Uso (a partir de training/):
  python -m quelhas.loop --run-id <id> [--iterations 30] [--games 2000]
      [--sims 160] [--steps 1000] [--concurrency 128] [--workers 12]
      [--batch 512] [--buffer 300000] [--gate-games 100] [--gate-sims 100]
      [--gate-threshold 0.55] [--seed 0] [--device cuda] [--resume]

Estado em training/runs/<run-id>/:
  best.pt               modelo campeão atual
  checkpoints/iter_XXX.pt  candidato treinado em cada iteração
  selfplay/iter_XXX.npz    posições de self-play da iteração
  log.jsonl             eventos (selfplay/train/gate/iteration)
  state.json            próxima iteração (para --resume)
"""

from __future__ import annotations

import argparse
import copy
import json
import time
from pathlib import Path

import numpy as np
import torch

from quelhas import selfplay, train
from quelhas.net import AtariGoNet, num_params

RUNS_DIR = Path(__file__).resolve().parents[1] / "runs"


def log_event(run_dir: Path, event: dict) -> None:
    event = {"time": time.strftime("%Y-%m-%dT%H:%M:%S"), **event}
    with (run_dir / "log.jsonl").open("a") as fh:
        fh.write(json.dumps(event) + "\n")


def save_net(path: Path, net: AtariGoNet, iteration: int) -> None:
    torch.save({"model": net.state_dict(), "iteration": iteration}, path)


def load_net(path: Path) -> tuple[AtariGoNet, int]:
    ckpt = torch.load(path, map_location="cpu", weights_only=True)
    net = AtariGoNet()
    net.load_state_dict(ckpt["model"])
    return net, int(ckpt.get("iteration", -1))


def build_buffer(selfplay_dir: Path, cap: int) -> dict[str, np.ndarray] | None:
    """Concatena os npz mais recentes até `cap` posições (recorta os mais antigos)."""
    files = sorted(selfplay_dir.glob("iter_*.npz"), reverse=True)
    parts: list[dict[str, np.ndarray]] = []
    total = 0
    for f in files:
        with np.load(f) as npz:
            part = {k: npz[k] for k in ("boards", "to_play", "last_move", "legal_mask", "pi", "z")}
        parts.append(part)
        total += part["z"].shape[0]
        if total >= cap:
            break
    if not parts:
        return None
    data = {k: np.concatenate([p[k] for p in parts]) for k in parts[0]}
    if data["z"].shape[0] > cap:  # os ficheiros mais recentes estão primeiro
        data = {k: v[:cap] for k, v in data.items()}
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Ciclo AlphaZero para Atari Go 9x9")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--iterations", type=int, default=30)
    parser.add_argument("--games", type=int, default=2000, help="jogos de self-play por iteração")
    parser.add_argument("--sims", type=int, default=160, help="simulações MCTS por lance")
    parser.add_argument("--steps", type=int, default=1000, help="steps de treino por iteração")
    parser.add_argument("--concurrency", type=int, default=128,
                        help="jogos concorrentes por worker (batch de inferência)")
    parser.add_argument("--workers", type=int, default=12, help="processos de self-play/gating")
    parser.add_argument("--batch", type=int, default=512)
    parser.add_argument("--buffer", type=int, default=300_000)
    parser.add_argument("--gate-games", type=int, default=100)
    parser.add_argument("--gate-sims", type=int, default=100)
    parser.add_argument("--gate-threshold", type=float, default=0.55)
    parser.add_argument("--lr-max", type=float, default=1e-2)
    parser.add_argument("--lr-min", type=float, default=1e-4)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()

    run_dir = RUNS_DIR / args.run_id
    selfplay_dir = run_dir / "selfplay"
    ckpt_dir = run_dir / "checkpoints"
    state_path = run_dir / "state.json"
    best_path = run_dir / "best.pt"

    if state_path.exists() and not args.resume:
        raise SystemExit(
            f"{state_path} já existe; usa --resume para continuar ou outro --run-id"
        )

    selfplay_dir.mkdir(parents=True, exist_ok=True)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    if args.resume and state_path.exists():
        state = json.loads(state_path.read_text())
        start_iter = state["next_iteration"]
        best, _ = load_net(best_path)
        print(f"[loop] resume: iteração {start_iter}, best={best_path}")
    else:
        start_iter = 0
        best = AtariGoNet()
        save_net(best_path, best, -1)
        state_path.write_text(json.dumps({"next_iteration": 0}))
        log_event(run_dir, {"event": "init", "params": num_params(best),
                            "args": vars(args)})
        print(f"[loop] novo run em {run_dir} ({num_params(best)} parâmetros)")

    for it in range(start_iter, args.iterations):
        it_t0 = time.time()
        seed = args.seed + 1_000_003 * it
        print(f"[loop] iteração {it}: self-play {args.games} jogos x {args.sims} sims "
              f"({args.workers} workers, {args.concurrency} jogos concorrentes/worker)")

        samples, sp_metrics = selfplay.run_selfplay(
            best, args.games, args.sims, args.concurrency, args.workers, seed, args.device)
        np.savez_compressed(selfplay_dir / f"iter_{it:03d}.npz", **samples)
        log_event(run_dir, {"event": "selfplay", "iteration": it, **sp_metrics})
        print(f"[loop]   self-play: {sp_metrics['games_per_min']} jogos/min, "
              f"{sp_metrics['positions']} posições, {sp_metrics['seconds']}s")

        data = build_buffer(selfplay_dir, args.buffer)
        cand = copy.deepcopy(best)
        tr_rng = np.random.default_rng(seed + 1)
        tr_metrics = train.train_iteration(
            cand, data, args.steps, args.batch, args.device, tr_rng,
            lr_max=args.lr_max, lr_min=args.lr_min)
        save_net(ckpt_dir / f"iter_{it:03d}.pt", cand, it)
        log_event(run_dir, {"event": "train", "iteration": it, **tr_metrics})
        print(f"[loop]   treino: policy loss {tr_metrics['policy_loss_first']} -> "
              f"{tr_metrics['policy_loss_last']} ({tr_metrics['steps']} steps, "
              f"{tr_metrics['positions']} posições no buffer)")

        gate = selfplay.run_gating(
            cand, best, args.gate_games, args.gate_sims, args.concurrency,
            args.workers, seed + 2, args.device)
        promoted = gate["score"] >= args.gate_threshold
        if promoted:
            best = cand
            save_net(best_path, best, it)
        log_event(run_dir, {"event": "gate", "iteration": it, **gate,
                            "threshold": args.gate_threshold, "promoted": promoted})
        print(f"[loop]   gating: score {gate['score']} "
              f"({gate['cand_wins']}V/{gate['draws']}E/{gate['best_wins']}D) -> "
              f"{'PROMOVIDO' if promoted else 'rejeitado'}")

        state_path.write_text(json.dumps({"next_iteration": it + 1}))
        log_event(run_dir, {"event": "iteration", "iteration": it,
                            "seconds": round(time.time() - it_t0, 1)})

    print(f"[loop] concluído: {args.iterations} iterações em {run_dir}")


if __name__ == "__main__":
    main()
