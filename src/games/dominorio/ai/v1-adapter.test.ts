import { describe, expect, test } from 'bun:test';
import type { AIRequestV1 } from '../../../ai-core';
import { criarEstadoInicial } from '../logic';
import type { Celula, DominorioState, Domino } from '../types';
import {
  DominorioV1Adapter,
  mapLevelToLegacyDifficulty,
  resolveLegacyTimeBudgetMs,
} from './v1-adapter';
import { DIFFICULTY_PRESETS } from './types';

function buildRequest(state: DominorioState): AIRequestV1<DominorioState, Domino> {
  return {
    version: '1.0',
    requestId: 'req-dominorio-v1-test',
    gameId: 'dominorio',
    mode: 'tutor',
    level: 3,
    state,
    locale: 'pt-PT',
  };
}

describe('DominorioV1Adapter', () => {
  test('maps initial state into AIResponseV1 with mandatory fields', async () => {
    const adapter = new DominorioV1Adapter();
    const state = criarEstadoInicial('vs-computador');

    const response = await adapter.compute(buildRequest(state));
    adapter.terminate();

    expect(response.version).toBe('1.0');
    expect(response.gameId).toBe('dominorio');
    expect(response.bestMove).not.toBeNull();
    expect(response.topMoves.length).toBeGreaterThan(0);
    expect(response.topMoves.length).toBeLessThanOrEqual(3);
    expect(response.topMoves[0].rank).toBe(1);
    expect(response.explainText.length).toBeGreaterThan(0);
    expect(response.explainText.length).toBeLessThanOrEqual(160);
    expect(response.pedagogy?.errorCode).toBeDefined();
    expect(response.pedagogy?.hintLevelSuggested).toBeDefined();
    expect(response.stats.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(response.stats.usedWasm).toBe(false);
    expect(response.stats.engine).toBe('ts-fallback');
  });

  test('returns null bestMove and empty topMoves when no legal moves exist', async () => {
    const adapter = new DominorioV1Adapter();
    const fullBoard: Celula[][] = Array.from({ length: 8 }, () =>
      Array(8).fill('ocupada-vertical' as const),
    );
    const noMovesState: DominorioState = {
      tabuleiro: fullBoard,
      modo: 'vs-computador',
      jogadorAtual: 'jogador1',
      estado: 'a-jogar',
      dominoPreview: null,
      jogadasValidas: [],
      dominosColocados: [],
    };

    const response = await adapter.compute(buildRequest(noMovesState));
    adapter.terminate();

    expect(response.bestMove).toBeNull();
    expect(response.topMoves).toEqual([]);
    expect(response.explainText).toContain('Sem jogadas válidas nesta posição.');
    expect(response.criticalThreats).toEqual([]);
    expect(response.pedagogy?.errorCode).toBe('E-DO-02');
    expect(response.pedagogy?.hintLevelSuggested).toBe('H3');
  });

  test('emits a minimal critical threat on low-mobility positions', async () => {
    const adapter = new DominorioV1Adapter();
    const board: Celula[][] = Array.from({ length: 8 }, () =>
      Array(8).fill('ocupada-horizontal' as const),
    );
    board[0][0] = 'vazia';
    board[1][0] = 'vazia';

    const lowMobilityState: DominorioState = {
      tabuleiro: board,
      modo: 'vs-computador',
      jogadorAtual: 'jogador1',
      estado: 'a-jogar',
      dominoPreview: null,
      jogadasValidas: [],
      dominosColocados: [],
    };

    const response = await adapter.compute(buildRequest(lowMobilityState));
    adapter.terminate();

    expect(response.topMoves.length).toBe(1);
    expect(response.criticalThreats?.length).toBe(1);
    expect(response.criticalThreats?.[0].id).toBe('low-mobility');
    expect(response.criticalThreats?.[0].severity).toBe('high');
    expect(response.criticalThreats?.[0].counterMove).toEqual(response.topMoves[0].move);
    expect(response.pedagogy?.errorCode).toBe('E-DO-02');
    expect(response.pedagogy?.hintLevelSuggested).toBe('H3');
  });

  test('classifies endgame instability as E-DO-03', async () => {
    const adapter = new DominorioV1Adapter();
    const board: Celula[][] = Array.from({ length: 8 }, () =>
      Array(8).fill('ocupada-vertical' as const),
    );
    board[0][0] = 'vazia';
    board[0][1] = 'vazia';
    board[1][0] = 'vazia';
    board[1][1] = 'vazia';
    board[2][0] = 'vazia';
    board[2][1] = 'vazia';
    board[3][0] = 'vazia';
    board[3][1] = 'vazia';

    const endgameState: DominorioState = {
      tabuleiro: board,
      modo: 'vs-computador',
      jogadorAtual: 'jogador1',
      estado: 'a-jogar',
      dominoPreview: null,
      jogadasValidas: [],
      dominosColocados: [],
    };

    const response = await adapter.compute(buildRequest(endgameState));
    adapter.terminate();

    expect(response.pedagogy?.errorCode).toBe('E-DO-03');
    expect(response.explainText).toContain('final');
  });

  test('maps core levels to legacy difficulty buckets', () => {
    expect(mapLevelToLegacyDifficulty(1)).toBe('easy');
    expect(mapLevelToLegacyDifficulty(2)).toBe('easy');
    expect(mapLevelToLegacyDifficulty(3)).toBe('medium');
    expect(mapLevelToLegacyDifficulty(4)).toBe('hard');
    expect(mapLevelToLegacyDifficulty(5)).toBe('hard');
  });

  test('separates hard budgets between level 4 and 5', () => {
    expect(resolveLegacyTimeBudgetMs(4, 'hard')).toBe(
      Math.round(DIFFICULTY_PRESETS.hard.timeBudgetMs * 0.9),
    );
    expect(resolveLegacyTimeBudgetMs(5, 'hard')).toBe(
      Math.round(DIFFICULTY_PRESETS.hard.timeBudgetMs * 1.15),
    );
  });

  test('keeps explicit request time budget when provided', () => {
    expect(resolveLegacyTimeBudgetMs(5, 'hard', 1234.8)).toBe(1234);
  });
});
