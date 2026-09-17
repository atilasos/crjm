import { expect, test } from 'bun:test';
import { criarEstadoInicial, aplicarJogada, getJogadasValidas } from '../logic';
import { computeY } from './engine';

test('o pedido local devolve uma ação legal reproduzível sem alterar a posição', () => {
  const state = criarEstadoInicial();
  const before = structuredClone(state);
  const request = { version: '1.0', requestId: 'opening', gameId: 'y', mode: 'competitive', state, level: 1, seed: 31 } as const;
  const response = computeY(request);
  expect(response.requestId).toBe('opening');
  expect(getJogadasValidas(state)).toContainEqual(response.bestMove!);
  expect(computeY(request).bestMove).toEqual(response.bestMove);
  expect(aplicarJogada(state, response.bestMove!).colocacoes).toBe(1);
  expect(state).toEqual(before);
});

test('a IA conclui a ligação vencedora para o participante que recebeu azul na troca', () => {
  let state = aplicarJogada(criarEstadoInicial(), { type: 'place', node: 'A1' });
  state = aplicarJogada(state, { type: 'swap' });
  const path = ['B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8'];
  const replies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];
  for (let i = 0; i < path.length; i++) {
    state = aplicarJogada(state, { type: 'place', node: replies[i]! });
    state = aplicarJogada(state, { type: 'place', node: path[i]! });
  }
  state = aplicarJogada(state, { type: 'place', node: replies.at(-1)! });
  const response = computeY({ version: '1.0', requestId: 'win', gameId: 'y', mode: 'competitive', state, level: 2, seed: 31 });
  expect(aplicarJogada(state, response.bestMove!).estado).toBe('vitoria-jogador2');
});

test('o computador pode trocar ou colocar e completa partidas legais em ambos os lados', () => {
  for (const swapByHuman of [false, true]) {
    let state = aplicarJogada(criarEstadoInicial(), { type: 'place', node: 'A1' });
    if (swapByHuman) state = aplicarJogada(state, { type: 'swap' });
    else {
      const response = computeY({ version: '1.0', requestId: 'swap', gameId: 'y', mode: 'competitive', state, level: 2, seed: 31 });
      expect(response.bestMove).toEqual({ type: 'swap' });
      state = aplicarJogada(state, response.bestMove!);
    }
    expect(state.jogadorAtual).toBe('jogador1');
    expect(state.tabuleiro.A1).toBe('azul');
    for (let ply = 0; state.estado === 'a-jogar' && ply < 93; ply++) {
      const before = structuredClone(state);
      const response = computeY({ version: '1.0', requestId: `move-${ply}`, gameId: 'y', mode: 'competitive',
        state, level: state.jogadorAtual === (swapByHuman ? 'jogador1' : 'jogador2') ? 2 : 1, seed: 31 + ply });
      expect(getJogadasValidas(state)).toContainEqual(response.bestMove!);
      expect(state).toEqual(before);
      state = aplicarJogada(state, response.bestMove!);
    }
    expect(state.estado).toMatch(/^vitoria-jogador[12]$/);
    expect(computeY({ version: '1.0', requestId: 'end', gameId: 'y', mode: 'competitive', state, level: 2 }).bestMove).toBeNull();
  }
});
