"""MCTS (PUCT) com batching de folhas ENTRE jogos concorrentes.

- PUCT c=1.5; ruído Dirichlet na raiz (alpha=0.15, eps=0.25) em self-play
- Sem virtual loss: cada jogo submete exatamente uma folha por ronda de
  inferência; o batching vem de G jogos concorrentes (driver `drive`).
- Valores sempre na perspetiva do jogador a mover no nó.

Os geradores fazem `policy, value = yield (net_key, board, to_play, last_move)`
e o driver agrupa os pedidos pendentes de todos os jogos, avalia em batch na
GPU (por net_key) e devolve os resultados a cada gerador.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Callable, Generator

import numpy as np

from quelhas import rules

C_PUCT = 1.5
DIRICHLET_ALPHA = 0.15
DIRICHLET_EPS = 0.25

# Pedido de avaliação: (net_key, board, to_play, last_move)
EvalRequest = tuple[str, np.ndarray, int, int]
# Resposta: (policy_probs (81,), value float)
EvalReply = tuple[np.ndarray, float]


class Node:
    __slots__ = ("board", "to_play", "last_move", "legal", "P", "N", "W", "children", "terminal")

    def __init__(self, board, to_play, last_move, terminal=None):
        self.board = board
        self.to_play = to_play
        self.last_move = last_move
        self.terminal = terminal  # None, ou valor terminal na perspetiva de to_play
        self.legal = None
        self.P = None
        self.N = None
        self.W = None
        self.children = None

    def expand(self, policy: np.ndarray) -> None:
        legal = rules.legal_moves(self.board, self.to_play)
        self.legal = legal
        p = policy[legal].astype(np.float64)
        s = p.sum()
        if s > 1e-9:
            p = p / s
        else:
            p = np.full(legal.size, 1.0 / legal.size)
        self.P = p
        self.N = np.zeros(legal.size, dtype=np.int32)
        self.W = np.zeros(legal.size, dtype=np.float64)
        self.children = {}


def _select_edge(node: Node, c_puct: float) -> int:
    n_sum = node.N.sum()
    sqrt_n = math.sqrt(n_sum) if n_sum > 0 else 1.0
    q = np.divide(node.W, node.N, out=np.zeros_like(node.W), where=node.N > 0)
    u = c_puct * node.P * (sqrt_n / (1.0 + node.N))
    return int(np.argmax(q + u))


def _make_child(node: Node, edge: int) -> Node:
    move = int(node.legal[edge])
    new_board, status = rules.play(node.board, node.to_play, move)
    opp = rules.opponent(node.to_play)
    if status == rules.LOSS:
        # misère: quem jogou deixou o adversário sem jogadas e PERDE;
        # valor +1 para o jogador a mover no filho (o adversário)
        child = Node(new_board, opp, move, terminal=1.0)
    else:
        child = Node(new_board, opp, move)
    node.children[edge] = child
    return child


def mcts_decide(
    board: np.ndarray,
    to_play: int,
    last_move: int,
    sims: int,
    net_key: str,
    rng: np.random.Generator,
    c_puct: float = C_PUCT,
    dirichlet: tuple[float, float] | None = (DIRICHLET_ALPHA, DIRICHLET_EPS),
) -> Generator[EvalRequest, EvalReply, tuple[np.ndarray, np.ndarray]]:
    """Corre `sims` simulações; devolve (visits (900,) int32, legais da raiz).

    Gerador: cada `yield` é um pedido de avaliação da rede para uma folha.
    """
    policy, _ = yield (net_key, board, to_play, last_move)
    root = Node(board, to_play, last_move)
    root.expand(policy)
    if dirichlet is not None and root.legal.size > 1:
        alpha, eps = dirichlet
        noise = rng.dirichlet(np.full(root.legal.size, alpha))
        root.P = (1.0 - eps) * root.P + eps * noise

    for _ in range(sims):
        node = root
        path: list[tuple[Node, int]] = []
        while True:
            edge = _select_edge(node, c_puct)
            path.append((node, edge))
            child = node.children.get(edge)
            if child is None:
                child = _make_child(node, edge)
                if child.terminal is not None:
                    value = child.terminal
                else:
                    policy, value = yield (net_key, child.board, child.to_play, child.last_move)
                    child.expand(policy)
                break
            if child.terminal is not None:
                value = child.terminal
                break
            node = child
        # backup: `value` está na perspetiva do jogador a mover no nó final
        for parent, edge in reversed(path):
            value = -value
            parent.N[edge] += 1
            parent.W[edge] += value

    visits = np.zeros(rules.NUM_ACTIONS, dtype=np.int32)
    visits[root.legal] = root.N
    return visits, root.legal


def drive(
    make_game: Callable[[int], Generator],
    num_games: int,
    concurrency: int,
    evaluate: Callable[[str, list[tuple[np.ndarray, int, int]]], tuple[np.ndarray, np.ndarray]],
) -> list:
    """Corre `num_games` geradores de jogo com até `concurrency` concorrentes.

    Em cada ronda recolhe o pedido pendente de cada jogo ativo, agrupa por
    net_key, avalia em batch com `evaluate(net_key, [(board, to_play,
    last_move), ...]) -> (policies (B,81), values (B,))` e reencaminha as
    respostas. Devolve a lista dos valores de retorno dos geradores.
    """
    results: list = [None] * num_games
    active: dict[int, Generator] = {}
    pending: dict[int, EvalRequest] = {}
    next_game = 0

    def start_one() -> None:
        nonlocal next_game
        while next_game < num_games and len(active) < concurrency:
            gid = next_game
            next_game += 1
            gen = make_game(gid)
            try:
                pending[gid] = gen.send(None)
                active[gid] = gen
            except StopIteration as si:  # jogo sem avaliações (não esperado)
                results[gid] = si.value

    start_one()
    while active:
        by_key: dict[str, list[int]] = defaultdict(list)
        for gid, req in pending.items():
            by_key[req[0]].append(gid)
        replies: dict[int, EvalReply] = {}
        for key, gids in by_key.items():
            policies, values = evaluate(key, [pending[g][1:] for g in gids])
            for g, p, v in zip(gids, policies, values):
                replies[g] = (p, float(v))
        pending = {}
        for gid, reply in replies.items():
            gen = active[gid]
            try:
                pending[gid] = gen.send(reply)
            except StopIteration as si:
                results[gid] = si.value
                del active[gid]
        start_one()
    return results
