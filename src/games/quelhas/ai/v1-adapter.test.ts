import { describe, expect, test } from 'bun:test';
import type { AIRequestV1 } from '../../../ai-core';
import { criarEstadoInicial, colocarSegmento } from '../logic';
import type { QuelhasState, Segmento } from '../types';
import { QuelhasV1Adapter, mapLevelToQuelhasDifficulty } from './v1-adapter';

function makeRequest(
  state: QuelhasState,
  overrides: Partial<AIRequestV1<QuelhasState, Segmento>> = {},
): AIRequestV1<QuelhasState, Segmento> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? 'req-1',
    gameId: 'quelhas',
    mode: overrides.mode ?? 'tutor',
    level: overrides.level ?? 3,
    state,
    timeBudgetMs: overrides.timeBudgetMs,
    legalMoves: overrides.legalMoves,
    locale: 'pt-PT',
    ...overrides,
  };
}

function makeClient(bestMove: Segmento | null, metrics?: Partial<any>) {
  return {
    metrics: {
      lastTimeMs: 12,
      lastDepth: 4,
      lastNodes: 321,
      lastTTHitRate: 0.2,
      lastScore: 42,
      fromBook: false,
      lastEngine: 'ts-fallback',
      lastUsedWasm: false,
      ...metrics,
    },
    async getBestMove() {
      return bestMove;
    },
    cancel() {},
    terminate() {},
  };
}

describe('QuelhasV1Adapter', () => {
  test('maps state into AIResponseV1-style payload with mandatory fields', async () => {
    const state = criarEstadoInicial('vs-computador');
    const bestMove = state.jogadasValidas[0]!;
    const adapter = new QuelhasV1Adapter({ client: makeClient(bestMove) as any });

    const response = await adapter.compute(makeRequest(state));

    expect(response.gameId).toBe('quelhas');
    expect(response.bestMove).toEqual(bestMove);
    expect(response.topMoves.length).toBeGreaterThan(0);
    expect(response.topMoves.length).toBeLessThanOrEqual(3);
    expect(response.explainText.length).toBeGreaterThan(0);
    expect(response.pedagogy?.hintLevelSuggested).toBeDefined();
    expect(response.stats.engine).toBe('ts-fallback');
    expect(response.stats.usedWasm).toBe(false);
    expect(response.warnings?.[0]).toContain('fallback');
  });

  test('reports no-move states as a misère win and returns no top moves', async () => {
    const filled = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => 'ocupada' as const),
    );
    const state: QuelhasState = {
      ...criarEstadoInicial('vs-computador'),
      tabuleiro: filled,
      jogadasValidas: [],
    };
    const adapter = new QuelhasV1Adapter({ client: makeClient(null) as any });

    const response = await adapter.compute(makeRequest(state));

    expect(response.bestMove).toBeNull();
    expect(response.topMoves).toEqual([]);
    expect(response.explainText).toContain('ganhas');
    expect(response.pedagogy?.hintLevelSuggested).toBe('H3');
  });

  test('maps each core level to a distinct search preset', () => {
    expect(mapLevelToQuelhasDifficulty(1)).toBe('beginner');
    expect(mapLevelToQuelhasDifficulty(2)).toBe('easy');
    expect(mapLevelToQuelhasDifficulty(3)).toBe('medium');
    expect(mapLevelToQuelhasDifficulty(4)).toBe('hard');
    expect(mapLevelToQuelhasDifficulty(5)).toBe('master');
  });

  test('forwards the common N1-N5 classroom budget', async () => {
    let receivedBudget = 0;
    const state = criarEstadoInicial('vs-computador');
    const client = {
      ...makeClient(state.jogadasValidas[0]!),
      async getBestMove(_state: QuelhasState, _difficulty: unknown, options?: { timeBudgetMs?: number }) {
        receivedBudget = options?.timeBudgetMs ?? 0;
        return state.jogadasValidas[0]!;
      },
    };

    await new QuelhasV1Adapter({ client: client as any }).compute(makeRequest(state, { level: 1 }));
    expect(receivedBudget).toBe(100);
  });

  test('emits high-severity threat when only one legal move remains', async () => {
    let state = criarEstadoInicial('vs-computador');
    state = colocarSegmento(state, state.jogadasValidas[0]!);
    const forcedMove = state.jogadasValidas[0]!;
    const forcedState: QuelhasState = { ...state, jogadasValidas: [forcedMove] };
    const adapter = new QuelhasV1Adapter({ client: makeClient(forcedMove, { lastEngine: 'rust-wasm', lastUsedWasm: true }) as any });

    const response = await adapter.compute(makeRequest(forcedState, { level: 4 }));

    expect(response.criticalThreats?.[0]?.severity).toBe('high');
    expect(response.stats.engine).toBe('rust-wasm');
    expect(response.stats.usedWasm).toBe(true);
    expect(response.warnings).toBeUndefined();
  });
});
