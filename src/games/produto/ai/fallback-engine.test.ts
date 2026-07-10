import { describe, expect, test } from 'bun:test';
import { criarEstadoInicial } from '../logic';
import type { ProdutoState } from '../types';
import { posToKey } from '../types';
import { __internal, chooseFallbackMoveFromState } from './fallback-engine';

describe('Produto fallback engine', () => {
  test('lookahead assumes the opponent chooses the worst reply for us', () => {
    expect(__internal.combineLookaheadScore(10, [-100, 50])).toBe(-70);
  });

  test('terminal scoring applies the official fewer-pieces tiebreak', () => {
    const own = { maiorGrupo: 4, segundoMaiorGrupo: 2, produto: 8, totalPecas: 20 };
    const opponent = { maiorGrupo: 8, segundoMaiorGrupo: 1, produto: 8, totalPecas: 21 };

    expect(__internal.scoreTerminalResult(own, opponent)).toBeGreaterThan(90_000);
    expect(__internal.scoreTerminalResult(opponent, own)).toBeLessThan(-90_000);
  });

  test('lookahead inspects the strongest opponent replies first', () => {
    expect(__internal.rankOpponentScores([1, 9, -4, 5], 2)).toEqual([9, 5]);
  });

  test('prefers central opening control on first move', () => {
    const state = criarEstadoInicial('vs-computador');
    const move = chooseFallbackMoveFromState(state, 'hard', 123);

    expect(move).not.toBeNull();
    expect(move?.pos1).toEqual({ q: 0, r: 0 });
  });

  test('respects a short classroom budget', () => {
    const state = criarEstadoInicial('vs-computador');
    const started = performance.now();
    const move = chooseFallbackMoveFromState(state, 'max', 123, 50);

    expect(move).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(250);
  });

  test('can sabotage the opponent by merging white groups into one product-zero chain', () => {
    const state = criarEstadoInicial('vs-computador');
    const board = { ...state.tabuleiro };
    board[posToKey({ q: -1, r: 0 })] = 'branca';
    board[posToKey({ q: 1, r: 0 })] = 'branca';
    board[posToKey({ q: 0, r: -2 })] = 'preta';
    board[posToKey({ q: 0, r: 2 })] = 'preta';

    const scenario: ProdutoState = {
      ...state,
      primeiraJogada: false,
      tabuleiro: board,
      jogadorAtual: 'jogador1',
      casasVazias: state.casasVazias.filter((pos) => board[posToKey(pos)] === 'vazia'),
    };

    const move = chooseFallbackMoveFromState(scenario, 'hard', 321);

    expect(move).not.toBeNull();
    expect([move?.cor1, move?.cor2]).toContain('branca');
    expect(
      [move?.pos1, move?.pos2].some((pos) => pos && posToKey(pos) === posToKey({ q: 0, r: 0 })),
    ).toBe(true);
  });
});
