/**
 * Tipos de GameMove e GameState de rede conforme CLIENT-INTEGRATION_NEW.md
 * e funções de conversão entre formatos de rede e locais (UI).
 */

import type { GameId } from './protocol';

// Tipos locais (UI)
import type { GatosCaesState, Posicao as GatosCaesPosicao } from '../games/gatos-caes/types';
import type { DominorioState, Domino, Posicao as DominorioPosicao } from '../games/dominorio/types';
import type { QuelhasState, Segmento, Posicao as QuelhasPosicao } from '../games/quelhas/types';
import type { ProdutoState, Posicao as ProdutoPosicao, JogadaDupla } from '../games/produto/types';
import type { AtariGoState, Posicao as AtariGoPosicao } from '../games/atari-go/types';
import type { NexState, Posicao as NexPosicao, Acao as NexAcao, AcaoColocacao, AcaoSubstituicao } from '../games/nex/types';

// ============================================================================
// GATOS & CÃES - Network Types
// ============================================================================

export type NetworkGatosCaesCelula = 'empty' | 'cat' | 'dog';

export interface NetworkGatosCaesMove {
  row: number;
  col: number;
}

export interface NetworkGatosCaesState {
  board: NetworkGatosCaesCelula[][];
  currentPlayer: 'player1' | 'player2';
  catCount: number;
  dogCount: number;
  lastMove: { row: number; col: number } | null;
  winner: 'player1' | 'player2' | null;
  isFirstCatPlaced: boolean;
  isFirstDogPlaced: boolean;
}

// Conversões Gatos & Cães
export function toNetworkGatosCaesMove(move: GatosCaesPosicao): NetworkGatosCaesMove {
  return { row: move.linha, col: move.coluna };
}

export function fromNetworkGatosCaesMove(move: NetworkGatosCaesMove): GatosCaesPosicao {
  return { linha: move.row, coluna: move.col };
}

export function toNetworkGatosCaesState(state: GatosCaesState): NetworkGatosCaesState {
  const celulaMap: Record<string, NetworkGatosCaesCelula> = {
    'vazia': 'empty',
    'gato': 'cat',
    'cao': 'dog',
  };
  
  return {
    board: state.tabuleiro.map(row => row.map(c => celulaMap[c])),
    currentPlayer: state.jogadorAtual === 'jogador1' ? 'player1' : 'player2',
    catCount: state.totalGatos,
    dogCount: state.totalCaes,
    lastMove: state.jogadasValidas.length > 0 ? null : null, // Not tracked in local state
    winner: state.estado === 'vitoria-jogador1' ? 'player1' 
          : state.estado === 'vitoria-jogador2' ? 'player2' 
          : null,
    isFirstCatPlaced: state.primeiroGatoColocado,
    isFirstDogPlaced: state.primeiroCaoColocado,
  };
}

export function fromNetworkGatosCaesState(
  net: NetworkGatosCaesState,
  modo: 'vs-computador' | 'dois-jogadores' = 'dois-jogadores'
): GatosCaesState {
  const celulaMap: Record<NetworkGatosCaesCelula, 'vazia' | 'gato' | 'cao'> = {
    'empty': 'vazia',
    'cat': 'gato',
    'dog': 'cao',
  };
  const tabuleiro = net.board.map(row => row.map(c => celulaMap[c]));
  
  // Calculate jogadasValidas based on board state
  const jogadasValidas: GatosCaesPosicao[] = [];
  // (simplified - the real validation should use game logic)
  for (let linha = 0; linha < tabuleiro.length; linha++) {
    for (let coluna = 0; coluna < tabuleiro[linha].length; coluna++) {
      if (tabuleiro[linha][coluna] === 'vazia') {
        jogadasValidas.push({ linha, coluna });
      }
    }
  }
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: net.currentPlayer === 'player1' ? 'jogador1' : 'jogador2',
    estado: net.winner === 'player1' ? 'vitoria-jogador1' 
          : net.winner === 'player2' ? 'vitoria-jogador2' 
          : 'a-jogar',
    jogadasValidas,
    primeiroGatoColocado: net.isFirstCatPlaced,
    primeiroCaoColocado: net.isFirstDogPlaced,
    totalGatos: net.catCount,
    totalCaes: net.dogCount,
  };
}

// ============================================================================
// DOMINÓRIO - Network Types
// ============================================================================

export type NetworkDominorioCelula = null | 'player1' | 'player2';

export interface NetworkDominorioMove {
  row1: number;
  col1: number;
  row2: number;
  col2: number;
}

