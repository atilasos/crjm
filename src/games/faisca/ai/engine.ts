import type { AIRequestV1, AIResponseV1 } from '../../../ai-core/types';
import { colocarPeca, getJogadasValidas } from '../logic';
import type { FaiscaState, Jogada } from '../types';

export type FaiscaLevel = 1 | 2;
// Faísca has its own measured ladder; these budgets do not imply parity with other games.
export const FAISCA_DIFFICULTIES = {
  1: { label: 'Explorar', timeBudgetMs: 5 },
  2: { label: 'Antecipar', timeBudgetMs: 120 },
} as const;

export function computeFaisca(request: AIRequestV1<FaiscaState, Jogada>): AIResponseV1<Jogada> {
  const start = performance.now();
  const level: FaiscaLevel = request.level === 1 ? 1 : 2;
  const budget = Math.max(1, Math.min(request.timeBudgetMs ?? FAISCA_DIFFICULTIES[level].timeBudgetMs, 1000));
  const deadline = start + budget;
  let seed = (request.seed ?? 1) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const moves = getJogadasValidas(request.state);
  // Seeded ordering also breaks ties without a permanent directional bias.
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [moves[i], moves[j]] = [moves[j]!, moves[i]!];
  }
  let bestMove = moves[0] ?? null;
  let nodes = 0, depth = 0;
  const timeout = Symbol('deadline');
  function search(state: FaiscaState, remaining: number, alpha: number, beta: number, ply: number): number {
    if (performance.now() >= deadline) throw timeout;
    nodes++;
    if (state.estado !== 'a-jogar') return -1000 + ply;
    const legal = getJogadasValidas(state);
    if (!legal.length) return -1000 + ply;
    if (remaining === 0) return legal.length;
    let value = -Infinity;
    for (const move of legal) {
      value = Math.max(value, -search(colocarPeca(state, move), remaining - 1, -beta, -alpha, ply + 1));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  if (level === 2 && bestMove) {
    for (let limit = 1; limit <= 10; limit++) {
      let candidate: Jogada = bestMove, score = -Infinity;
      try {
        for (const move of moves) {
          const value = -search(colocarPeca(request.state, move), limit - 1, -Infinity, -score, 1);
          if (value > score) { score = value; candidate = move; }
        }
      } catch (error) {
        if (error !== timeout) throw error;
        break; // Only publish fully completed iterations.
      }
      bestMove = candidate;
      depth = limit;
      if (Math.abs(score) > 900) break;
      moves.splice(moves.indexOf(candidate), 1);
      moves.unshift(candidate);
    }
  }
  return {
    version: '1.0', requestId: request.requestId, gameId: 'faisca', mode: request.mode,
    bestMove, topMoves: bestMove ? [{ move: bestMove, rank: 1 }] : [], explainText: '', criticalThreats: [],
    stats: { elapsedMs: performance.now() - start, depth, nodes, usedWasm: false, engine: 'ts-fallback' },
  };
}
