import { expect, test } from 'bun:test';
import { criarEstadoInicial, colocarPeca, isJogadaValida } from '../logic';
import { computeFaisca } from './engine';

test('N2 escolhe a vitória imediata e N1 repete a escolha com a mesma seed', () => {
  const state = criarEstadoInicial();
  state.tabuleiro = state.tabuleiro.map(row => row.map(() => ({ jogador: 'jogador1', distancia: 1, direcao: 'direita' })));
  for (const [row, col] of [[4, 0], [4, 1], [4, 2], [3, 0]] as const) state.tabuleiro[row]![col] = null;
  state.casaObrigatoria = { linha: 4, coluna: 0 };
  const request = { version: '1.0', requestId: 'win', gameId: 'faisca', mode: 'competitive', state, level: 2, seed: 30 } as const;
  const response = computeFaisca(request);
  expect(response.bestMove).toEqual({ casa: { linha: 4, coluna: 0 }, distancia: 1, direcao: 'cima' });
  expect(colocarPeca(state, response.bestMove!).estado).toBe('vitoria-jogador1');
  expect(computeFaisca({ ...request, level: 1 }).bestMove).toEqual(computeFaisca({ ...request, level: 1 }).bestMove);
});

test('pedidos de IA completam partidas legais nos dois lados sem alterar o estado recebido', () => {
  for (const firstLevel of [1, 2] as const) {
    let state = criarEstadoInicial();
    let ply = 0;
    while (state.estado === 'a-jogar' && ply < 30) {
      const before = structuredClone(state);
      const response = computeFaisca({ version: '1.0', requestId: `move-${ply}`, gameId: 'faisca',
        mode: 'competitive', state, level: state.jogadorAtual === 'jogador1' ? firstLevel : 3 - firstLevel as 1 | 2,
        seed: 42 + ply, timeBudgetMs: 5 });
      expect(response.requestId).toBe(`move-${ply}`);
      expect(response.criticalThreats).toEqual([]);
      expect(response.bestMove).not.toBeNull();
      expect(isJogadaValida(state, response.bestMove!)).toBe(true);
      expect(state).toEqual(before);
      state = colocarPeca(state, response.bestMove!);
      ply++;
    }
    expect(state.estado).toMatch(/^vitoria-jogador[12]$/);
    expect(computeFaisca({ version: '1.0', requestId: 'end', gameId: 'faisca', mode: 'competitive', state, level: 2 }).bestMove).toBeNull();
  }
});