export interface NetworkDominorioState {
  board: NetworkDominorioCelula[][];
  currentPlayer: 'player1' | 'player2';
  lastMove: NetworkDominorioMove | null;
  winner: 'player1' | 'player2' | null;
  movesCount: number;
}

// Conversões Dominório
export function toNetworkDominorioMove(move: Domino): NetworkDominorioMove {
  return {
    row1: move.pos1.linha,
    col1: move.pos1.coluna,
    row2: move.pos2.linha,
    col2: move.pos2.coluna,
  };
}

export function fromNetworkDominorioMove(move: NetworkDominorioMove): Domino {
  const isVertical = move.col1 === move.col2;
  return {
    pos1: { linha: move.row1, coluna: move.col1 },
    pos2: { linha: move.row2, coluna: move.col2 },
    orientacao: isVertical ? 'vertical' : 'horizontal',
  };
}

export function toNetworkDominorioState(state: DominorioState): NetworkDominorioState {
  const board: NetworkDominorioCelula[][] = state.tabuleiro.map(row => 
    row.map(c => {
      if (c === 'vazia') return null;
      return c === 'ocupada-vertical' ? 'player1' : 'player2';
    })
  );
  
  return {
    board,
    currentPlayer: state.jogadorAtual === 'jogador1' ? 'player1' : 'player2',
    lastMove: state.dominosColocados.length > 0 
      ? toNetworkDominorioMove(state.dominosColocados[state.dominosColocados.length - 1])
      : null,
    winner: state.estado === 'vitoria-jogador1' ? 'player1' 
          : state.estado === 'vitoria-jogador2' ? 'player2' 
          : null,
    movesCount: state.dominosColocados.length,
  };
}

export function fromNetworkDominorioState(
  net: NetworkDominorioState,
  modo: 'vs-computador' | 'dois-jogadores' = 'dois-jogadores'
): DominorioState {
  type LocalCelula = 'vazia' | 'ocupada-vertical' | 'ocupada-horizontal';
  const tabuleiro: LocalCelula[][] = net.board.map(row => 
    row.map(c => {
      if (c === null) return 'vazia';
      return c === 'player1' ? 'ocupada-vertical' : 'ocupada-horizontal';
    })
  );
  
  // Calculate jogadasValidas (simplified)
  const jogadasValidas: Domino[] = [];
  const orientacao = net.currentPlayer === 'player1' ? 'vertical' : 'horizontal';
  
  for (let linha = 0; linha < tabuleiro.length; linha++) {
    for (let coluna = 0; coluna < tabuleiro[linha].length; coluna++) {
      if (tabuleiro[linha][coluna] === 'vazia') {
        if (orientacao === 'vertical' && linha + 1 < tabuleiro.length && tabuleiro[linha + 1][coluna] === 'vazia') {
          jogadasValidas.push({
            pos1: { linha, coluna },
            pos2: { linha: linha + 1, coluna },
            orientacao: 'vertical',
          });
        }
        if (orientacao === 'horizontal' && coluna + 1 < tabuleiro[linha].length && tabuleiro[linha][coluna + 1] === 'vazia') {
          jogadasValidas.push({
            pos1: { linha, coluna },
            pos2: { linha, coluna: coluna + 1 },
            orientacao: 'horizontal',
          });
        }
      }
    }
  }
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: net.currentPlayer === 'player1' ? 'jogador1' : 'jogador2',
    estado: net.winner === 'player1' ? 'vitoria-jogador1' 
          : net.winner === 'player2' ? 'vitoria-jogador2' 
          : 'a-jogar',
    dominoPreview: null,
    jogadasValidas,
    dominosColocados: [], // Not tracked in network state
  };
}

// ============================================================================
// QUELHAS - Network Types
// ============================================================================

export type NetworkQuelhasCelula = 'empty' | 'filled';

export interface NetworkQuelhasMove {
  cells: Array<{ row: number; col: number }>;
  swap?: boolean;
}

export interface NetworkQuelhasState {
  board: NetworkQuelhasCelula[][];
  currentPlayer: 'player1' | 'player2';
  lastMove: NetworkQuelhasMove | null;
  winner: 'player1' | 'player2' | null;
  moveCount: number;
  canSwap: boolean;
  swapped: boolean;
}

