"""Valida rules.py contra os traces gerados pelas regras TypeScript.

Replay campo a campo de training/traces/atari-go-traces.jsonl:
- board do trace == board reconstruído em Python (continuidade entre plies)
- toPlay esperado (pretas começam, alternância)
- legal_moves == legalMoves do trace (comparação como conjuntos)
- play(board, toPlay, movePlayed) -> status/captured coincidem

Uso (a partir de training/): python -m atari_go.rules_test [--traces caminho]
Sai com código 1 e detalhe do primeiro mismatch se houver divergência.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from atari_go import rules

DEFAULT_TRACES = Path(__file__).resolve().parents[1] / "traces" / "atari-go-traces.jsonl"


def fail(msg: str) -> None:
    print(f"DIVERGÊNCIA: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Replay dos traces TS sobre rules.py")
    parser.add_argument("--traces", type=Path, default=DEFAULT_TRACES)
    args = parser.parse_args()

    if not args.traces.exists():
        fail(f"ficheiro de traces não encontrado: {args.traces}")

    board = rules.new_board()
    expected_to_play = rules.BLACK
    prev_game = -1
    prev_status = None
    games = 0
    plies = 0

    with args.traces.open() as fh:
        for line_no, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                continue
            t = json.loads(line)
            game, ply = t["game"], t["ply"]
            ctx = f"linha {line_no} (game={game}, ply={ply})"

            if game != prev_game:
                if prev_game >= 0 and prev_status == rules.ONGOING:
                    fail(f"{ctx}: jogo {prev_game} terminou o trace com status 'ongoing'")
                if ply != 0:
                    fail(f"{ctx}: novo jogo não começa em ply 0")
                board = rules.new_board()
                expected_to_play = rules.BLACK
                prev_game = game
                games += 1

            trace_board = np.asarray(t["board"], dtype=np.int8)
            if not np.array_equal(board, trace_board):
                diff = np.flatnonzero(board != trace_board)
                fail(
                    f"{ctx}: board divergente nas células {diff.tolist()} "
                    f"(python={board[diff].tolist()}, trace={trace_board[diff].tolist()})"
                )

            if t["toPlay"] != expected_to_play:
                fail(f"{ctx}: toPlay={t['toPlay']}, esperado {expected_to_play}")

            py_legal = set(rules.legal_moves(board, expected_to_play).tolist())
            ts_legal = set(t["legalMoves"])
            if py_legal != ts_legal:
                fail(
                    f"{ctx}: legal_moves divergentes; "
                    f"só python={sorted(py_legal - ts_legal)}, só trace={sorted(ts_legal - py_legal)}"
                )

            move = t["movePlayed"]
            if move not in py_legal:
                fail(f"{ctx}: movePlayed={move} não é legal em python")

            new_board, status = rules.play(board, expected_to_play, move)
            captured = status == rules.WIN
            if captured != t["captured"]:
                fail(f"{ctx}: captured python={captured}, trace={t['captured']}")
            if status != t["status"]:
                fail(f"{ctx}: status python={status}, trace={t['status']}")
            if ply >= 81:
                fail(f"{ctx}: mais de 81 plies")

            board = new_board
            expected_to_play = rules.opponent(expected_to_play)
            prev_status = status
            plies += 1

    if prev_game >= 0 and prev_status == rules.ONGOING:
        fail(f"jogo {prev_game} terminou o trace com status 'ongoing'")

    print(f"OK: {games} jogos, {plies} plies, 0 divergências")


if __name__ == "__main__":
    main()
