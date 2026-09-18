import type { Casa, Direcao, FaiscaState, Jogada } from './types';

const PASSOS: Record<Direcao, Casa> = {
  cima: { linha: -1, coluna: 0 }, direita: { linha: 0, coluna: 1 },
  baixo: { linha: 1, coluna: 0 }, esquerda: { linha: 0, coluna: -1 },
};

export function criarEstadoInicial(): FaiscaState {
  return {
    tabuleiro: Array.from({ length: 5 }, () => Array(6).fill(null)),
    reservas: { jogador1: { 1: 5, 2: 5, 3: 5 }, jogador2: { 1: 5, 2: 5, 3: 5 } },
    jogadorAtual: 'jogador1', casaObrigatoria: null, estado: 'a-jogar',
  };
}

export function getDestino(jogada: Jogada): Casa {
  const passo = PASSOS[jogada.direcao];
  return {
    linha: jogada.casa.linha + passo.linha * jogada.distancia,
    coluna: jogada.casa.coluna + passo.coluna * jogada.distancia,
  };
}

export function colocarPeca(state: FaiscaState, jogada: Jogada): FaiscaState {
  if (!isJogadaValida(state, jogada)) return state;
  const tabuleiro = state.tabuleiro.map(row => [...row]);
  tabuleiro[jogada.casa.linha]![jogada.casa.coluna] = {
    jogador: state.jogadorAtual, distancia: jogada.distancia, direcao: jogada.direcao,
  };
  const next: FaiscaState = {
    ...state, tabuleiro, casaObrigatoria: getDestino(jogada),
    jogadorAtual: state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1',
    reservas: {
      ...state.reservas,
      [state.jogadorAtual]: { ...state.reservas[state.jogadorAtual], [jogada.distancia]: state.reservas[state.jogadorAtual][jogada.distancia] - 1 },
    },
  };
  const canPlay = ([1, 2, 3] as const).some(distancia =>
    (Object.keys(PASSOS) as Direcao[]).some(direcao =>
      isJogadaValida(next, { casa: next.casaObrigatoria!, distancia, direcao })));
  if (!canPlay) next.estado = state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  return next;
}

export function isJogadaValida(state: FaiscaState, jogada: Jogada): boolean {
  if (state.estado !== 'a-jogar' || !PASSOS[jogada.direcao] || ![1, 2, 3].includes(jogada.distancia)) return false;
  const livre = (casa: Casa) => Number.isInteger(casa.linha) && Number.isInteger(casa.coluna)
    && state.tabuleiro[casa.linha]?.[casa.coluna] === null;
  if (!livre(jogada.casa) || !livre(getDestino(jogada))) return false;
  if (state.casaObrigatoria && (jogada.casa.linha !== state.casaObrigatoria.linha || jogada.casa.coluna !== state.casaObrigatoria.coluna)) return false;
  return state.reservas[state.jogadorAtual][jogada.distancia] > 0;
}

export function getJogadasValidas(state: FaiscaState): Jogada[] {
  if (state.estado !== 'a-jogar') return [];
  const casas = state.casaObrigatoria ? [state.casaObrigatoria]
    : state.tabuleiro.flatMap((row, linha) => row.map((_, coluna) => ({ linha, coluna })));
  const moves: Jogada[] = [];
  for (const casa of casas) for (const distancia of [1, 2, 3] as const) {
    for (const direcao of Object.keys(PASSOS) as Direcao[]) {
      const move = { casa, distancia, direcao };
      if (isJogadaValida(state, move)) moves.push(move);
    }
  }
  return moves;
}
