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
});
