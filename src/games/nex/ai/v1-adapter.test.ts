import { describe, expect, test } from 'bun:test';
import type { AIRequestV1 } from '../../../ai-core';
import { criarEstadoInicial } from '../logic';
import type { NexState } from '../types';
import { NexV1Adapter, mapLevelToNexDifficulty } from './v1-adapter';

function makeRequest(
  state: NexState,
  overrides: Partial<AIRequestV1<NexState, any>> = {},
): AIRequestV1<NexState, any> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? 'nex-req-1',
    gameId: 'nex',
    mode: overrides.mode ?? 'tutor',
    level: overrides.level ?? 3,
    state,
    locale: 'pt-PT',
    ...overrides,
  };
}

function makeClient(action: any, metrics?: Partial<any>) {
  return {
    metrics: {
      lastTimeMs: 20,
      usedWasm: false,
      ...metrics,
    },
    async getBestAction() {
      return action;
    },
    cancel() {},
    terminate() {},
  };
}

describe('NexV1Adapter', () => {
  test('maps AI actions into AIResponseV1 fields', async () => {
    const adapter = new NexV1Adapter({
      client: makeClient({
        type: 'colocar',
        own: { x: 5, y: 5 },
        neutral: { x: 5, y: 6 },
      }) as any,
    });

    const response = await adapter.compute(makeRequest(criarEstadoInicial('vs-computador')));

    expect(response.gameId).toBe('nex');
    expect(response.bestMove).not.toBeNull();
    expect(response.topMoves.length).toBeGreaterThan(0);
    expect(response.explainText.length).toBeGreaterThan(0);
    expect(response.stats.engine).toBe('ts-fallback');
  });

  test('marks swap turns as critical tutor decisions', async () => {
    const state = criarEstadoInicial('vs-computador');
    state.swapDisponivel = true;

    const adapter = new NexV1Adapter({
      client: makeClient({ type: 'swap' }) as any,
    });
    const response = await adapter.compute(makeRequest(state));

    expect(response.criticalThreats?.[0]?.id).toBe('swap-decision');
    expect(response.pedagogy?.errorCode).toBe('E-NX-01');
  });

  test('reserva o preset champion para N5', () => {
    expect(mapLevelToNexDifficulty(1)).toBe('easy');
    expect(mapLevelToNexDifficulty(3)).toBe('hard');
    expect(mapLevelToNexDifficulty(4)).toBe('master');
    expect(mapLevelToNexDifficulty(5)).toBe('champion');
  });

  test('forwards the common N1-N5 classroom budget', async () => {
    let receivedBudget = 0;
    const client = {
      ...makeClient({ type: 'recusar_swap' }),
      async getBestAction(_state: NexState, _difficulty: unknown, options?: { timeBudgetMs?: number }) {
        receivedBudget = options?.timeBudgetMs ?? 0;
        return null;
      },
    };

    await new NexV1Adapter({ client: client as any }).compute(
      makeRequest(criarEstadoInicial('vs-computador'), { level: 2 }),
    );
    expect(receivedBudget).toBe(250);
  });
});
