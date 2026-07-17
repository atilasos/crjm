"""Regras de Atari Go 9x9 em numpy.

Porta fiel de src/games/atari-go/logic.ts (fonte de verdade):
- tabuleiro: np.ndarray shape (81,), dtype int8; 0=vazia, 1=preta, 2=branca
- pretas (1) jogam primeiro; sem passe
- vitória = primeira captura (quem captura vence de imediato)
- suicídio proibido, exceto se a jogada captura
- sem jogadas legais para o jogador a mover => empate
- máximo 81 plies (o tabuleiro enche e o jogo termina)
"""

from __future__ import annotations

import numpy as np

SIZE = 9
NUM_CELLS = SIZE * SIZE  # 81

ONGOING = "ongoing"
WIN = "win"
DRAW = "draw"

EMPTY, BLACK, WHITE = 0, 1, 2


def _build_neighbors() -> list[tuple[int, ...]]:
    neigh: list[tuple[int, ...]] = []
    for idx in range(NUM_CELLS):
        r, c = divmod(idx, SIZE)
        cand = []
        if r > 0:
            cand.append(idx - SIZE)
        if r < SIZE - 1:
            cand.append(idx + SIZE)
        if c > 0:
            cand.append(idx - 1)
        if c < SIZE - 1:
            cand.append(idx + 1)
        neigh.append(tuple(cand))
    return neigh


NEIGHBORS: list[tuple[int, ...]] = _build_neighbors()


def opponent(to_play: int) -> int:
    return BLACK + WHITE - to_play


def new_board() -> np.ndarray:
    return np.zeros(NUM_CELLS, dtype=np.int8)


def group_and_liberties(board: np.ndarray, idx: int) -> tuple[list[int], int]:
    """Flood fill: devolve (pedras do grupo que contém idx, nº de liberdades)."""
    color = board[idx]
    if color == EMPTY:
        raise ValueError(f"célula {idx} vazia")
    stones = [idx]
    seen = bytearray(NUM_CELLS)
    seen[idx] = 1
    libs_seen = bytearray(NUM_CELLS)
    n_libs = 0
    stack = [idx]
    while stack:
        cur = stack.pop()
        for nb in NEIGHBORS[cur]:
            v = board[nb]
            if v == EMPTY:
                if not libs_seen[nb]:
                    libs_seen[nb] = 1
                    n_libs += 1
            elif v == color and not seen[nb]:
                seen[nb] = 1
                stones.append(nb)
                stack.append(nb)
    return stones, n_libs


def _captures_after_placement(board: np.ndarray, move: int, to_play: int) -> list[int]:
    """Pedras adversárias capturadas ao colocar `to_play` em `move`.

    Equivalente a verificarCapturas do logic.ts: simula a colocação da pedra
    (o tabuleiro recebido é o PRÉ-jogada) e verifica os grupos adversários
    adjacentes com 0 liberdades.
    """
    opp = opponent(to_play)
    board[move] = to_play  # colocação temporária (revertida pelo chamador)
    captured: list[int] = []
    checked = bytearray(NUM_CELLS)
    for nb in NEIGHBORS[move]:
        if board[nb] == opp and not checked[nb]:
            stones, libs = group_and_liberties(board, nb)
            for s in stones:
                checked[s] = 1
            if libs == 0:
                captured.extend(stones)
    return captured


def _is_legal_full(board: np.ndarray, move: int, to_play: int) -> bool:
    """Verificação completa (captura ou não-suicídio) para uma célula vazia."""
    captured = _captures_after_placement(board, move, to_play)
    if captured:
        board[move] = EMPTY
        return True
    _, libs = group_and_liberties(board, move)
    board[move] = EMPTY
    return libs > 0


def _empty_neighbor_mask(board: np.ndarray) -> np.ndarray:
    """Máscara (81,) das células com pelo menos um vizinho vazio."""
    empty = (board == EMPTY).reshape(SIZE, SIZE)
    has = np.zeros((SIZE, SIZE), dtype=bool)
    has[1:, :] |= empty[:-1, :]
    has[:-1, :] |= empty[1:, :]
    has[:, 1:] |= empty[:, :-1]
    has[:, :-1] |= empty[:, 1:]
    return has.reshape(NUM_CELLS)


def legal_moves(board: np.ndarray, to_play: int) -> np.ndarray:
    """Índices (ordenados) das jogadas legais para `to_play`.

    Caminho rápido: uma célula vazia com um vizinho vazio nunca é suicídio
    (a pedra colocada tem pelo menos essa liberdade). As restantes células
    vazias passam pela verificação completa.
    """
    empty_mask = board == EMPTY
    fast = empty_mask & _empty_neighbor_mask(board)
    result = list(np.flatnonzero(fast))
    slow = np.flatnonzero(empty_mask & ~fast)
    if slow.size:
        b = board.copy()
        for move in slow:
            if _is_legal_full(b, int(move), to_play):
                result.append(int(move))
    result.sort()
    return np.asarray(result, dtype=np.int32)


def play(board: np.ndarray, to_play: int, move: int) -> tuple[np.ndarray, str]:
    """Executa uma jogada legal; devolve (novo tabuleiro, status pós-jogada).

    status: WIN se a jogada capturou (to_play vence), DRAW se o adversário
    ficou sem jogadas legais, ONGOING caso contrário. Não muta o input.
    """
    if board[move] != EMPTY:
        raise ValueError(f"jogada ilegal: célula {move} ocupada")
    new = board.copy()
    captured = _captures_after_placement(new, move, to_play)
    if captured:
        new[captured] = EMPTY
        return new, WIN
    # _captures_after_placement deixou a pedra colocada em `new`
    _, libs = group_and_liberties(new, move)
    if libs == 0:
        raise ValueError(f"jogada ilegal (suicídio): célula {move}")
    opp = opponent(to_play)
    if legal_moves(new, opp).size == 0:
        return new, DRAW
    return new, ONGOING


def stone_liberty_counts(board: np.ndarray) -> np.ndarray:
    """(81,) int8: para cada pedra, nº de liberdades do seu grupo (0 em vazias).

    Usado para os planos de features da rede.
    """
    out = np.zeros(NUM_CELLS, dtype=np.int8)
    seen = bytearray(NUM_CELLS)
    for idx in range(NUM_CELLS):
        if board[idx] != EMPTY and not seen[idx]:
            stones, libs = group_and_liberties(board, idx)
            v = min(libs, 127)
            for s in stones:
                seen[s] = 1
                out[s] = v
    return out
