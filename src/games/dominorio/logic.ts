import { DominorioState, Celula, Posicao, Domino } from './types';
import { GameMode, GameStatus, Player } from '../../types';

const TAMANHO_TABULEIRO = 8;

// Criar tabuleiro inicial vazio
export function criarTabuleiroInicial(): Celula[][] {
  return Array(TAMANHO_TABULEIRO)
    .fill(null)
    .map(() => Array(TAMANHO_TABULEIRO).fill('vazia'));
}

// Verificar se posição está dentro do tabuleiro
function dentroDoTabuleiro(pos: Posicao): boolean {
  return pos.linha >= 0 && pos.linha < TAMANHO_TABULEIRO && 
         pos.coluna >= 0 && pos.coluna < TAMANHO_TABULEIRO;
}

// Obter a orientação do jogador atual
function getOrientacao(jogador: Player): 'horizontal' | 'vertical' {
  // Jogador 1 = Vertical, Jogador 2 = Horizontal
  return jogador === 'jogador1' ? 'vertical' : 'horizontal';
}

// Calcular todas as jogadas válidas para o jogador atual
export function calcularJogadasValidas(tabuleiro: Celula[][], jogador: Player): Domino[] {
  const orientacao = getOrientacao(jogador);
  const jogadas: Domino[] = [];

  for (let linha = 0; linha < TAMANHO_TABULEIRO; linha++) {
    for (let coluna = 0; coluna < TAMANHO_TABULEIRO; coluna++) {
      const pos1: Posicao = { linha, coluna };
      
      if (tabuleiro[linha][coluna] !== 'vazia') continue;

      let pos2: Posicao;
      
      if (orientacao === 'vertical') {
        pos2 = { linha: linha + 1, coluna };
      } else {
        pos2 = { linha, coluna: coluna + 1 };
      }

      if (!dentroDoTabuleiro(pos2)) continue;
      if (tabuleiro[pos2.linha][pos2.coluna] !== 'vazia') continue;

      jogadas.push({ pos1, pos2, orientacao });
    }
  }

  return jogadas;
}

// Criar estado inicial do jogo
export function criarEstadoInicial(modo: GameMode): DominorioState {
  const tabuleiro = criarTabuleiroInicial();
  const jogadasValidas = calcularJogadasValidas(tabuleiro, 'jogador1');
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: 'jogador1', // Vertical começa
    estado: 'a-jogar',
    dominoPreview: null,
    jogadasValidas,
    dominosColocados: [],
  };
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
  if (orientacao === 'vertical') {
    pos2 = { linha: pos.linha + 1, coluna: pos.coluna };
  } else {
    pos2 = { linha: pos.linha, coluna: pos.coluna + 1 };
  }

  const domino: Domino = { pos1: pos, pos2, orientacao };
  
  if (isJogadaValida(state, domino)) {
    return domino;
  }

  // Tentar como segunda posição do dominó
  let pos1Alt: Posicao;
  if (orientacao === 'vertical') {
    pos1Alt = { linha: pos.linha - 1, coluna: pos.coluna };
  } else {
    pos1Alt = { linha: pos.linha, coluna: pos.coluna - 1 };
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
  const tipoCelula: Celula = domino.orientacao === 'vertical' 
    ? 'ocupada-vertical' 
    : 'ocupada-horizontal';

  novoTabuleiro[domino.pos1.linha][domino.pos1.coluna] = tipoCelula;
  novoTabuleiro[domino.pos2.linha][domino.pos2.coluna] = tipoCelula;

  const proximoJogador: Player = state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1';

  // Calcular jogadas válidas para o próximo jogador
  const jogadasProximoJogador = calcularJogadasValidas(novoTabuleiro, proximoJogador);

  // NORMAL PLAY: Se o próximo jogador NÃO tem jogadas, ele PERDE
  // (o jogador atual foi o último a jogar e portanto ganha)
  let novoEstado: GameStatus = 'a-jogar';
  if (jogadasProximoJogador.length === 0) {
    // O jogador atual ganha porque fez a última jogada
    novoEstado = state.jogadorAtual === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';
  }

  return {
    ...state,
    tabuleiro: novoTabuleiro,
    jogadorAtual: proximoJogador,
    estado: novoEstado,
    dominoPreview: null,
    dominosColocados: [...state.dominosColocados, domino],
    jogadasValidas: jogadasProximoJogador,
  };
}

// Atualizar preview ao mover o rato
export function atualizarPreview(state: DominorioState, pos: Posicao | null): DominorioState {
  if (!pos) {
    return { ...state, dominoPreview: null };
  }

  const preview = getDominoPreview(state, pos);
  return { ...state, dominoPreview: preview };
}

// IA do computador (normal play - quer ser o último a jogar)
export function jogadaComputador(state: DominorioState): DominorioState {
  const jogadas = state.jogadasValidas;
  if (jogadas.length === 0) return state;

  // Avaliar cada jogada
  const jogadasAvaliadas = jogadas.map(jogada => {
    // Simular a jogada
    const novoTabuleiro = state.tabuleiro.map(linha => [...linha]);
    const tipoCelula: Celula = jogada.orientacao === 'vertical' 
      ? 'ocupada-vertical' 
      : 'ocupada-horizontal';
    novoTabuleiro[jogada.pos1.linha][jogada.pos1.coluna] = tipoCelula;
    novoTabuleiro[jogada.pos2.linha][jogada.pos2.coluna] = tipoCelula;

    // Contar jogadas de cada lado após esta jogada
    const jogadasAdversario = calcularJogadasValidas(novoTabuleiro, 
      state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1');
    const minhasJogadasFuturas = calcularJogadasValidas(novoTabuleiro, state.jogadorAtual);

    let pontuacao = 0;

    // NORMAL PLAY: Queremos ser o último a jogar
    // Se o adversário ficar sem jogadas, nós ganhamos!
    if (jogadasAdversario.length === 0) {
      // Excelente! Nós ganhamos
      pontuacao = 1000;
    } else if (minhasJogadasFuturas.length === 0 && jogadasAdversario.length > 0) {
      // Péssimo! Vamos perder no próximo turno se não tivermos jogadas
      pontuacao = -500;
    } else {
      // Heurística normal play: maximizar nossas jogadas, minimizar as do adversário
      pontuacao = minhasJogadasFuturas.length - jogadasAdversario.length * 2;
      
      // Preferir jogar no centro no início
      const centroLinha = (jogada.pos1.linha + jogada.pos2.linha) / 2;
      const centroColuna = (jogada.pos1.coluna + jogada.pos2.coluna) / 2;
      const distanciaCentro = Math.abs(centroLinha - 3.5) + Math.abs(centroColuna - 3.5);
      pontuacao -= distanciaCentro * 0.5;
    }

    // Adicionar pequena aleatoriedade
    pontuacao += Math.random() * 3;

    return { jogada, pontuacao };
  });

  // Ordenar por pontuação
  jogadasAvaliadas.sort((a, b) => b.pontuacao - a.pontuacao);

  // Escolher a melhor jogada
  const melhorJogada = jogadasAvaliadas[0].jogada;

  return colocarDomino(state, melhorJogada);
}
