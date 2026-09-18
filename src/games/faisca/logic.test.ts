import { describe, expect, test } from 'bun:test';
import { criarEstadoInicial, colocarPeca } from './logic';
import type { Casa, Distancia, Jogada } from './types';

function casa(coordinate: string): Casa {
  return { linha: 5 - Number(coordinate[1]), coluna: coordinate.charCodeAt(0) - 97 };
}

function move(from: string, to: string): Jogada {
  const start = casa(from), end = casa(to);
  return {
    casa: start,
    distancia: (Math.abs(end.linha - start.linha) + Math.abs(end.coluna - start.coluna)) as Distancia,
    direcao: end.linha < start.linha ? 'cima' : end.linha > start.linha ? 'baixo' : end.coluna < start.coluna ? 'esquerda' : 'direita',
  };
}

describe('partida local de Faísca', () => {
  test('Azul abre numa casa livre, consome uma peça e indica a casa de Vermelho', () => {
    const initial = criarEstadoInicial();
    expect(initial.tabuleiro).toHaveLength(5);
    expect(initial.tabuleiro.every(row => row.length === 6 && row.every(cell => cell === null))).toBe(true);
    expect(initial.jogadorAtual).toBe('jogador1');
    expect(initial.reservas).toEqual({ jogador1: { 1: 5, 2: 5, 3: 5 }, jogador2: { 1: 5, 2: 5, 3: 5 } });
    const next = colocarPeca(initial, { casa: { linha: 2, coluna: 5 }, distancia: 3, direcao: 'esquerda' });
    expect(next.tabuleiro[2]?.[5]).toEqual({ jogador: 'jogador1', distancia: 3, direcao: 'esquerda' });
    expect(next.casaObrigatoria).toEqual({ linha: 2, coluna: 2 });
    expect(next.jogadorAtual).toBe('jogador2');
    expect(next.reservas.jogador1[3]).toBe(4);
    expect(initial.reservas.jogador1[3]).toBe(5);
  });

  test('recusa abertura fora do tabuleiro, casa errada e destino ocupado sem alterar turno ou reservas', () => {
    const initial = criarEstadoInicial();
    expect(colocarPeca(initial, move('a1', 'a0'))).toEqual(initial);
    expect(colocarPeca(initial, move('a0', 'a1'))).toEqual(initial);
    const next = colocarPeca(initial, move('a1', 'b1'));
    expect(colocarPeca(next, move('c1', 'd1'))).toEqual(next);
    expect(colocarPeca(next, move('b1', 'a1'))).toEqual(next);
  });

  test('reproduz o exemplo do regulamento, com saltos, alvo b3 e reservas finais', () => {
    const sequence = ['f3', 'c3', 'c1', 'f1', 'f2', 'c2', 'c5', 'f5', 'f4', 'c4', 'a4', 'a2', 'a5', 'b5', 'b4', 'd4', 'd1', 'e1', 'b1', 'b2', 'b3'];
    let state = criarEstadoInicial();
    for (let i = 0; i < sequence.length - 1; i++) {
      const next = colocarPeca(state, move(sequence[i]!, sequence[i + 1]!));
      expect(next).not.toEqual(state);
      expect(next.casaObrigatoria).toEqual(casa(sequence[i + 1]!));
      state = next;
    }
    expect(state.tabuleiro.flat().filter(Boolean)).toHaveLength(20);
    expect(state.casaObrigatoria).toEqual(casa('b3'));
    expect(state.reservas).toEqual({ jogador1: { 1: 2, 2: 3, 3: 0 }, jogador2: { 1: 1, 2: 3, 3: 1 } });
    expect(state.estado).toBe('a-jogar');
    expect(colocarPeca(state, move('b3', 'e3'))).toEqual(state);
  });

  test('perde quem não tem peças e não se pode jogar após o resultado', () => {
    const state = criarEstadoInicial();
    state.reservas.jogador2 = { 1: 0, 2: 0, 3: 0 };
    const finished = colocarPeca(state, move('a1', 'b1'));
    expect(finished.estado).toBe('vitoria-jogador1');
    expect(colocarPeca(finished, move('b1', 'c1'))).toEqual(finished);
  });

  test('perde quem não pode apontar para uma casa livre mesmo tendo peças', () => {
    // Apenas a1 e b1 livres: depois de a1 → b1 não resta destino.
    const state = criarEstadoInicial();
    state.tabuleiro = state.tabuleiro.map(row => row.map(() => ({ jogador: 'jogador1', distancia: 1, direcao: 'direita' })));
    state.tabuleiro[4]![0] = null;
    state.tabuleiro[4]![1] = null;
    const finished = colocarPeca(state, move('a1', 'b1'));
    expect(finished.estado).toBe('vitoria-jogador1');
    expect(finished.reservas.jogador2).toEqual({ 1: 5, 2: 5, 3: 5 });
    state.jogadorAtual = 'jogador2';
    expect(colocarPeca(state, move('a1', 'b1')).estado).toBe('vitoria-jogador2');
  });
});
