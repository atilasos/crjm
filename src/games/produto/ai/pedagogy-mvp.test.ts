import { describe, expect, test } from 'bun:test';
import type { AIResponseV1 } from '../../../ai-core';
import type { JogadaDupla, ProdutoState } from '../types';
import { criarEstadoInicial } from '../logic';
import { buildQuickReviewItems, resolveHintLevel } from './pedagogy-mvp';

function makeResponse(
  overrides: Partial<AIResponseV1<JogadaDupla, ProdutoState>> = {},
): AIResponseV1<JogadaDupla, ProdutoState> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? 'produto-response',
    gameId: 'produto',
    mode: 'tutor',
    bestMove: overrides.bestMove ?? {
      pos1: { q: 0, r: 0 },
      cor1: 'preta',
      pos2: { q: 1, r: -1 },
      cor2: 'branca',
    },
    topMoves: overrides.topMoves ?? [],
    explainText: overrides.explainText ?? 'Cria dois grupos úteis e não os fundas cedo demais.',
    confidence: overrides.confidence ?? 0.62,
    stats: overrides.stats ?? {
      elapsedMs: 15,
      usedWasm: false,
      engine: 'ts-fallback',
    },
    predictedState: overrides.predictedState ?? criarEstadoInicial('vs-computador'),
    pedagogy: overrides.pedagogy ?? {
      hintLevelSuggested: 'H2',
    },
  };
}

describe('Produto pedagogy MVP', () => {
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
      makeResponse({ requestId: 'one', confidence: 0.31, explainText: 'Evita unir cedo os dois maiores grupos.' }),
      makeResponse({ requestId: 'two', confidence: 0.78, explainText: 'Usa uma peça branca para travar o produto rival.' }),
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
