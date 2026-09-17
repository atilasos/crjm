import type { AIRequestV1, AIResponseV1 } from '../../../ai-core/types';
import { aplicarJogada, getJogadasValidas } from '../logic';
import { LIGACOES, NOS } from '../board';
import type { Cor, YMove, YState } from '../types';

export type YLevel = 1 | 2;
export const Y_DIFFICULTIES = {
  1: { label: 'Explorar', timeBudgetMs: 5 },
  2: { label: 'Antecipar', timeBudgetMs: 120 },
} as const;

// Adjacency comes exclusively from the validated drawing, never screen distance.
const indices = new Map(NOS.map((node, index) => [node.id, index]));
const neighbors = NOS.map(() => [] as number[]);
for (const [a, b] of LIGACOES) {
  neighbors[indices.get(a)!]!.push(indices.get(b)!);
  neighbors[indices.get(b)!]!.push(indices.get(a)!);
}
const sides = ['superior', 'esquerdo', 'direito'] as const;

/** Approximate remaining connection cost through a common meeting point.
 * Enemy stones are impassable; friendly stones cost zero. This is a heuristic,
 * not a proof of connection: only the public rules adjudicate wins. */
function connectionCost(state: YState, color: Cor): number {
  const costs = NOS.map(node => state.tabuleiro[node.id] === color ? 0 : state.tabuleiro[node.id] === null ? 1 : 1000);
  const distances = sides.map(side => {
    const dist: number[] = NOS.map((node, i) => node.lados.includes(side) ? costs[i]! : 1000);
    const visited = new Uint8Array(NOS.length);
    for (let step = 0; step < NOS.length; step++) {
      let current = -1, best = 1000;
      for (let i = 0; i < NOS.length; i++) {
        if (!visited[i] && dist[i]! < best) { best = dist[i]!; current = i; }
      }
      if (current < 0) break;
      visited[current] = 1;
      for (const next of neighbors[current]!) dist[next] = Math.min(dist[next]!, best + costs[next]!);
    }
    return dist;
  });
  return Math.min(...NOS.map((_, i) => costs[i] === 1000 ? 1000
    : distances[0]![i]! + distances[1]![i]! + distances[2]![i]! - 2 * costs[i]!));
}

export function computeY(request: AIRequestV1<YState, YMove>): AIResponseV1<YMove> {
  const start = performance.now();
  let seed = (request.seed ?? 1) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const moves = getJogadasValidas(request.state);
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [moves[i], moves[j]] = [moves[j]!, moves[i]!];
  }
  let bestMove = moves[0] ?? null;
  let nodes = 0;
  if (request.level > 1 && bestMove) {
    const deadline = start + Math.max(1, Math.min(request.timeBudgetMs ?? Y_DIFFICULTIES[2].timeBudgetMs, 1000));
    const player = request.state.jogadorAtual;
    const other = player === 'jogador1' ? 'jogador2' : 'jogador1';
    let bestScore = -Infinity;
    for (const move of moves) {
      if (performance.now() >= deadline) break;
      const next = aplicarJogada(request.state, move);
      nodes++;
      if (next.estado === `vitoria-${player}`) { bestMove = move; break; }
      const own = connectionCost(next, next.cores[player]);
      const opponent = connectionCost(next, next.cores[other]);
      // A one-placement threat outweighs incremental positional progress.
      const score = opponent - own * 1.15 - (opponent <= 1 ? 100 : 0);
      if (score > bestScore) { bestScore = score; bestMove = move; }
    }
  }
  return {
    version: '1.0', requestId: request.requestId, gameId: 'y', mode: request.mode,
    bestMove, topMoves: bestMove ? [{ move: bestMove, rank: 1 }] : [], explainText: '', criticalThreats: [],
    stats: { elapsedMs: performance.now() - start, nodes, usedWasm: false, engine: 'ts-fallback' },
  };
}
