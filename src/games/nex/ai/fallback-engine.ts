import {
  calcularDistanciaMinima,
  criarEstadoInicial,
  getCorJogador,
  jogadaComputador,
  podeColocar,
  podeSubstituir,
  verificarVitoria,
} from '../logic';
import type { NexState, Posicao } from '../types';
import type { AIDifficulty, NexAiAction, NexPackedState } from './types';

function resolveCurrentPlayer(toPlay: 0 | 1, swapEfetuado: boolean): 'jogador1' | 'jogador2' {
  if (!swapEfetuado) {
    return toPlay === 0 ? 'jogador1' : 'jogador2';
  }
  return toPlay === 0 ? 'jogador2' : 'jogador1';
}

export function unpackPackedState(packed: NexPackedState): NexState {
  const swapDisponivel = (packed.flags & 1) !== 0;
  const swapEfetuado = (packed.flags & 2) !== 0;
  const primeiraJogada = (packed.flags & 4) !== 0;
  const jogadorAtual = resolveCurrentPlayer(packed.toPlay, swapEfetuado);
  const state = criarEstadoInicial('vs-computador');

  for (let x = 0; x < packed.board.length / 11; x++) {
    for (let y = 0; y < 11; y++) {
      const cell = packed.board[x * 11 + y];
      state.tabuleiro[x]![y] =
        cell === 1 ? 'preta' : cell === 2 ? 'branca' : cell === 3 ? 'neutra' : 'vazia';
    }
  }

  return {
    ...state,
    jogadorAtual,
    primeiraJogada,
    swapDisponivel,
    swapEfetuado,
  };
}

function samePos(a: Posicao, b: Posicao): boolean {
  return a.x === b.x && a.y === b.y;
}

function collectDifferences(before: NexState, after: NexState) {
  const currentColor = getCorJogador(before, before.jogadorAtual);
  const ownAdded: Posicao[] = [];
  const neutralAdded: Posicao[] = [];
  const neutralToOwn: Posicao[] = [];
  const ownToNeutral: Posicao[] = [];

  for (let x = 0; x < before.tabuleiro.length; x++) {
    const beforeRow = before.tabuleiro[x];
    const afterRow = after.tabuleiro[x];
    if (!beforeRow || !afterRow) continue;
    for (let y = 0; y < beforeRow.length; y++) {
      const prev = beforeRow[y];
      const next = afterRow[y];
      if (prev === next) continue;
      const pos = { x, y };

      if (prev === 'vazia' && next === currentColor) ownAdded.push(pos);
      else if (prev === 'vazia' && next === 'neutra') neutralAdded.push(pos);
      else if (prev === 'neutra' && next === currentColor) neutralToOwn.push(pos);
      else if (prev === currentColor && next === 'neutra') ownToNeutral.push(pos);
    }
  }

  return { ownAdded, neutralAdded, neutralToOwn, ownToNeutral };
}

export function inferAction(before: NexState, after: NexState): NexAiAction | null {
  if (before.swapDisponivel) {
    return after.swapEfetuado ? { type: 'swap' } : { type: 'recusar_swap' };
  }

  const diff = collectDifferences(before, after);
  if (diff.ownAdded.length === 1 && diff.neutralAdded.length === 1) {
    const own = diff.ownAdded[0];
    const neutral = diff.neutralAdded[0];
    if (!own || !neutral) return null;
    return { type: 'colocar', own, neutral };
  }

  if (diff.neutralToOwn.length === 2 && diff.ownToNeutral.length === 1) {
    const [n1, n2] = diff.neutralToOwn;
    const sacrifice = diff.ownToNeutral[0];
    if (!n1 || !n2 || !sacrifice) return null;
    return { type: 'substituir', n1, n2, sacrifice };
  }

  return null;
}

