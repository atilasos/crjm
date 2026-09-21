import { describe, expect, test } from 'bun:test';
import type { AIResponseV1 } from '../../../ai-core';
import type { NexState } from '../types';
import type { NexAiAction } from './types';
import { criarEstadoInicial } from '../logic';
import { buildQuickReviewItems, resolveHintLevel } from './pedagogy-mvp';

function makeResponse(
  overrides: Partial<AIResponseV1<NexAiAction, NexState>> = {},
): AIResponseV1<NexAiAction, NexState> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? 'nex-response',
    gameId: 'nex',
    mode: 'tutor',
    bestMove: overrides.bestMove ?? {
      type: 'colocar',
      own: { x: 4, y: 4 },
      neutral: { x: 5, y: 4 },
    },
    topMoves: overrides.topMoves ?? [],
    explainText: overrides.explainText ?? 'A neutra deve bloquear a diagonal rival enquanto alongas a tua ligação.',
    confidence: overrides.confidence ?? 0.63,
    stats: overrides.stats ?? {
      elapsedMs: 18,
      usedWasm: false,
      engine: 'ts-fallback',
    },
    predictedState: overrides.predictedState ?? criarEstadoInicial('vs-computador'),
    pedagogy: overrides.pedagogy ?? {
      hintLevelSuggested: 'H2',
    },
  };
}

describe('Nex pedagogy MVP', () => {
  test('prefers suggested hint level when available', () => {
    const response = makeResponse({
      pedagogy: {
        hintLevelSuggested: 'H1',
      },
    });

    expect(resolveHintLevel(response, 'H3')).toBe('H1');
  });

  test('falls back to current level when suggestion is absent', () => {
    expect(resolveHintLevel(makeResponse({ pedagogy: {} }), 'H2')).toBe('H2');
  });

  test('builds a compact quick review from weakest + latest moments', () => {
    const review = buildQuickReviewItems([
      makeResponse({ requestId: 'one', confidence: 0.28, explainText: 'Bloqueia primeiro a diagonal curta do adversário.' }),
      makeResponse({ requestId: 'two', confidence: 0.84, explainText: 'Usa a neutra para fechar a ponte central.' }),
    ]);

    expect(review).toHaveLength(2);
    expect(review[1]?.insight).toBe('Usa a neutra para fechar a ponte central.');
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
