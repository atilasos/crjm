import { expect, test } from 'bun:test';
import { criarEstadoInicial, colocarPeca, trocarCores } from './logic';

test('coloca numa intersecção livre, recusa ocupadas e conserva a peça inicial depois da troca', () => {
  const initial = criarEstadoInicial();
  expect(trocarCores(initial)).toBe(initial);
  const first = colocarPeca(initial, 'A5');
  expect(first.tabuleiro.A5).toBe('azul');
  expect(first.jogadorAtual).toBe('jogador2');
  expect(colocarPeca(first, 'A5')).toBe(first);
  expect(colocarPeca(first, 'fora')).toBe(first);
  const swapped = trocarCores(first);
  expect(swapped.tabuleiro).toEqual(first.tabuleiro);
  expect(swapped.cores).toEqual({ jogador1: 'vermelho', jogador2: 'azul' });
  expect(swapped.jogadorAtual).toBe('jogador1');
  expect(trocarCores(swapped)).toBe(swapped);
  const reply = colocarPeca(swapped, 'B4');
  expect(reply.tabuleiro.B4).toBe('vermelho');
  expect(reply.jogadorAtual).toBe('jogador2');
  expect(trocarCores(reply)).toBe(reply);
  expect(initial.tabuleiro.A5).toBeNull();
});

test('recusa a troca depois de o segundo participante colocar a sua peça', () => {
  const state = colocarPeca(colocarPeca(criarEstadoInicial(), 'A1'), 'A9');
  expect(trocarCores(state)).toBe(state);
});

// Paths read from the original drawing, independent of the graph implementation.
const cornerToOpposite = ['A1', 'B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8', 'A9'];
const isolatedReplies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];

test('um grupo liga o canto ao lado oposto; a vitória segue o participante após troca', () => {
  for (const swap of [false, true]) {
    let state = colocarPeca(criarEstadoInicial(), cornerToOpposite[0]!);
    if (swap) state = trocarCores(state);
    for (let i = 1; i < cornerToOpposite.length; i++) {
      state = colocarPeca(state, isolatedReplies[i - 1]!);
      expect(state.estado).toBe('a-jogar');
      state = colocarPeca(state, cornerToOpposite[i]!);
      if (i < cornerToOpposite.length - 1) expect(state.estado).toBe('a-jogar');
    }
    expect(state.estado).toBe(swap ? 'vitoria-jogador2' : 'vitoria-jogador1');
    expect(colocarPeca(state, 'A5')).toBe(state);
    expect(trocarCores(state)).toBe(state);
  }
});

test('três grupos separados nos lados não vencem, nem dois cantos desligados', () => {
  let state = criarEstadoInicial();
  for (const id of ['A5', 'C3', 'G1', 'C5', 'G9', 'I5', 'A1', 'I3', 'A9']) state = colocarPeca(state, id);
  expect(state.estado).toBe('a-jogar');
});

test('a ligação desenhada D3–E3 une o grupo, mas a proximidade E3–E2 não é uma ligação', () => {
  let state = criarEstadoInicial();
  const incomplete = ['A1', 'B1', 'C1', 'E2', 'E3', 'F3', 'F4', 'F5', 'F6', 'F7', 'E8', 'D9', 'A9', 'B8'];
  const replies = ['M1', 'L1', 'L2', 'L3', 'K1', 'K2', 'K3', 'K4', 'K5', 'J1', 'J2', 'J3', 'J5', 'J6'];
  for (let i = 0; i < incomplete.length; i++) {
    state = colocarPeca(state, incomplete[i]!);
    expect(state.estado).toBe('a-jogar');
    state = colocarPeca(state, replies[i]!);
  }
  // D3 connects C1/E2 to E3 by actual lines. Nearby E2/E3 alone did not.
  state = colocarPeca(state, 'D3');
  expect(state.estado).toBe('vitoria-jogador1');
});

test('o tabuleiro do anexo conserva lados, cantos e as cinco ligações de E3', async () => {
  const { NOS, LIGACOES } = await import('./board');
  expect(NOS).toHaveLength(93);
  expect(LIGACOES).toHaveLength(252);
  for (const lado of ['superior', 'esquerdo', 'direito'] as const) expect(NOS.filter(no => no.lados.includes(lado))).toHaveLength(9);
  expect(NOS.find(no => no.id === 'A1')?.lados).toEqual(['superior', 'esquerdo']);
  expect(NOS.find(no => no.id === 'A9')?.lados).toEqual(['superior', 'direito']);
  expect(NOS.find(no => no.id === 'M1')?.lados).toEqual(['esquerdo', 'direito']);
  const neighbors = LIGACOES.filter(edge => edge.includes('E3')).map(([a, b]) => a === 'E3' ? b : a);
  expect(neighbors.sort()).toEqual(['D3', 'D4', 'E4', 'F2', 'F3']);
});

test('o grupo vermelho vence ligando o canto inferior ao lado superior', () => {
  let state = criarEstadoInicial();
  const path = ['M1', 'L2', 'K3', 'J4', 'I5', 'H4', 'G4', 'F3', 'E3', 'D4', 'C3', 'B3', 'A3'];
  const blue = ['A1', 'D1', 'E1', 'G1', 'I1', 'J1', 'K1', 'L1', 'A9', 'D10', 'E9', 'G9', 'I9'];
  for (let i = 0; i < path.length; i++) {
    state = colocarPeca(state, blue[i]!);
    state = colocarPeca(state, path[i]!);
    if (i < path.length - 1) expect(state.estado).toBe('a-jogar');
  }
  expect(state.estado).toBe('vitoria-jogador2');
});
