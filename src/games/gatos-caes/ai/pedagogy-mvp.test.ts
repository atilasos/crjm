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

  test('returns no review moments for an empty history', () => {
    expect(buildQuickReviewItems([])).toEqual([]);
  });

  test('returns a single moment when weakest and latest are the same response', () => {
    expect(buildQuickReviewItems([makeResponse({ explainText: 'Único momento.' })])).toEqual([
      { title: 'Momento 1', insight: 'Único momento.' },
    ]);
  });

  test('keeps the first confidence tie and the latest response without reordering history', () => {
    const history = [
      makeResponse({ requestId: 'first', confidence: 0.3, explainText: 'Primeiro empate.' }),
      makeResponse({ requestId: 'second', confidence: 0.3, explainText: 'Segundo empate.' }),
      makeResponse({ requestId: 'last', confidence: 0.8, explainText: 'Último momento.' }),
    ];
    const originalOrder = [...history];

    expect(buildQuickReviewItems(history)).toEqual([
      { title: 'Momento 1', insight: 'Primeiro empate.' },
      { title: 'Momento 2', insight: 'Último momento.' },
    ]);
    expect(history).toEqual(originalOrder);
  });

  test('keeps the latest content when selected responses share a request ID', () => {
    expect(buildQuickReviewItems([
      makeResponse({ requestId: 'same', confidence: 0.2, explainText: 'Conteúdo antigo.' }),
      makeResponse({ requestId: 'other', confidence: 0.6, explainText: 'Outro momento.' }),
      makeResponse({ requestId: 'same', confidence: 0.9, explainText: 'Conteúdo recente.' }),
    ])).toEqual([{ title: 'Momento 1', insight: 'Conteúdo recente.' }]);
  });

  test('rejects a nonempty history with a missing selected response', () => {
    const emptySlots = new Array<ReturnType<typeof makeResponse>>(1);
    const missingLatest = [makeResponse()];
    missingLatest.length = 2;

    expect(() => buildQuickReviewItems(emptySlots)).toThrow(TypeError);
    expect(() => buildQuickReviewItems(missingLatest)).toThrow(TypeError);
  });

});
