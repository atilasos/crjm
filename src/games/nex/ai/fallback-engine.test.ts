import { describe, expect, test } from 'bun:test';
import { criarEstadoInicial, executarColocacao, verificarVitoria } from '../logic';
import type { NexState } from '../types';
import { chooseFallbackActionFromState } from './fallback-engine';

describe('Nex fallback engine', () => {
  test('returns a valid placement action on the opening', () => {
    const state = criarEstadoInicial('vs-computador');
    const action = chooseFallbackActionFromState(state, 'medium');

    expect(action).not.toBeNull();
    expect(action?.type).toBe('colocar');
  });

  test('finds an immediate winning placement for black', () => {
    const state = criarEstadoInicial('vs-computador');
    const board = state.tabuleiro.map((row) => [...row]);
    for (let y = 0; y < 10; y++) {
      board[5]![y] = 'preta';
    }
    const scenario: NexState = {
      ...state,
      tabuleiro: board,
      primeiraJogada: false,
      swapDisponivel: false,
      jogadorAtual: 'jogador1',
    };

    const action = chooseFallbackActionFromState(scenario, 'hard');

    expect(action).not.toBeNull();
    expect(action?.type).toBe('colocar');
    if (action?.type === 'colocar') {
      const nextState = executarColocacao(scenario, {
        tipo: 'colocacao',
        posPropria: action.own,
        posNeutra: action.neutral,
      });
      expect(verificarVitoria(nextState.tabuleiro, 'preta')).toBe(true);
    }
  });
});
