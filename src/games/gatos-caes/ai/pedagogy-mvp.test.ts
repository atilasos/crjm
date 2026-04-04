import { describe, expect, test } from 'bun:test';
import type { AIResponseV1 } from '../../../ai-core';
import type { GatosCaesState, Posicao } from '../types';
import { criarEstadoInicial } from '../logic';
import { buildQuickReviewItems, resolveHintLevel } from './pedagogy-mvp';

function makeResponse(
  overrides: Partial<AIResponseV1<Posicao, GatosCaesState>> = {},
): AIResponseV1<Posicao, GatosCaesState> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? 'gc-response',
    gameId: 'gatos-caes',
    mode: 'tutor',
    bestMove: overrides.bestMove ?? { linha: 3, coluna: 3 },
    topMoves: overrides.topMoves ?? [],
    explainText: overrides.explainText ?? 'Escolhe a casa que te deixa mais respostas.',
    confidence: overrides.confidence ?? 0.62,
    stats: overrides.stats ?? {
      elapsedMs: 12,
      usedWasm: false,
      engine: 'ts-fallback',
    },
    predictedState: overrides.predictedState ?? criarEstadoInicial('vs-computador'),
    pedagogy: overrides.pedagogy ?? {
      hintLevelSuggested: 'H2',
    },
  };
}

describe('Gatos & Cães pedagogy MVP', () => {
  test('prefers suggested hint level when available', () => {
    const response = makeResponse({
      pedagogy: {
        hintLevelSuggested: 'H3',
      },
    });

    expect(resolveHintLevel(response, 'H1')).toBe('H3');
  });

  test('falls back to current level when suggestion is absent', () => {
    expect(resolveHintLevel(makeResponse({ pedagogy: {} }), 'H2')).toBe('H2');
  });

  test('builds a compact quick review from weakest + latest moments', () => {
    const review = buildQuickReviewItems([
      makeResponse({ requestId: 'one', confidence: 0.35, explainText: 'Momento mais difícil.' }),
      makeResponse({ requestId: 'two', confidence: 0.74, explainText: 'Momento mais recente.' }),
    ]);

    expect(review).toHaveLength(2);
    expect(review[0]?.title).toBe('Momento 1');
  });
});
