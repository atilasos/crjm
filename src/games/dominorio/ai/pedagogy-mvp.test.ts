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
});

