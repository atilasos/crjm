import { LIGACOES, NOS, type Lado } from './board';
import type { YMove, YState } from './types';

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
  const { lados } = getGrupo(tabuleiro, no);
  return {
    ...state, tabuleiro, colocacoes: state.colocacoes + 1,
    podeTrocar: state.colocacoes === 0,
    jogadorAtual: state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1',
    estado: lados.size === 3 ? (state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2') : 'a-jogar',
  };
}

/** The same actions are used by the board, local engine and replayable arenas. */
export function getJogadasValidas(state: YState): YMove[] {
  if (state.estado !== 'a-jogar') return [];
  const moves: YMove[] = NOS.filter(no => state.tabuleiro[no.id] === null)
    .map(no => ({ type: 'place', node: no.id }));
  if (state.podeTrocar) moves.push({ type: 'swap' });
  return moves;
}

export function aplicarJogada(state: YState, move: YMove): YState {
  return move.type === 'swap' ? trocarCores(state) : colocarPeca(state, move.node);
}

/** Stones connected by drawn edges, with the sides reached by this one group. */
export function getGrupo(tabuleiro: YState['tabuleiro'], no: string) {
  const cor = tabuleiro[no];
  if (!cor) return { nos: new Set<string>(), lados: new Set<Lado>() };
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
  return { nos: visited, lados };
}
