"""Valida rules.py contra os traces das regras TypeScript (fonte de verdade).

Uso (no container): python -m quelhas.rules_test
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from . import rules

TRACES = Path(__file__).resolve().parent.parent / "traces" / "quelhas-traces.jsonl"


def main() -> None:
    plies = 0
    games: dict[int, np.ndarray] = {}
    with TRACES.open() as f:
        for line in f:
            rec = json.loads(line)
            board = np.array(rec["board"], dtype=np.uint8)
            game = rec["game"]
            if game in games:
                if not np.array_equal(games[game], board):
                    raise AssertionError(f"jogo {game} ply {rec['ply']}: tabuleiro divergente do replay")
            legal = rules.legal_moves(board, rec["toPlay"])
            expected = np.array(rec["legalActions"], dtype=np.int32)
            if not np.array_equal(legal, expected):
                missing = set(expected.tolist()) - set(legal.tolist())
                extra = set(legal.tolist()) - set(expected.tolist())
                raise AssertionError(
                    f"jogo {game} ply {rec['ply']}: jogadas divergentes (faltam {sorted(missing)[:5]}, extra {sorted(extra)[:5]})"
                )
            new_board, status = rules.play(board, rec["toPlay"], rec["actionPlayed"])
            expected_status = rules.ONGOING if rec["status"] == "ongoing" else rules.LOSS
            if status != expected_status:
                raise AssertionError(f"jogo {game} ply {rec['ply']}: status {status} != {expected_status}")
            games[game] = new_board
            plies += 1
    print(f"OK: {plies} plies validados, 0 divergências")


if __name__ == "__main__":
    main()
