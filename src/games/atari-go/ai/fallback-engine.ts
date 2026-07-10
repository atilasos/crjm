import type { DifficultyLevel } from '../../../ai-core/types';
import {
  calcularJogadasValidas,
  colocarPedra,
  encontrarGrupo,
  encontrarGruposEmAtari,
} from '../logic';
import type { AtariGoState, Celula, Posicao } from '../types';
import type { AtariGoPackedState } from './types';

interface FallbackPolicy {
  evalCap: number;
  blunderRate: number;
  candidateFrontier: number;
  replyCap: number;
}

const POLICIES: Record<DifficultyLevel, FallbackPolicy> = {
  1: { evalCap: 6, blunderRate: 0.7, candidateFrontier: 3, replyCap: 0 },
  2: { evalCap: 12, blunderRate: 0.4, candidateFrontier: 4, replyCap: 0 },
  3: { evalCap: 20, blunderRate: 0.15, candidateFrontier: 6, replyCap: 0 },
  4: { evalCap: 32, blunderRate: 0.04, candidateFrontier: 8, replyCap: 6 },
  5: { evalCap: 48, blunderRate: 0, candidateFrontier: 12, replyCap: 12 },
};

function idxToPos(index: number): Posicao {
  return { linha: Math.floor(index / 9), coluna: index % 9 };
}

function posToIdx(pos: Posicao): number {
  return pos.linha * 9 + pos.coluna;
}

function makeRng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function distanceToCenter(move: Posicao): number {
  return Math.abs(move.linha - 4) + Math.abs(move.coluna - 4);
}

function getColor(player: AtariGoState['jogadorAtual']): 'preta' | 'branca' {
  return player === 'jogador1' ? 'preta' : 'branca';
}

function opponent(player: AtariGoState['jogadorAtual']): AtariGoState['jogadorAtual'] {
  return player === 'jogador1' ? 'jogador2' : 'jogador1';
}

function scoreMove(state: AtariGoState, move: Posicao): { score: number; next: AtariGoState } {
  const next = colocarPedra(state, move);
  const ownColor = getColor(state.jogadorAtual);
  const opponentColor = ownColor === 'preta' ? 'branca' : 'preta';
  const winningStatus = state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  if (next.estado === winningStatus) return { score: 100_000, next };

  const ownGroup = encontrarGrupo(next.tabuleiro, move);
  const opponentAtari = encontrarGruposEmAtari(next.tabuleiro, opponentColor).length;
  const score =
    (ownGroup?.liberdades.length ?? 0) * 8 +
    opponentAtari * 45 -
    distanceToCenter(move) * 1.5;
  return { score, next };
}

function applySafetyLookahead(
  baseScore: number,
  next: AtariGoState,
  policy: FallbackPolicy,
  deadline: number,
): number {
  if (policy.replyCap === 0 || next.estado !== 'a-jogar') return baseScore;
  const replies = [...next.jogadasValidas]
    .sort((a, b) => distanceToCenter(a) - distanceToCenter(b));
  for (const reply of replies) {
    if (Date.now() >= deadline) break;
    const replyResult = scoreMove(next, reply);
    if (replyResult.score >= 100_000) return baseScore - 100_000;
  }
  return baseScore;
}

export function chooseFallbackMoveIndex(
  state: AtariGoState,
  options: { level?: DifficultyLevel; seed?: number; timeBudgetMs?: number } = {},
): number | null {
  const level = options.level ?? 3;
  const policy = POLICIES[level];
  const legalMoves = state.jogadasValidas.length > 0
    ? state.jogadasValidas
    : calcularJogadasValidas(state.tabuleiro, state.jogadorAtual);
  if (legalMoves.length === 0) return null;

  const deadline = Date.now() + Math.max(1, Math.trunc(options.timeBudgetMs ?? 500));
  const baseDeadline = policy.replyCap > 0
    ? Date.now() + Math.max(1, Math.trunc((options.timeBudgetMs ?? 500) * 0.55))
    : deadline;
  const ordered = [...legalMoves].sort((a, b) => distanceToCenter(a) - distanceToCenter(b));
  const evaluated: Array<{ move: Posicao; score: number; next: AtariGoState }> = [];

  for (const move of ordered) {
    if (evaluated.length >= policy.evalCap || (evaluated.length > 0 && Date.now() >= baseDeadline)) break;
    const result = scoreMove(state, move);
    if (result.score >= 100_000) return posToIdx(move);
    evaluated.push({
      move,
      score: result.score,
      next: result.next,
    });
  }

  if (evaluated.length === 0) return posToIdx(ordered[0]!);
  evaluated.sort((a, b) => b.score - a.score);
  if (policy.replyCap > 0) {
    for (const candidate of evaluated.slice(0, policy.candidateFrontier)) {
      if (Date.now() >= deadline) break;
      candidate.score = applySafetyLookahead(candidate.score, candidate.next, policy, deadline);
    }
    evaluated.sort((a, b) => b.score - a.score);
  }
  const rng = makeRng(options.seed ?? 0xA7A71);
  let rank = 0;
  if (rng() < policy.blunderRate && evaluated.length > 1) {
    rank = 1 + Math.floor(rng() * Math.min(policy.candidateFrontier - 1, evaluated.length - 1));
  }
  return posToIdx(evaluated[rank]?.move ?? evaluated[0]!.move);
}

export function unpackPackedState(packed: AtariGoPackedState): AtariGoState {
  const tabuleiro: Celula[][] = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => 'vazia' as Celula)
  );
  for (let index = 0; index < packed.board.length; index++) {
    const pos = idxToPos(index);
    const value = packed.board[index];
    tabuleiro[pos.linha]![pos.coluna] = value === 1 ? 'preta' : value === 2 ? 'branca' : 'vazia';
  }
  const jogadorAtual = packed.toPlay === 0 ? 'jogador1' : 'jogador2';
  return {
    tabuleiro,
    modo: 'vs-computador',
    jogadorAtual,
    estado: 'a-jogar',
    jogadasValidas: calcularJogadasValidas(tabuleiro, jogadorAtual),
    ultimaJogada: null,
    pedrasCapturadas: { pretas: 0, brancas: 0 },
  };
}

export function chooseFallbackMoveIndexFromPacked(
  packed: AtariGoPackedState,
  options: { level?: DifficultyLevel; seed?: number; timeBudgetMs?: number } = {},
): number | null {
  return chooseFallbackMoveIndex(unpackPackedState(packed), options);
}

export const __internal = { policies: POLICIES };
