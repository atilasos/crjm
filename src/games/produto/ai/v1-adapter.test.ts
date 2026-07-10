import { describe, expect, test } from 'bun:test';
import type { AIRequestV1 } from '../../../ai-core';
import { criarEstadoInicial } from '../logic';
import type { JogadaDupla, ProdutoState } from '../types';
import { ProdutoV1Adapter, mapLevelToProdutoDifficulty } from './v1-adapter';

function makeRequest(
  state: ProdutoState,
  overrides: Partial<AIRequestV1<ProdutoState, JogadaDupla>> = {},
): AIRequestV1<ProdutoState, JogadaDupla> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? 'produto-req-1',
    gameId: 'produto',
    mode: overrides.mode ?? 'tutor',
    level: overrides.level ?? 3,
    state,
    locale: 'pt-PT',
    ...overrides,
  };
}

function makeClient(move: any, metrics?: Partial<any>) {
  return {
    idxToPos: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }],
    metrics: {
      lastTimeMs: 17,
      usedWasm: false,
      lastExplain: '',
      ...metrics,
    },
    async getBestMove() {
      return move;
    },
    cancel() {},
    terminate() {},
  };
}

describe('ProdutoV1Adapter', () => {
  test('maps packed worker output into AIResponseV1 with top moves', async () => {
    const adapter = new ProdutoV1Adapter({
      client: makeClient({ posA: 0, colorA: 0, posB: -1, colorB: 0 }) as any,
    });
    const response = await adapter.compute(makeRequest(criarEstadoInicial('vs-computador')));

    expect(response.gameId).toBe('produto');
    expect(response.bestMove).not.toBeNull();
    expect(response.topMoves.length).toBeGreaterThan(0);
    expect(response.stats.engine).toBe('ts-fallback');
    expect(response.pedagogy?.hintLevelSuggested).toBeDefined();
  });

  test('maps difficulty levels onto existing produto presets', () => {
    expect(mapLevelToProdutoDifficulty(1)).toBe('easy');
    expect(mapLevelToProdutoDifficulty(3)).toBe('hard');
    expect(mapLevelToProdutoDifficulty(5)).toBe('max');
  });

  test('forwards the common N1-N5 classroom budget', async () => {
    let receivedBudget = 0;
    const client = {
      ...makeClient({ posA: 0, colorA: 0, posB: -1, colorB: 0 }),
      async getBestMove(_state: ProdutoState, _difficulty: unknown, options?: { timeBudgetMs?: number }) {
        receivedBudget = options?.timeBudgetMs ?? 0;
        return { posA: 0, colorA: 0, posB: -1, colorB: 0 };
      },
    };

    await new ProdutoV1Adapter({ client: client as any }).compute(
      makeRequest(criarEstadoInicial('vs-computador'), { level: 4 }),
    );
    expect(receivedBudget).toBe(1000);
  });
});
