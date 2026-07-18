"""Rede AlphaZero para Atari Go 9x9 (~0.5M parâmetros).

Input: 9 planos 9x9 na perspetiva do jogador a mover:
  0-2: pedras próprias com liberdades do grupo ∈ {1, 2, ≥3}
  3-5: pedras adversárias com liberdades do grupo ∈ {1, 2, ≥3}
  6:   última jogada (one-hot; zeros no início)
  7:   cor a jogar (uns se pretas a jogar, zeros se brancas)
  8:   plano de uns (ajuda a rede a detetar as margens com zero-padding)

Nota de interpretação da spec: a occupancy "próprias/adversárias" é a união
dos planos de liberdades da respetiva cor (planos 0-2 e 3-5), pelo que planos
dedicados seriam redundantes; o 9.º plano é a cor a jogar, relevante porque as
pretas jogam primeiro e não há komi.

Arquitetura: conv 3x3 64 filtros + 6 blocos residuais de 64 filtros;
policy head com 81 logits (máscara de ilegais aplicada FORA da rede);
value head com tanh.
"""

from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from quelhas import rules

NUM_PLANES = 5
SIZE = rules.SIZE
NUM_CELLS = rules.NUM_CELLS
NUM_ACTIONS = rules.NUM_ACTIONS


def _playable_mask(board: np.ndarray, to_play: int) -> np.ndarray:
    """Casas cobertas por alguma jogada legal de `to_play` (união dos segmentos)."""
    mask = np.zeros(rules.NUM_CELLS, dtype=np.float32)
    vertical = to_play == 1
    for lane_idx, start, run_len in rules._runs(board, vertical):
        if run_len < rules.MIN_LEN:
            continue
        for pos in range(start, start + run_len):
            mask[rules._cell(lane_idx, pos, vertical)] = 1.0
    return mask


def encode_features(board: np.ndarray, to_play: int, last_move: int | None) -> np.ndarray:
    """(5, 10, 10) float32 na perspetiva de `to_play`. last_move: id de ação ou None/-1."""
    planes = np.zeros((NUM_PLANES, NUM_CELLS), dtype=np.float32)
    planes[0] = board != 0
    planes[1] = _playable_mask(board, to_play)
    planes[2] = _playable_mask(board, rules.opponent(to_play))
    if last_move is not None and last_move >= 0:
        for cell in rules.action_cells(int(last_move), rules.opponent(to_play)):
            planes[3, cell] = 1.0
    planes[4] = 1.0
    return planes.reshape(NUM_PLANES, SIZE, SIZE)


class ResidualBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return F.relu(out + x)


class AtariGoNet(nn.Module):
    def __init__(self, channels: int = 64, blocks: int = 6):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv2d(NUM_PLANES, channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
        )
        self.blocks = nn.Sequential(*[ResidualBlock(channels) for _ in range(blocks)])
        self.policy_conv = nn.Sequential(
            nn.Conv2d(channels, 2, 1, bias=False),
            nn.BatchNorm2d(2),
            nn.ReLU(inplace=True),
        )
        self.policy_fc = nn.Linear(2 * NUM_CELLS, NUM_ACTIONS)
        self.value_conv = nn.Sequential(
            nn.Conv2d(channels, 1, 1, bias=False),
            nn.BatchNorm2d(1),
            nn.ReLU(inplace=True),
        )
        self.value_fc = nn.Sequential(
            nn.Linear(NUM_CELLS, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """x: (B, 9, 9, 9). Devolve (policy_logits (B, 81), value (B,))."""
        h = self.blocks(self.stem(x))
        p = self.policy_fc(self.policy_conv(h).flatten(1))
        v = torch.tanh(self.value_fc(self.value_conv(h).flatten(1))).squeeze(-1)
        return p, v


def num_params(net: nn.Module) -> int:
    return sum(p.numel() for p in net.parameters())