// Conversões Quelhas
export function toNetworkQuelhasMove(move: Segmento, isSwap: boolean = false): NetworkQuelhasMove {
  const cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < move.comprimento; i++) {
    if (move.orientacao === 'vertical') {
      cells.push({ row: move.inicio.linha + i, col: move.inicio.coluna });
    } else {
      cells.push({ row: move.inicio.linha, col: move.inicio.coluna + i });
    }
  }
  return { cells, swap: isSwap || undefined };
}

export function fromNetworkQuelhasMove(move: NetworkQuelhasMove): { segmento: Segmento; swap: boolean } {
  const swap = move.swap ?? false;
  if (move.cells.length === 0) {
    throw new Error('Invalid Quelhas move: no cells');
  }
  
  const first = move.cells[0];
  const last = move.cells[move.cells.length - 1];
  const isVertical = first.col === last.col;
  
  return {
    segmento: {
      inicio: { linha: first.row, coluna: first.col },
      comprimento: move.cells.length,
      orientacao: isVertical ? 'vertical' : 'horizontal',
    },
    swap,
  };
}

export function toNetworkQuelhasState(state: QuelhasState): NetworkQuelhasState {
  return {
    board: state.tabuleiro.map(row => row.map(c => c === 'vazia' ? 'empty' : 'filled')),
    currentPlayer: state.jogadorAtual === 'jogador1' ? 'player1' : 'player2',
    lastMove: null, // Not tracked in local state
    winner: state.estado === 'vitoria-jogador1' ? 'player1' 
          : state.estado === 'vitoria-jogador2' ? 'player2' 
          : null,
    moveCount: state.primeiraJogada ? 0 : 1, // Approximation
    canSwap: state.trocaDisponivel,
    swapped: state.trocaEfetuada,
  };
}

export function fromNetworkQuelhasState(
  net: NetworkQuelhasState,
  modo: 'vs-computador' | 'dois-jogadores' = 'dois-jogadores'
): QuelhasState {
  type LocalCelula = 'vazia' | 'ocupada';
  const tabuleiro: LocalCelula[][] = net.board.map(row => 
    row.map(c => c === 'empty' ? 'vazia' : 'ocupada')
  );
  
  // Determine orientations based on swap status
  const orientacaoJogador1 = net.swapped ? 'horizontal' : 'vertical';
  const orientacaoJogador2 = net.swapped ? 'vertical' : 'horizontal';
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: net.currentPlayer === 'player1' ? 'jogador1' : 'jogador2',
    estado: net.winner === 'player1' ? 'vitoria-jogador1' 
          : net.winner === 'player2' ? 'vitoria-jogador2' 
          : 'a-jogar',
    segmentoPreview: null,
    jogadasValidas: [], // Should be calculated by game logic
    primeiraJogada: net.moveCount === 0,
    orientacaoJogador1,
    orientacaoJogador2,
    trocaDisponivel: net.canSwap,
    trocaEfetuada: net.swapped,
  };
}

// ============================================================================
// PRODUTO - Network Types
// ============================================================================

export type NetworkProdutoCelula = 'empty' | 'black' | 'white';

export interface NetworkProdutoMove {
  placements: Array<{
    coord: { q: number; r: number };
    color: 'black' | 'white';
  }>;
}

export interface NetworkProdutoState {
  board: Record<string, NetworkProdutoCelula>; // key: "q,r"
  currentPlayer: 'player1' | 'player2';
  lastMove: NetworkProdutoMove | null;
  winner: 'player1' | 'player2' | 'draw' | null;
  moveCount: number;
  blackPiecesPlaced: number;
  whitePiecesPlaced: number;
}

// Conversões Produto
export function toNetworkProdutoMove(move: JogadaDupla): NetworkProdutoMove {
  const colorMap: Record<string, 'black' | 'white'> = {
    'preta': 'black',
    'branca': 'white',
  };
  
  const placements: NetworkProdutoMove['placements'] = [];
  placements.push({
    coord: { q: move.pos1.q, r: move.pos1.r },
    color: colorMap[move.cor1],
  });
  
  if (move.pos2 && move.cor2) {
    placements.push({
      coord: { q: move.pos2.q, r: move.pos2.r },
      color: colorMap[move.cor2],
    });
  }
  
  return { placements };
}

export function fromNetworkProdutoMove(move: NetworkProdutoMove): JogadaDupla {
  const colorMap: Record<'black' | 'white', 'preta' | 'branca'> = {
    'black': 'preta',
    'white': 'branca',
  };
  
  const first = move.placements[0];
  const second = move.placements[1];
  
  return {
    pos1: { q: first.coord.q, r: first.coord.r },
    cor1: colorMap[first.color],
    pos2: second ? { q: second.coord.q, r: second.coord.r } : null,
    cor2: second ? colorMap[second.color] : null,
  };
}

