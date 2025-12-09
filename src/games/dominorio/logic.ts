import { DominorioState, Celula, Posicao, Domino } from './types';
import { GameMode, GameStatus, Player } from '../../types';

const TAMANHO_TABULEIRO = 5;

// Criar tabuleiro inicial vazio
export function criarTabuleiroInicial(): Celula[][] {
  return Array(TAMANHO_TABULEIRO)
    .fill(null)
    .map(() => Array(TAMANHO_TABULEIRO).fill('vazia'));
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): DominorioState {
  const state: DominorioState = {
    tabuleiro: criarTabuleiroInicial(),
    modo,
    jogadorAtual: 'jogador1', // Horizontal começa
    estado: 'a-jogar',
    dominoPreview: null,
    celulaSelecionada: null,
    jogadasValidas: [],
    dominosColocados: [],
  };
  
  // Calcular jogadas válidas iniciais
  return {
    ...state,
    jogadasValidas: calcularJogadasValidas(state),
  };
}

// Verificar se posição está dentro do tabuleiro
function dentroDoTabuleiro(pos: Posicao): boolean {
  return pos.linha >= 0 && pos.linha < TAMANHO_TABULEIRO && 
         pos.coluna >= 0 && pos.coluna < TAMANHO_TABULEIRO;
}

// Obter a orientação do jogador atual
function getOrientacao(jogador: Player): 'horizontal' | 'vertical' {
  return jogador === 'jogador1' ? 'horizontal' : 'vertical';
}

// Calcular todas as jogadas válidas para o jogador atual
export function calcularJogadasValidas(state: DominorioState): Domino[] {
  const { tabuleiro, jogadorAtual } = state;
  const orientacao = getOrientacao(jogadorAtual);
  const jogadas: Domino[] = [];

  for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      const pos1: Posicao = { linha, coluna };
      
      if (tabuleiro[linha][coluna] !== 'vazia') continue;

      let pos2: Posicao;
      
      if (orientacao === 'horizontal') {
        pos2 = { linha, coluna: coluna + 1 };
      } else {
        pos2 = { linha: linha + 1, coluna };
      }

      if (!dentroDoTabuleiro(pos2)) continue;
      if (tabuleiro[pos2.linha][pos2.coluna] !== 'vazia') continue;

      jogadas.push({ pos1, pos2, orientacao });
    }
  }

  return jogadas;
}

// Verificar se uma jogada é válida
export function isJogadaValida(state: DominorioState, domino: Domino): boolean {
  return state.jogadasValidas.some(
    j => j.pos1.linha === domino.pos1.linha && 
         j.pos1.coluna === domino.pos1.coluna &&
         j.pos2.linha === domino.pos2.linha && 
         j.pos2.coluna === domino.pos2.coluna
  );
}

// Obter preview do dominó a partir de uma posição clicada
export function getDominoPreview(state: DominorioState, pos: Posicao): Domino | null {
  const orientacao = getOrientacao(state.jogadorAtual);
  
  let pos2: Posicao;
  if (orientacao === 'horizontal') {
    pos2 = { linha: pos.linha, coluna: pos.coluna + 1 };
  } else {
    pos2 = { linha: pos.linha + 1, coluna: pos.coluna };
  }

  const domino: Domino = { pos1: pos, pos2, orientacao };
  
  if (isJogadaValida(state, domino)) {
    return domino;
  }

  // Tentar como segunda posição do dominó
  let pos1Alt: Posicao;
  if (orientacao === 'horizontal') {
    pos1Alt = { linha: pos.linha, coluna: pos.coluna - 1 };
  } else {
    pos1Alt = { linha: pos.linha - 1, coluna: pos.coluna };
  }

  if (dentroDoTabuleiro(pos1Alt)) {
    const dominoAlt: Domino = { pos1: pos1Alt, pos2: pos, orientacao };
    if (isJogadaValida(state, dominoAlt)) {
      return dominoAlt;
    }
  }

  return null;
}

// Colocar um dominó no tabuleiro
export function colocarDomino(state: DominorioState, domino: Domino): DominorioState {
  if (!isJogadaValida(state, domino)) return state;

  const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);
  const tipoCelula: Celula = domino.orientacao === 'horizontal' 
    ? 'ocupada-horizontal' 
    : 'ocupada-vertical';

  novoTabuleiro[domino.pos1.linha][domino.pos1.coluna] = tipoCelula;
  novoTabuleiro[domino.pos2.linha][domino.pos2.coluna] = tipoCelula;

  const proximoJogador: Player = state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';

  let novoState: DominorioState = {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: 'a-jogar',
    dominoPreview: null,
    celulaSelecionada: null,
    dominosColocados: [...state.dominosColocados, domino],
    jogadasValidas: [],
  };

  // Calcular jogadas válidas para o próximo jogador
  novoState.jogadasValidas = calcularJogadasValidas(novoState);

  // Verificar se o próximo jogador tem jogadas
  if (novoState.jogadasValidas.length === 0) {
    // O jogador atual ganha porque o próximo não tem jogadas
    novoState.estado = state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  }

  return novoState;
}

// Atualizar preview ao mover o rato
export function atualizarPreview(state: DominorioState, pos: Posicao | null): DominorioState {
  if (!pos) {
    return { ...state, dominoPreview: null };
  }

  const preview = getDominoPreview(state, pos);
  return { ...state, dominoPreview: preview };
}

// IA do computador
export function jogadaComputador(state: DominorioState): DominorioState {
  const jogadas = state.jogadasValidas;
  if (jogadas.length === 0) return state;

  // Estratégia da IA:
  // 1. Preferir jogar no centro
  // 2. Preferir jogadas que deixam mais opções para si
  // 3. Preferir jogadas que bloqueiam o adversário

  const jogadasAvaliadas = jogadas.map(jogada => {
    let pontuacao = 0;
    
    // Preferir centro
    const centroLinha = (jogada.pos1.linha + jogada.pos2.linha) / 2;
    const centroColuna = (jogada.pos1.coluna + jogada.pos2.coluna) / 2;
    const distanciaCentro = Math.abs(centroLinha - 2) + Math.abs(centroColuna - 2);
    pontuacao -= distanciaCentro;

    // Simular jogada e contar opções do adversário
    const stateAposJogada = colocarDomino(state, jogada);
    const jogadasAdversario = stateAposJogada.jogadasValidas.length;
    
    // Penalizar se adversário tem muitas opções
    pontuacao -= jogadasAdversario * 2;

    // Verificar nossas opções após a jogada do adversário (aproximação)
    // Simular tabuleiro como se fosse nossa vez novamente
    const stateSimulado: DominorioState = {
      ...stateAposJogada,
      jogadorAtual: state.jogadorAtual,
    };
    const nossasJogadasFuturas = calcularJogadasValidas(stateSimulado);
    pontuacao += nossasJogadasFuturas.length;

    return { jogada, pontuacao };
  });

  // Ordenar por pontuação
  jogadasAvaliadas.sort((a, b) => b.pontuacao - a.pontuacao);

  // Escolher entre as melhores (com alguma aleatoriedade)
  const melhores = jogadasAvaliadas.slice(0, Math.min(3, jogadasAvaliadas.length));
  const escolhida = melhores[Math.floor(Math.random() * melhores.length)].jogada;

  return colocarDomino(state, escolhida);
}

