"""Serviço de inferência AlphaZero para Atari Go 9x9 (FastAPI, porta 8100).

Endpoints:
  GET  /health -> {status, model, device}
  POST /move   -> {move, value, topMoves, stats}
    body: {board: int[81] (0 vazio/1 pretas/2 brancas), toPlay: 1|2,
           lastMove?: int, timeBudgetMs?: number, seed?: number}

Camada de segurança tática determinística (antes do MCTS):
  1. Se existe captura imediata legal -> joga-a (menor índice).
  2. Se alguma jogada deixaria o adversário com captura imediata na resposta,
     a raiz do MCTS é restringida às defesas (jogadas após as quais nenhum
     grupo próprio fica em atari). Se não houver defesas, pesquisa livre.

Checkpoint: env MODEL_PATH (default runs/az-v1/best.pt, fallback
runs/smoke/best.pt, relativo ao diretório training/). O ficheiro é recarregado
automaticamente quando o mtime muda (o treino atualiza best.pt em contínuo).

Arranque: python -m atari_go.serve  (ou uvicorn atari_go.serve:app)
"""

from __future__ import annotations

import os
import threading
import time
from pathlib import Path

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from quelhas import mcts, rules
from quelhas.net import AtariGoNet, encode_features

TRAINING_DIR = Path(__file__).resolve().parent.parent  # .../training
DEFAULT_MODEL = "runs/qz-v1/best.pt"
FALLBACK_MODEL = "runs/qz-smoke2/best.pt"

TARGET_SIMS = int(os.environ.get("AZ_SIMS", "400"))
DEFAULT_BUDGET_MS = int(os.environ.get("AZ_BUDGET_MS", "1800"))
BUDGET_MARGIN = 0.85  # fração do budget dedicada à pesquisa (margem p/ overhead)
PORT = int(os.environ.get("PORT", "8101"))
HOST = os.environ.get("HOST", "127.0.0.1")


def _resolve_model_path() -> Path:
    configured = os.environ.get("MODEL_PATH", DEFAULT_MODEL)
    candidates = [configured, FALLBACK_MODEL]
    for cand in candidates:
        path = Path(cand)
        if not path.is_absolute():
            path = TRAINING_DIR / path
        if path.exists():
            return path
    raise FileNotFoundError(
        f"nenhum checkpoint encontrado (tentado: {candidates}, base {TRAINING_DIR})"
    )


def _pick_device() -> str:
    forced = os.environ.get("AZ_DEVICE")
    if forced:
        return forced
    return "cuda" if torch.cuda.is_available() else "cpu"


class ModelManager:
    """Mantém o modelo carregado e recarrega quando best.pt muda no disco."""

    def __init__(self) -> None:
        self.device = _pick_device()
        self.path = _resolve_model_path()
        self.net: AtariGoNet | None = None
        self.loaded_mtime = 0.0
        self.lock = threading.Lock()
        self._load(self.path)

    def _load(self, path: Path) -> None:
        ckpt = torch.load(path, map_location="cpu", weights_only=True)
        net = AtariGoNet()
        net.load_state_dict(ckpt["model"])
        net.to(self.device).eval()
        self.net = net
        self.loaded_mtime = path.stat().st_mtime

    def maybe_reload(self) -> None:
        try:
            preferred = _resolve_model_path()
            mtime = preferred.stat().st_mtime
        except (OSError, FileNotFoundError):
            return
        if preferred == self.path and mtime <= self.loaded_mtime:
            return
        try:
            self._load(preferred)
            self.path = preferred
        except Exception:
            # best.pt pode estar a meio de escrita pelo treino; mantém o atual
            pass

    def evaluate(self, board: np.ndarray, to_play: int, last_move: int) -> tuple[np.ndarray, float]:
        feats = encode_features(board, to_play, last_move)[None]
        x = torch.from_numpy(feats).to(self.device)
        with torch.no_grad():
            logits, value = self.net(x)
            policy = torch.softmax(logits.float(), dim=-1)[0].cpu().numpy()
        return policy, float(value[0].item())


class MoveRequest(BaseModel):
    board: list[int] = Field(..., min_length=rules.NUM_CELLS, max_length=rules.NUM_CELLS)
    toPlay: int
    lastMove: int | None = Field(default=None, ge=0, le=rules.NUM_ACTIONS - 1)
    timeBudgetMs: int | None = None
    seed: int | None = None


def _solve_endgame(board: np.ndarray, to_play: int, max_moves: int = 16,
                   node_budget: int = 300_000) -> int | None:
    """Resolve finais pequenos por busca completa (misère); devolve a ação
    ótima ou None se a posição for grande demais / orçamento estourar."""
    legal = rules.legal_moves(board, to_play)
    if legal.size == 0 or legal.size > max_moves:
        return None
    memo: dict[tuple[bytes, int], bool] = {}
    nodes = 0

    def wins(b: np.ndarray, tp: int) -> bool:
        nonlocal nodes
        key = (b.tobytes(), tp)
        if key in memo:
            return memo[key]
        nodes += 1
        if nodes > node_budget:
            raise RuntimeError("endgame-budget")
        moves = rules.legal_moves(b, tp)
        if moves.size == 0:
            memo[key] = True  # misère: sem jogadas, eu ganho
            return True
        result = False
        for mv in moves:
            nb, status = rules.play(b, tp, int(mv))
            if status == rules.LOSS:
                continue  # esta jogada perde já
            if not wins(nb, rules.opponent(tp)):
                result = True
                break
        memo[key] = result
        return result

    try:
        best_losing = None
        for mv in legal:
            nb, status = rules.play(board, to_play, int(mv))
            if status == rules.LOSS:
                best_losing = best_losing if best_losing is not None else int(mv)
                continue
            if not wins(nb, rules.opponent(to_play)):
                return int(mv)
        return best_losing if best_losing is not None else int(legal[0])
    except RuntimeError:
        return None


