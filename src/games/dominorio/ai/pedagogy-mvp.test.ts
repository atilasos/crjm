import { describe, expect, test } from 'bun:test';
import type { AIResponseV1 } from '../../../ai-core';
import type { DominorioState, Domino } from '../types';
import { buildQuickReviewItems, computeAdaptiveHintLevel } from './pedagogy-mvp';

function makeResponse(
  overrides: Partial<AIResponseV1<Domino, DominorioState>> = {},
): AIResponseV1<Domino, DominorioState> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? 'req-1',
    gameId: 'dominorio',
    mode: 'tutor',
    bestMove: null,
    topMoves: [],
    explainText: overrides.explainText ?? 'Feedback curto.',
    confidence: overrides.confidence ?? 0.5,
    pedagogy: overrides.pedagogy,
    criticalThreats: overrides.criticalThreats,
    stats: {
      elapsedMs: 10,
      usedWasm: false,
      engine: 'ts-fallback',
    },
  };
}

describe('dominorio pedagogy MVP', () => {
  test('escalates hint level when struggle streak and low confidence are present', () => {
    const response = makeResponse({
      confidence: 0.32,
      pedagogy: {
        hintLevelSuggested: 'H2',
      },
    });

    const next = computeAdaptiveHintLevel(response, 'H2', {
      struggleStreak: 2,
      stableStreak: 0,
      h3Streak: 1,
    });

    expect(next).toBe('H3');
  });

  test('de-escalates hint level when learner is stable and confident', () => {
    const response = makeResponse({
      confidence: 0.82,
      pedagogy: {
        hintLevelSuggested: 'H2',
      },
    });

    const next = computeAdaptiveHintLevel(response, 'H2', {
      struggleStreak: 0,
      stableStreak: 3,
      h3Streak: 0,
    });

    expect(next).toBe('H1');
  });

  test('builds a lightweight review with at most two moments', () => {
    const review = buildQuickReviewItems([
      makeResponse({ requestId: 'r1', confidence: 0.3, explainText: 'Erro de corredor.' }),
      makeResponse({ requestId: 'r2', confidence: 0.7, explainText: 'Boa recuperação.' }),
      makeResponse({ requestId: 'r3', confidence: 0.9, explainText: 'Final estável.' }),
    ]);

    expect(review.length).toBeLessThanOrEqual(2);
    expect(review[0]?.title).toBe('Momento 1');
    expect(review.some((item) => item.insight.includes('Erro de corredor.'))).toBe(true);
    expect(review.some((item) => item.insight.includes('Final estável.'))).toBe(true);
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

