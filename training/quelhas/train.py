"""Treino supervisionado sobre o replay buffer de self-play.

- batch 512, SGD momentum 0.9, weight decay 1e-4
- cosine lr 1e-2 -> 1e-4 ao longo dos steps da iteração
- augmentação D4 (8 simetrias) on-the-fly por amostra
- loss = cross-entropy da policy (logits com máscara de ilegais) + MSE do value
"""

from __future__ import annotations

import math

import numpy as np
import torch
import torch.nn.functional as F

from quelhas import rules
from quelhas.net import AtariGoNet, encode_features

SIZE = rules.SIZE


def _d4(x: torch.Tensor, k: int) -> torch.Tensor:
    """Aplica a simetria k (0..7) nas duas últimas dimensões (9, 9)."""
    if k >= 4:
        x = torch.flip(x, dims=(-1,))
    return torch.rot90(x, k % 4, dims=(-2, -1))


def _make_batch(data: dict[str, np.ndarray], idx: np.ndarray,
                rng: np.random.Generator) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    """Constrói um batch (features, pi, legal_mask, z), SEM augmentação.

    A augmentação D4 do Atari Go não é válida aqui: rotações de 90° trocam
    segmentos verticais por horizontais (ou seja, trocam os jogadores) e o
    espaço de ações (start×comprimento) não roda como uma grelha de células.
    Os espelhos horizontais/verticais seriam válidos com remapeamento das
    ações — melhoria futura.
    """
    feats = np.stack([
        encode_features(data["boards"][i], int(data["to_play"][i]), int(data["last_move"][i]))
        for i in idx
    ])
    x = torch.from_numpy(feats)
    pi = torch.from_numpy(data["pi"][idx])
    mask = torch.from_numpy(data["legal_mask"][idx])
    z = torch.from_numpy(data["z"][idx])
    return x, pi.reshape(-1, rules.NUM_ACTIONS), mask.reshape(-1, rules.NUM_ACTIONS), z


def train_iteration(
    net: AtariGoNet,
    data: dict[str, np.ndarray],
    steps: int,
    batch_size: int,
    device: str,
    rng: np.random.Generator,
    lr_max: float = 1e-2,
    lr_min: float = 1e-4,
    momentum: float = 0.9,
    weight_decay: float = 1e-4,
    log_every: int = 50,
) -> dict:
    """Treina `net` in-place; devolve métricas (loss inicial/final, histórico)."""
    n = data["z"].shape[0]
    net.to(device).train()
    opt = torch.optim.SGD(net.parameters(), lr=lr_max, momentum=momentum,
                          weight_decay=weight_decay)
    history: list[dict] = []
    window_p: list[float] = []
    window_v: list[float] = []
    first_policy_loss = last_policy_loss = None

    for step in range(steps):
        lr = lr_min + 0.5 * (lr_max - lr_min) * (1.0 + math.cos(math.pi * step / max(steps - 1, 1)))
        for group in opt.param_groups:
            group["lr"] = lr

        idx = rng.integers(0, n, batch_size)
        x, pi, mask, z = _make_batch(data, idx, rng)
        x, pi, mask, z = x.to(device), pi.to(device), mask.to(device), z.to(device)

        logits, value = net(x)
        masked = logits.masked_fill(~mask, -1e9)  # máscara de ilegais fora da rede
        logp = F.log_softmax(masked, dim=-1)
        policy_loss = -(pi * logp).sum(dim=-1).mean()
        value_loss = F.mse_loss(value, z)
        loss = policy_loss + value_loss

        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()

        p, v = float(policy_loss.item()), float(value_loss.item())
        window_p.append(p)
        window_v.append(v)
        if first_policy_loss is None:
            first_policy_loss = p
        last_policy_loss = p
        if (step + 1) % log_every == 0 or step == steps - 1:
            history.append({
                "step": step + 1,
                "lr": round(lr, 6),
                "policy_loss": round(sum(window_p) / len(window_p), 4),
                "value_loss": round(sum(window_v) / len(window_v), 4),
            })
            window_p, window_v = [], []

    return {
        "steps": steps,
        "positions": n,
        "policy_loss_first": round(first_policy_loss, 4),
        "policy_loss_last": round(last_policy_loss, 4),
        "history": history,
    }