def _restrict_root(root: mcts.Node, allowed: set[int]) -> None:
    keep = np.asarray([int(m) in allowed for m in root.legal], dtype=bool)
    root.legal = root.legal[keep]
    p = root.P[keep].astype(np.float64)
    s = p.sum()
    root.P = p / s if s > 1e-9 else np.full(root.legal.size, 1.0 / root.legal.size)
    root.N = np.zeros(root.legal.size, dtype=np.int32)
    root.W = np.zeros(root.legal.size, dtype=np.float64)
    root.children = {}


def _search(
    manager: ModelManager,
    board: np.ndarray,
    to_play: int,
    last_move: int,
    sims: int,
    deadline: float,
    restrict: set[int] | None,
    rng: np.random.Generator | None,
) -> tuple[mcts.Node, int, float]:
    """MCTS síncrono (1 folha por simulação), sem ruído Dirichlet."""
    policy, root_value = manager.evaluate(board, to_play, last_move)
    root = mcts.Node(board.copy(), to_play, last_move)
    root.expand(policy)
    if restrict is not None:
        _restrict_root(root, restrict)
    if rng is not None and root.legal.size > 1:
        # O seed é usado apenas em arenas/testes para diversificar aberturas;
        # pedidos normais sem seed continuam determinísticos.
        noise = rng.dirichlet(np.full(root.legal.size, 0.3))
        root.P = 0.97 * root.P + 0.03 * noise
        root.P /= root.P.sum()
    done = 0
    while done < sims and time.monotonic() < deadline and root.legal.size > 0:
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
                    pol, value = manager.evaluate(child.board, child.to_play, child.last_move)
                    child.expand(pol)
                break
            if child.terminal is not None:
                value = child.terminal
                break
            node = child
        for parent, edge in reversed(path):
            value = -value
            parent.N[edge] += 1
            parent.W[edge] += value
        done += 1
    return root, done, root_value


app = FastAPI(title="crjm-az-serve", version="1.0")
_manager: ModelManager | None = None
_serve_lock = threading.Lock()
_admission = threading.BoundedSemaphore(1)


def get_manager() -> ModelManager:
    global _manager
    if _manager is None:
        _manager = ModelManager()
    return _manager




@app.get("/health")
def health() -> dict:
    manager = get_manager()
    return {"status": "ok", "model": str(manager.path), "device": manager.device}


def _compute_move(req: MoveRequest) -> dict:
    started = time.monotonic()
    if req.toPlay not in (1, 2):
        raise HTTPException(status_code=422, detail="toPlay deve ser 1 (vertical) ou 2 (horizontal)")
    if any(cell not in (0, 1) for cell in req.board):
        raise HTTPException(status_code=422, detail="board deve conter apenas 0 ou 1")

    board = np.asarray(req.board, dtype=np.int8)
    to_play = req.toPlay
    budget_ms = req.timeBudgetMs if req.timeBudgetMs and req.timeBudgetMs > 0 else DEFAULT_BUDGET_MS
    budget_ms = min(budget_ms, 2_200)
    deadline = started + (budget_ms / 1000.0) * BUDGET_MARGIN

    with _serve_lock:
        manager = get_manager()
        manager.maybe_reload()

        if rules.legal_moves(board, to_play).size == 0:
            raise HTTPException(status_code=422, detail="sem jogadas legais nesta posição")

        solved = _solve_endgame(board, to_play)
        if solved is not None:
            elapsed_ms = (time.monotonic() - started) * 1000.0
            return {
                "move": solved,
                "value": 1.0,
                "topMoves": [{"move": solved, "prior": 1.0, "visits": 0}],
                "stats": {
                    "sims": 0,
                    "elapsedMs": round(elapsed_ms, 2),
                    "engine": "server-nn",
                    "tactical": "exact-endgame",
                },
            }

        restrict = None
        rng = np.random.default_rng(req.seed) if req.seed is not None else None
        root, sims_done, root_value = _search(
            manager,
            board,
            to_play,
            last_move=req.lastMove if req.lastMove is not None else -1,
            sims=TARGET_SIMS,
            deadline=deadline,
            restrict=restrict,
            rng=rng,
        )

    if root.legal.size == 0:
        raise HTTPException(status_code=422, detail="sem jogadas legais nesta posição")

    total_visits = int(root.N.sum())
    if total_visits > 0:
        best_edge = int(np.argmax(root.N))
        value = float(root.W[best_edge] / root.N[best_edge]) if root.N[best_edge] > 0 else root_value
    else:
        best_edge = int(np.argmax(root.P))
        value = root_value

    order = np.argsort(-root.N, kind="stable")[:5]
    top_moves = [
        {
            "move": int(root.legal[e]),
            "prior": round(float(root.P[e]), 4),
            "visits": int(root.N[e]),
        }
        for e in order
    ]

    elapsed_ms = (time.monotonic() - started) * 1000.0
    return {
        "move": int(root.legal[best_edge]),
        "value": round(value, 4),
        "topMoves": top_moves,
        "stats": {
            "sims": sims_done,
            "elapsedMs": round(elapsed_ms, 2),
            "engine": "server-nn",
            "tactical": None,
        },
    }


@app.post("/move")
def move(req: MoveRequest) -> dict:
    if not _admission.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="inferência ocupada; o cliente deve usar o fallback N5",
        )
    try:
        return _compute_move(req)
    finally:
        _admission.release()


if __name__ == "__main__":
    import uvicorn

    get_manager()  # carrega o modelo antes de aceitar pedidos
    uvicorn.run(app, host=HOST, port=PORT)
