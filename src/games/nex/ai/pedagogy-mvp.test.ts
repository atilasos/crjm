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
});
