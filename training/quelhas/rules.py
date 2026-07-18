"""Regras de Quelhas 10×10 em numpy, espelhando src/games/quelhas/logic.ts.

- tabuleiro: array (100,) uint8 — 0 vazia, 1 ocupada
- jogador 1 coloca segmentos VERTICAIS, jogador 2 HORIZONTAIS
- segmento: casas vazias consecutivas, comprimento 2..10
- ação: id = start*9 + (comprimento-2), start = linha*10+coluna → 900 ações
- misère: quem deixar o adversário SEM jogadas perde (o adversário ganha);
  não há empates.

API compatível com atari_go.rules para reutilizar mcts/selfplay/train/loop:
ONGOING/LOSS, opponent, new_board, legal_moves, play, NUM_ACTIONS.
"""

from __future__ import annotations

import numpy as np

SIZE = 10
NUM_CELLS = SIZE * SIZE
MIN_LEN = 2
MAX_LEN = SIZE
NUM_ACTIONS = NUM_CELLS * (MAX_LEN - MIN_LEN + 1)  # 900

ONGOING = "ongoing"
LOSS = "loss"  # o mover perdeu: o adversário ficou sem jogadas e ganha


def opponent(to_play: int) -> int:
    return 3 - to_play


def new_board() -> np.ndarray:
    return np.zeros(NUM_CELLS, dtype=np.uint8)


def action_fields(action: int) -> tuple[int, int]:
    """(start_cell, comprimento)."""
    return action // 9, action % 9 + MIN_LEN


def _runs(board: np.ndarray, vertical: bool):
    """Corridas de casas vazias por coluna (vertical) ou linha (horizontal)."""
    grid = board.reshape(SIZE, SIZE)
    lanes = grid.T if vertical else grid
    for lane_idx in range(SIZE):
        lane = lanes[lane_idx]
        start = -1
        for pos in range(SIZE + 1):
            empty = pos < SIZE and lane[pos] == 0
            if empty and start == -1:
                start = pos
            elif not empty and start != -1:
                yield lane_idx, start, pos - start
                start = -1


def _cell(lane_idx: int, pos: int, vertical: bool) -> int:
    return (pos * SIZE + lane_idx) if vertical else (lane_idx * SIZE + pos)


def legal_moves(board: np.ndarray, to_play: int) -> np.ndarray:
    vertical = to_play == 1
    actions: list[int] = []
    for lane_idx, start, run_len in _runs(board, vertical):
        for length in range(MIN_LEN, run_len + 1):
            for offset in range(run_len - length + 1):
                cell = _cell(lane_idx, start + offset, vertical)
                actions.append(cell * 9 + (length - MIN_LEN))
    return np.array(sorted(actions), dtype=np.int32)


def action_cells(action: int, to_play: int) -> list[int]:
    start, length = action_fields(action)
    step = SIZE if to_play == 1 else 1
    return [start + i * step for i in range(length)]


def play(board: np.ndarray, to_play: int, action: int) -> tuple[np.ndarray, str]:
    """Executa a ação; devolve (novo tabuleiro, status).

    status: LOSS se o adversário ficar sem jogadas (o mover perde, misère);
    ONGOING caso contrário. Não muta o input. Lança em ação ilegal.
    """
    cells = action_cells(action, to_play)
    start, length = action_fields(action)
    row, col = divmod(start, SIZE)
    if to_play == 1:
        if row + length > SIZE:
            raise ValueError(f"segmento vertical fora do tabuleiro: {action}")
    else:
        if col + length > SIZE:
            raise ValueError(f"segmento horizontal fora do tabuleiro: {action}")
    if any(board[c] != 0 for c in cells):
        raise ValueError(f"ação ilegal: célula ocupada em {action}")

    new = board.copy()
    for c in cells:
        new[c] = 1
    if legal_moves(new, opponent(to_play)).size == 0:
        return new, LOSS
    return new, ONGOING
