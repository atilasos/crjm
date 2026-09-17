import { LIGACOES, NOS, type Lado } from './board';
import type { YState } from './types';

export function criarEstadoInicial(): YState {
  return {
    tabuleiro: Object.fromEntries(NOS.map(no => [no.id, null])),
    cores: { jogador1: 'azul', jogador2: 'vermelho' },
    jogadorAtual: 'jogador1', podeTrocar: false, colocacoes: 0, estado: 'a-jogar',
  };
}

export function trocarCores(state: YState): YState {
  if (state.estado !== 'a-jogar' || !state.podeTrocar) return state;
  return { ...state, cores: { jogador1: 'vermelho', jogador2: 'azul' }, jogadorAtual: 'jogador1', podeTrocar: false };
}

export function colocarPeca(state: YState, no: string): YState {
  if (state.estado !== 'a-jogar' || state.tabuleiro[no] !== null) return state;
  const cor = state.cores[state.jogadorAtual];
  const tabuleiro = { ...state.tabuleiro, [no]: cor };
  const visited = new Set<string>();
  const lados = new Set<Lado>();
  const pending = [no];
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const lado of NOS.find(node => node.id === id)!.lados) lados.add(lado);
    for (const [a, b] of LIGACOES) {
      const neighbor = a === id ? b : b === id ? a : null;
      if (neighbor && tabuleiro[neighbor] === cor && !visited.has(neighbor)) pending.push(neighbor);
    }
  }
  return {
    ...state, tabuleiro, colocacoes: state.colocacoes + 1,
    podeTrocar: state.colocacoes === 0,
    jogadorAtual: state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1',
    estado: lados.size === 3 ? (state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2') : 'a-jogar',
  };
}
