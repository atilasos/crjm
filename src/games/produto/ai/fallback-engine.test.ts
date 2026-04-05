import { describe, expect, test } from 'bun:test';
import { criarEstadoInicial } from '../logic';
import type { ProdutoState } from '../types';
import { posToKey } from '../types';
import { chooseFallbackMoveFromState } from './fallback-engine';

describe('Produto fallback engine', () => {
  test('prefers central opening control on first move', () => {
    const state = criarEstadoInicial('vs-computador');
    const move = chooseFallbackMoveFromState(state, 'hard', 123);

    expect(move).not.toBeNull();
    expect(move?.pos1).toEqual({ q: 0, r: 0 });
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