export function chooseFallbackActionFromState(
  state: NexState,
  difficulty: AIDifficulty,
  options: { timeBudgetMs?: number; seed?: number } = {},
): NexAiAction | null {
  if (state.swapDisponivel) {
    return inferAction(state, jogadaComputador(state));
  }

  const started = Date.now();
  const budgetMs = Math.max(10, Math.trunc(options.timeBudgetMs ?? 100));
  const deadline = started + Math.max(5, budgetMs - 5);
  const cor = getCorJogador(state, state.jogadorAtual);
  const corAdversaria = cor === 'preta' ? 'branca' : 'preta';
  const vazias: Posicao[] = [];
  const neutras: Posicao[] = [];
  const proprias: Posicao[] = [];
  for (let x = 0; x < state.tabuleiro.length; x++) {
    for (let y = 0; y < state.tabuleiro[x]!.length; y++) {
      const pos = { x, y };
      const cell = state.tabuleiro[x]![y];
      if (cell === 'vazia') vazias.push(pos);
      else if (cell === 'neutra') neutras.push(pos);
      else if (cell === cor) proprias.push(pos);
    }
  }

  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] as const;
  const potential = (pos: Posicao, target: 'own' | 'opponent'): number => {
    const targetColor = target === 'own' ? cor : corAdversaria;
    let score = 8 - (Math.abs(pos.x - 5) + Math.abs(pos.y - 5)) * 0.35;
    if (targetColor === 'preta' && (pos.y === 0 || pos.y === 10)) score += 3;
    if (targetColor === 'branca' && (pos.x === 0 || pos.x === 10)) score += 3;
    for (const [dx, dy] of directions) {
      const cell = state.tabuleiro[pos.x + dx]?.[pos.y + dy];
      if (cell === targetColor) score += 5;
      else if (cell === 'neutra') score += 1.5;
    }
    return score;
  };

  const limits: Record<AIDifficulty, { candidates: number; topN: number; substitutions: number }> = {
    easy: { candidates: 3, topN: 5, substitutions: 0 },
    medium: { candidates: 5, topN: 3, substitutions: 2 },
    hard: { candidates: 7, topN: 2, substitutions: 4 },
    master: { candidates: 9, topN: 1, substitutions: 6 },
    champion: { candidates: 15, topN: 1, substitutions: 10 },
  };
  const tuning = limits[difficulty];
  const ownCandidates = [...vazias]
    .sort((a, b) => potential(b, 'own') - potential(a, 'own'))
    .slice(0, tuning.candidates);
  const neutralCandidates = [...vazias]
    .sort((a, b) => potential(b, 'opponent') - potential(a, 'opponent'))
    .slice(0, Math.max(tuning.candidates + 1, 2));
  const scored: Array<{ action: NexAiAction; score: number }> = [];

  if (podeColocar(state.tabuleiro)) {
    // Tactical safety comes before heuristic pruning: a forced connection can
    // sit outside the positional shortlist.
    for (const own of vazias) {
      if (Date.now() >= deadline) break;
      const winBoard = state.tabuleiro.map((row) => [...row]);
      winBoard[own.x]![own.y] = cor;
      if (!verificarVitoria(winBoard, cor)) continue;
      const neutral = neutralCandidates.find((candidate) => !samePos(candidate, own))
        ?? vazias.find((candidate) => !samePos(candidate, own));
      if (neutral) return { type: 'colocar', own, neutral };
    }

    for (const own of ownCandidates) {
      if (Date.now() >= deadline) break;
      const winBoard = state.tabuleiro.map((row) => [...row]);
      winBoard[own.x]![own.y] = cor;
      if (verificarVitoria(winBoard, cor)) {
        const neutral = neutralCandidates.find((candidate) => !samePos(candidate, own))
          ?? vazias.find((candidate) => !samePos(candidate, own));
        if (neutral) return { type: 'colocar', own, neutral };
      }

      for (const neutral of neutralCandidates) {
        if (samePos(own, neutral) || Date.now() >= deadline) continue;
        const board = state.tabuleiro.map((row) => [...row]);
        board[own.x]![own.y] = cor;
        board[neutral.x]![neutral.y] = 'neutra';
        const myDistance = calcularDistanciaMinima(board, cor);
        const opponentDistance = calcularDistanciaMinima(board, corAdversaria);
        scored.push({
          action: { type: 'colocar', own, neutral },
          score: (opponentDistance - myDistance) * 12 + potential(own, 'own') + potential(neutral, 'opponent'),
        });
      }
    }
  }

  if (
    tuning.substitutions > 0 &&
    Date.now() < deadline &&
    podeSubstituir(state.tabuleiro, state.jogadorAtual, state.swapEfetuado)
  ) {
    const conversionCandidates = [...neutras]
      .sort((a, b) => potential(b, 'own') - potential(a, 'own'))
      .slice(0, tuning.substitutions);
    const sacrifices = [...proprias]
      .sort((a, b) => potential(a, 'own') - potential(b, 'own'))
      .slice(0, Math.min(3, tuning.substitutions));
    for (let i = 0; i < conversionCandidates.length; i++) {
      for (let j = i + 1; j < conversionCandidates.length; j++) {
        for (const sacrifice of sacrifices) {
          if (Date.now() >= deadline) break;
          const n1 = conversionCandidates[i]!;
          const n2 = conversionCandidates[j]!;
          const board = state.tabuleiro.map((row) => [...row]);
          board[n1.x]![n1.y] = cor;
          board[n2.x]![n2.y] = cor;
          board[sacrifice.x]![sacrifice.y] = 'neutra';
          const action: NexAiAction = { type: 'substituir', n1, n2, sacrifice };
          if (verificarVitoria(board, cor)) return action;
          scored.push({
            action,
            score:
              (calcularDistanciaMinima(board, corAdversaria) - calcularDistanciaMinima(board, cor)) * 12 +
              potential(n1, 'own') + potential(n2, 'own') - potential(sacrifice, 'own'),
          });
        }
      }
    }
  }

  if (scored.length === 0) {
    if (vazias.length >= 2) return { type: 'colocar', own: vazias[0]!, neutral: vazias[1]! };
    if (
      neutras.length >= 2 &&
      proprias.length >= 1 &&
      podeSubstituir(state.tabuleiro, state.jogadorAtual, state.swapEfetuado)
    ) {
      return {
        type: 'substituir',
        n1: neutras[0]!,
        n2: neutras[1]!,
        sacrifice: proprias[0]!,
      };
    }
    return null;
  }

  scored.sort((a, b) => b.score - a.score);
  const seed = options.seed ?? 0x9E3779B9;
  const random = ((Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0) / 0x1_0000_0000);
  const choice = Math.min(scored.length - 1, Math.floor(random * Math.min(tuning.topN, scored.length)));
  return scored[choice]!.action;
}

export function chooseFallbackActionFromPacked(
  packed: NexPackedState,
  difficulty: AIDifficulty,
  options: { timeBudgetMs?: number; seed?: number } = {},
): NexAiAction | null {
  return chooseFallbackActionFromState(unpackPackedState(packed), difficulty, options);
}
