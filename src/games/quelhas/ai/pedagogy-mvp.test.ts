import { describe, expect, test } from 'bun:test';
import type { AIResponseV1 } from '../../../ai-core';
import type { QuelhasState, Segmento } from '../types';
import { buildQuickReviewItems, resolveHintLevel } from './pedagogy-mvp';

function makeState(): QuelhasState {
  return {
    tabuleiro: Array.from({ length: 10 }, () => Array(10).fill('vazia' as const)),
    modo: 'vs-computador',
    jogadorAtual: 'jogador1',
    estado: 'a-jogar',
    segmentoPreview: null,
    jogadasValidas: [],
    primeiraJogada: true,
    orientacaoJogador1: 'vertical',
    orientacaoJogador2: 'horizontal',
    trocaDisponivel: false,
    trocaEfetuada: false,
  };
}

function makeMove(index: number): Segmento {
  return {
    inicio: { linha: index, coluna: index },
    comprimento: 2,
    orientacao: 'vertical',
  };
}

function makeResponse(
  overrides: Partial<AIResponseV1<Segmento, QuelhasState>> = {},
): AIResponseV1<Segmento, QuelhasState> {
  return {
    version: '1.0',
    requestId: overrides.requestId ?? `req-${Math.random()}`,
    gameId: 'quelhas',
    mode: 'tutor',
    bestMove: overrides.bestMove ?? makeMove(0),
    topMoves: overrides.topMoves ?? [],
    explainText: overrides.explainText ?? 'Fecha pouco espaço e mantém opções.',
    confidence: overrides.confidence ?? 0.5,
    pedagogy: overrides.pedagogy,
    stats: overrides.stats ?? {
      elapsedMs: 12,
      usedWasm: false,
      engine: 'ts-fallback',
    },
  };
}

describe('Quelhas pedagogy MVP', () => {
  test('prefers the suggested hint level when present', () => {
    const response = makeResponse({
      pedagogy: { hintLevelSuggested: 'H3' },
    });

    expect(resolveHintLevel(response, 'H1')).toBe('H3');
  });

  test('falls back to current level when no hint is suggested', () => {
    expect(resolveHintLevel(makeResponse(), 'H2')).toBe('H2');
  });

  test('builds a compact quick review from weakest + latest moments', () => {
    const review = buildQuickReviewItems([
      makeResponse({ requestId: 'r1', confidence: 0.22, explainText: 'Evita fechar o centro já.' }),
      makeResponse({ requestId: 'r2', confidence: 0.66, explainText: 'Mantém a faixa da esquerda aberta.' }),
      makeResponse({ requestId: 'r3', confidence: 0.91, explainText: 'Segmento curto para o final.' }),
    ]);

    expect(review).toHaveLength(2);
    expect(review[0]?.title).toBe('Momento 1');
    expect(review.map((item) => item.insight)).toContain('Evita fechar o centro já.');
    expect(review.map((item) => item.insight)).toContain('Segmento curto para o final.');
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