export function toNetworkProdutoState(state: ProdutoState): NetworkProdutoState {
  const celulaMap: Record<string, NetworkProdutoCelula> = {
    'vazia': 'empty',
    'preta': 'black',
    'branca': 'white',
  };
  
  const board: Record<string, NetworkProdutoCelula> = {};
  state.tabuleiro.forEach((celula, key) => {
    board[key] = celulaMap[celula];
  });
  
  let blackCount = 0;
  let whiteCount = 0;
  state.tabuleiro.forEach(celula => {
    if (celula === 'preta') blackCount++;
    if (celula === 'branca') whiteCount++;
  });
  
  return {
    board,
    currentPlayer: state.jogadorAtual === 'jogador1' ? 'player1' : 'player2',
    lastMove: null, // Not tracked
    winner: state.estado === 'vitoria-jogador1' ? 'player1' 
          : state.estado === 'vitoria-jogador2' ? 'player2'
          : state.estado === 'empate' ? 'draw'
          : null,
    moveCount: state.primeiraJogada ? 0 : 1, // Approximation
    blackPiecesPlaced: blackCount,
    whitePiecesPlaced: whiteCount,
  };
}

export function fromNetworkProdutoState(
  net: NetworkProdutoState,
  modo: 'vs-computador' | 'dois-jogadores' = 'dois-jogadores'
): ProdutoState {
  const celulaMap: Record<NetworkProdutoCelula, 'vazia' | 'preta' | 'branca'> = {
    'empty': 'vazia',
    'black': 'preta',
    'white': 'branca',
  };
  
  const tabuleiro = new Map<string, 'vazia' | 'preta' | 'branca'>();
  const casasVazias: ProdutoPosicao[] = [];
  
  for (const [key, value] of Object.entries(net.board)) {
    tabuleiro.set(key, celulaMap[value]);
    if (value === 'empty') {
      const [q, r] = key.split(',').map(Number);
      casasVazias.push({ q, r });
    }
  }
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: net.currentPlayer === 'player1' ? 'jogador1' : 'jogador2',
    estado: net.winner === 'player1' ? 'vitoria-jogador1' 
          : net.winner === 'player2' ? 'vitoria-jogador2'
          : net.winner === 'draw' ? 'empate'
          : 'a-jogar',
    primeiraJogada: net.moveCount === 0,
    pontuacaoPretas: { maiorGrupo: 0, segundoMaiorGrupo: 0, produto: 0, totalPecas: net.blackPiecesPlaced },
    pontuacaoBrancas: { maiorGrupo: 0, segundoMaiorGrupo: 0, produto: 0, totalPecas: net.whitePiecesPlaced },
    jogadaEmCurso: { pos1: null, cor1: null },
    casasVazias,
  };
}

// ============================================================================
// ATARI GO - Network Types
// ============================================================================

export type NetworkAtariGoCelula = 'empty' | 'black' | 'white';

export interface NetworkAtariGoMove {
  row: number;
  col: number;
  pass?: boolean;
}

export interface NetworkAtariGoState {
  board: NetworkAtariGoCelula[][];
  currentPlayer: 'player1' | 'player2';
  blackCaptures: number;
  whiteCaptures: number;
  lastMove: NetworkAtariGoMove | null;
  winner: 'player1' | 'player2' | 'draw' | null;
  passCount: number;
}

// Conversões Atari Go
export function toNetworkAtariGoMove(move: AtariGoPosicao, pass: boolean = false): NetworkAtariGoMove {
  return { row: move.linha, col: move.coluna, pass: pass || undefined };
}

export function fromNetworkAtariGoMove(move: NetworkAtariGoMove): { posicao: AtariGoPosicao; pass: boolean } {
  return {
    posicao: { linha: move.row, coluna: move.col },
    pass: move.pass ?? false,
  };
}

export function toNetworkAtariGoState(state: AtariGoState): NetworkAtariGoState {
  const celulaMap: Record<string, NetworkAtariGoCelula> = {
    'vazia': 'empty',
    'preta': 'black',
    'branca': 'white',
  };
  
  return {
    board: state.tabuleiro.map(row => row.map(c => celulaMap[c])),
    currentPlayer: state.jogadorAtual === 'jogador1' ? 'player1' : 'player2',
    blackCaptures: state.pedrasCapturadas.brancas, // Pretas capturaram brancas
    whiteCaptures: state.pedrasCapturadas.pretas,  // Brancas capturaram pretas
    lastMove: state.ultimaJogada 
      ? { row: state.ultimaJogada.linha, col: state.ultimaJogada.coluna }
      : null,
    winner: state.estado === 'vitoria-jogador1' ? 'player1' 
          : state.estado === 'vitoria-jogador2' ? 'player2'
          : state.estado === 'empate' ? 'draw'
          : null,
    passCount: 0, // Not tracked in local state
  };
}

