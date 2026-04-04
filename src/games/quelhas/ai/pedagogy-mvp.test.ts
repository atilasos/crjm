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
});
