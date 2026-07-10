import { describe, expect, test } from 'bun:test';
import type { AIRequestV1 } from '../../../ai-core';
import { criarEstadoInicial } from '../logic';
import type { GatosCaesState, Posicao } from '../types';
import { GatosCaesV1Adapter, resolveGatosCaesTimeLimitMs } from './v1-adapter';

function makeRequest(
  state: GatosCaesState,
  overrides: Partial<AIRequestV1<GatosCaesState, Posicao>> = {},
): AIRequestV1<GatosCaesState, Posicao> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? 'gc-req-1',
    gameId: 'gatos-caes',
    mode: overrides.mode ?? 'tutor',
    level: overrides.level ?? 3,
    state,
    locale: 'pt-PT',
    ...overrides,
  };
}

describe('GatosCaesV1Adapter', () => {
  test('uses the common N1-N5 budgets and preserves an explicit request budget', () => {
    expect(resolveGatosCaesTimeLimitMs(1)).toBe(100);
    expect(resolveGatosCaesTimeLimitMs(3)).toBe(500);
    expect(resolveGatosCaesTimeLimitMs(5)).toBe(2000);
    expect(resolveGatosCaesTimeLimitMs(5, 37.9)).toBe(37);
  });

  test('maps an initial state into AIResponseV1 mandatory fields', async () => {
    const adapter = new GatosCaesV1Adapter();
    const state = criarEstadoInicial('vs-computador');

    const response = await adapter.compute(makeRequest(state));

    expect(response.gameId).toBe('gatos-caes');
    expect(response.bestMove).not.toBeNull();
    expect(response.topMoves.length).toBeGreaterThan(0);
    expect(response.topMoves.length).toBeLessThanOrEqual(3);
    expect(response.explainText.length).toBeGreaterThan(0);
    expect(response.stats.engine).toBe('ts-fallback');
    expect(response.stats.usedWasm).toBe(false);
    expect(response.warnings).toContain('engine:inline-ts');
    expect(response.pedagogy?.hintLevelSuggested).toBeDefined();
  });

  test('returns no move when no legal houses exist', async () => {
    const filled = Array.from({ length: 8 }, () => Array(8).fill('gato' as const));
    const state: GatosCaesState = {
      ...criarEstadoInicial('vs-computador'),
      tabuleiro: filled,
      jogadasValidas: [],
    };
    const adapter = new GatosCaesV1Adapter();

    const response = await adapter.compute(makeRequest(state));

    expect(response.bestMove).toBeNull();
    expect(response.topMoves).toEqual([]);
    expect(response.explainText).toContain('Sem casas válidas');
    expect(response.pedagogy?.errorCode).toBe('E-GC-01');
  });
});