export function fromNetworkAtariGoState(
  net: NetworkAtariGoState,
  modo: 'vs-computador' | 'dois-jogadores' = 'dois-jogadores'
): AtariGoState {
  const celulaMap: Record<NetworkAtariGoCelula, 'vazia' | 'preta' | 'branca'> = {
    'empty': 'vazia',
    'black': 'preta',
    'white': 'branca',
  };
  
  const tabuleiro = net.board.map(row => row.map(c => celulaMap[c]));
  
  // Calculate jogadasValidas (simplified - empty cells)
  const jogadasValidas: AtariGoPosicao[] = [];
  for (let linha = 0; linha < tabuleiro.length; linha++) {
    for (let coluna = 0; coluna < tabuleiro[linha].length; coluna++) {
      if (tabuleiro[linha][coluna] === 'vazia') {
        jogadasValidas.push({ linha, coluna });
      }
    }
  }
  
  return {
    tabuleiro,
    modo,
    jogadorAtual: net.currentPlayer === 'player1' ? 'jogador1' : 'jogador2',
    estado: net.winner === 'player1' ? 'vitoria-jogador1' 
          : net.winner === 'player2' ? 'vitoria-jogador2'
          : net.winner === 'draw' ? 'empate'
          : 'a-jogar',
    jogadasValidas,
    ultimaJogada: net.lastMove ? { linha: net.lastMove.row, coluna: net.lastMove.col } : null,
    pedrasCapturadas: {
      pretas: net.whiteCaptures, // Brancas capturaram pretas
      brancas: net.blackCaptures, // Pretas capturaram brancas
    },
  };
}

// ============================================================================
// NEX - Network Types
// ============================================================================

export type NetworkNexCelula = 'empty' | 'black' | 'white' | 'neutral';

export interface NetworkNexMove {
  type: 'place' | 'convert' | 'swap';
  // Para 'place':
  ownPiece?: { row: number; col: number };
  neutralPiece?: { row: number; col: number };
  // Para 'convert':
  neutralsToConvert?: Array<{ row: number; col: number }>;
  ownToNeutral?: { row: number; col: number };
}

export interface NetworkNexState {
  board: NetworkNexCelula[][];
  currentPlayer: 'player1' | 'player2';
  lastMove: NetworkNexMove | null;
  winner: 'player1' | 'player2' | null;
  moveCount: number;
  canSwap: boolean;
  swapped: boolean;
}

// Conversões Nex
export function toNetworkNexMove(move: NexAcao | { tipo: 'swap' }): NetworkNexMove {
  if (move.tipo === 'swap') {
    return { type: 'swap' };
  }
  
  if (move.tipo === 'colocacao') {
    const colocacao = move as AcaoColocacao;
    return {
      type: 'place',
      ownPiece: { row: colocacao.posPropria.x, col: colocacao.posPropria.y },
      neutralPiece: { row: colocacao.posNeutra.x, col: colocacao.posNeutra.y },
    };
  }
  
  if (move.tipo === 'substituicao') {
    const substituicao = move as AcaoSubstituicao;
    return {
      type: 'convert',
      neutralsToConvert: substituicao.neutrasParaProprias.map(p => ({ row: p.x, col: p.y })),
      ownToNeutral: { row: substituicao.propriaParaNeutra.x, col: substituicao.propriaParaNeutra.y },
    };
  }
  
  throw new Error('Invalid Nex move type');
}

export function fromNetworkNexMove(move: NetworkNexMove): NexAcao | { tipo: 'swap' } {
  if (move.type === 'swap') {
    return { tipo: 'swap' };
  }
  
  if (move.type === 'place' && move.ownPiece && move.neutralPiece) {
    return {
      tipo: 'colocacao',
      posPropria: { x: move.ownPiece.row, y: move.ownPiece.col },
      posNeutra: { x: move.neutralPiece.row, y: move.neutralPiece.col },
    };
  }
  
  if (move.type === 'convert' && move.neutralsToConvert && move.ownToNeutral) {
    return {
      tipo: 'substituicao',
      neutrasParaProprias: move.neutralsToConvert.map(p => ({ x: p.row, y: p.col })) as [NexPosicao, NexPosicao],
      propriaParaNeutra: { x: move.ownToNeutral.row, y: move.ownToNeutral.col },
    };
  }
  
  throw new Error('Invalid network Nex move');
}

