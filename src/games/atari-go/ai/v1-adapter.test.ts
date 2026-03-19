import { describe, expect, test } from 'bun:test';
import type { AIRequestV1 } from '../../../ai-core';
import { calcularJogadasValidas, criarEstadoInicial } from '../logic';
import type { AtariGoState, Posicao } from '../types';
import {
  AtariGoV1Adapter,
  mapLevelToLegacyDifficulty,
  type AtariGoV1Client,
} from './v1-adapter';
import type { AIDifficulty, AIMetrics } from './types';

class FakeClient implements AtariGoV1Client {
  readonly metrics: AIMetrics;
  private readonly moveIdx: number | null;

  constructor(moveIdx: number | null, metrics: Partial<AIMetrics> = {}) {
    this.moveIdx = moveIdx;
    this.metrics = {
      isThinking: false,
      lastTimeMs: 12,
      usedWasm: false,
      ...metrics,
    };
  }

  async getBestMove(_state: AtariGoState, _difficulty: AIDifficulty): Promise<number | null> {
    return this.moveIdx;
  }

  cancel(): void {
    // noop
  }

  terminate(): void {
    // noop
  }
}

function buildRequest(state: AtariGoState): AIRequestV1<AtariGoState, Posicao> {
  return {
    version: '1.0',
    requestId: 'req-atari-v1-test',
    gameId: 'atari-go',
    mode: 'tutor',
    level: 4,
    state,
    locale: 'pt-PT',
  };
}

describe('AtariGoV1Adapter', () => {
  test('maps state into AIResponseV1 mandatory fields', async () => {
    const state = criarEstadoInicial('vs-computador');
    const adapter = new AtariGoV1Adapter({ client: new FakeClient(40) });

    const response = await adapter.compute(buildRequest(state));

    expect(response.version).toBe('1.0');
    expect(response.gameId).toBe('atari-go');
    expect(response.bestMove).toEqual({ linha: 4, coluna: 4 });
    expect(response.topMoves.length).toBeGreaterThan(0);
    expect(response.topMoves.length).toBeLessThanOrEqual(3);
    expect(response.explainText.length).toBeGreaterThan(0);
    expect(response.explainText.length).toBeLessThanOrEqual(160);
    expect(response.stats.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(response.stats.engine).toBe('ts-fallback');
    expect(response.turningPoints?.length ?? 0).toBeLessThanOrEqual(1);
  });

  test('returns null bestMove and empty topMoves when no legal moves exist', async () => {
    const board = Array.from({ length: 9 }, () => Array(9).fill('preta' as const));
    const noMovesState: AtariGoState = {
      tabuleiro: board,
      modo: 'vs-computador',
      jogadorAtual: 'jogador1',
      estado: 'a-jogar',
      jogadasValidas: [],
      ultimaJogada: null,
      pedrasCapturadas: { pretas: 0, brancas: 0 },
    };
    const adapter = new AtariGoV1Adapter({ client: new FakeClient(null) });

    const response = await adapter.compute(buildRequest(noMovesState));

    expect(response.bestMove).toBeNull();
    expect(response.topMoves).toEqual([]);
    expect(response.criticalThreats).toEqual([]);
    expect(response.turningPoints).toEqual([]);
    expect(response.explainText).toContain('Sem jogadas válidas');
  });

  test('emits critical threat and turning point when opponent has immediate capture', async () => {
    const state = criarEstadoInicial('vs-computador');
    state.tabuleiro[0][0] = 'preta';
    state.tabuleiro[1][0] = 'branca';
    state.jogadorAtual = 'jogador1';
    state.jogadasValidas = calcularJogadasValidas(state.tabuleiro, state.jogadorAtual);

    const adapter = new AtariGoV1Adapter({ client: new FakeClient(1) });
    const response = await adapter.compute(buildRequest(state));

    expect(response.criticalThreats?.length).toBe(1);
    expect(response.criticalThreats?.[0].id).toBe('opponent-immediate-capture');
    expect(response.criticalThreats?.[0].counterMove).toEqual({ linha: 0, coluna: 1 });
    expect(response.turningPoints?.length).toBe(1);
    expect(response.turningPoints?.[0].patternId).toBe('TP-ATARI-DEFENSE');
  });

  test('maps core levels to legacy difficulty buckets', () => {
    expect(mapLevelToLegacyDifficulty(1)).toBe('easy');
    expect(mapLevelToLegacyDifficulty(2)).toBe('easy');
    expect(mapLevelToLegacyDifficulty(3)).toBe('medium');
    expect(mapLevelToLegacyDifficulty(4)).toBe('hard');
    expect(mapLevelToLegacyDifficulty(5)).toBe('very-hard');
  });
});
