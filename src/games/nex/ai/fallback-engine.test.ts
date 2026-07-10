import { describe, expect, test } from 'bun:test';
import { criarEstadoInicial, executarColocacao, verificarVitoria } from '../logic';
import type { NexState } from '../types';
import { chooseFallbackActionFromState } from './fallback-engine';

describe('Nex fallback engine', () => {
  test('returns a valid placement action on the opening', () => {
    const state = criarEstadoInicial('vs-computador');
    const started = performance.now();
    const action = chooseFallbackActionFromState(state, 'medium', { timeBudgetMs: 100, seed: 7 });

    expect(action).not.toBeNull();
    expect(action?.type).toBe('colocar');
    expect(performance.now() - started).toBeLessThan(300);
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

  test('keeps a legal substitution fallback at N1 when placement is unavailable', () => {
    const state = criarEstadoInicial('vs-computador');
    state.tabuleiro = state.tabuleiro.map((row) => row.map(() => 'branca'));
    state.tabuleiro[0]![0] = 'preta';
    state.tabuleiro[1]![1] = 'neutra';
    state.tabuleiro[2]![2] = 'neutra';
    state.primeiraJogada = false;
    state.jogadorAtual = 'jogador1';

    const action = chooseFallbackActionFromState(state, 'easy', { timeBudgetMs: 5, seed: 3 });

    expect(action?.type).toBe('substituir');
  });
});