export function toNetworkNexState(state: NexState): NetworkNexState {
  const celulaMap: Record<string, NetworkNexCelula> = {
    'vazia': 'empty',
    'preta': 'black',
    'branca': 'white',
    'neutra': 'neutral',
  };
  
  return {
    board: state.tabuleiro.map(row => row.map(c => celulaMap[c])),
    currentPlayer: state.jogadorAtual === 'jogador1' ? 'player1' : 'player2',
    lastMove: null, // Not tracked
    winner: state.estado === 'vitoria-jogador1' ? 'player1' 
          : state.estado === 'vitoria-jogador2' ? 'player2'
          : null,
    moveCount: state.primeiraJogada ? 0 : 1, // Approximation
    canSwap: state.swapDisponivel,
    swapped: state.swapEfetuado,
  };
}

export function fromNetworkNexState(
  net: NetworkNexState,
  modo: 'vs-computador' | 'dois-jogadores' = 'dois-jogadores'
): NexState {
  const celulaMap: Record<NetworkNexCelula, 'vazia' | 'preta' | 'branca' | 'neutra'> = {
    'empty': 'vazia',
    'black': 'preta',
    'white': 'branca',
    'neutral': 'neutra',
  };
  
  return {
    tabuleiro: net.board.map(row => row.map(c => celulaMap[c])),
    modo,
    jogadorAtual: net.currentPlayer === 'player1' ? 'jogador1' : 'jogador2',
    estado: net.winner === 'player1' ? 'vitoria-jogador1' 
          : net.winner === 'player2' ? 'vitoria-jogador2'
          : 'a-jogar',
    primeiraJogada: net.moveCount === 0,
    swapDisponivel: net.canSwap,
    swapEfetuado: net.swapped,
    acaoEmCurso: {
      tipo: null,
      posPropria: null,
      posNeutra: null,
      neutrasParaProprias: [],
      propriaParaNeutra: null,
    },
  };
}

// ============================================================================
// Generic converters by GameId
// ============================================================================

export type NetworkGameState = 
  | NetworkGatosCaesState 
  | NetworkDominorioState 
  | NetworkQuelhasState
  | NetworkProdutoState
  | NetworkAtariGoState
  | NetworkNexState;

export type NetworkGameMove = 
  | NetworkGatosCaesMove 
  | NetworkDominorioMove 
  | NetworkQuelhasMove
  | NetworkProdutoMove
  | NetworkAtariGoMove
  | NetworkNexMove;

export type LocalGameState = 
  | GatosCaesState 
  | DominorioState 
  | QuelhasState
  | ProdutoState
  | AtariGoState
  | NexState;

/**
 * Convert network state to local state based on gameId
 */
export function fromNetworkGameState(gameId: GameId, state: unknown): LocalGameState {
  switch (gameId) {
    case 'gatos-caes':
      return fromNetworkGatosCaesState(state as NetworkGatosCaesState);
    case 'dominorio':
      return fromNetworkDominorioState(state as NetworkDominorioState);
    case 'quelhas':
      return fromNetworkQuelhasState(state as NetworkQuelhasState);
    case 'produto':
      return fromNetworkProdutoState(state as NetworkProdutoState);
    case 'atari-go':
      return fromNetworkAtariGoState(state as NetworkAtariGoState);
    case 'nex':
      return fromNetworkNexState(state as NetworkNexState);
    default:
      throw new Error(`Unknown game: ${gameId}`);
  }
}

/**
 * Convert local state to network state based on gameId
 */
export function toNetworkGameState(gameId: GameId, state: LocalGameState): NetworkGameState {
  switch (gameId) {
    case 'gatos-caes':
      return toNetworkGatosCaesState(state as GatosCaesState);
    case 'dominorio':
      return toNetworkDominorioState(state as DominorioState);
    case 'quelhas':
      return toNetworkQuelhasState(state as QuelhasState);
    case 'produto':
      return toNetworkProdutoState(state as ProdutoState);
    case 'atari-go':
      return toNetworkAtariGoState(state as AtariGoState);
    case 'nex':
      return toNetworkNexState(state as NexState);
    default:
      throw new Error(`Unknown game: ${gameId}`);
  }
}
