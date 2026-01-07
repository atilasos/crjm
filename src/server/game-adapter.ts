/**
 * Adaptador de jogos para o servidor de torneios.
 * 
 * Reutiliza a lógica existente de cada jogo para:
 * - Criar estados iniciais
 * - Validar e aplicar jogadas
 * - Detetar fim de jogo e vencedor
 */

import type { GameId } from '../tournament/protocol';

// Importar lógica dos jogos
import {
  criarEstadoInicial as criarGatosCaes,
  colocarPeca as colocarGatosCaes,
  isJogadaValida as isJogadaValidaGatosCaes,
} from '../games/gatos-caes/logic';

import {
  criarEstadoInicial as criarDominorio,
  colocarDomino as colocarDominorio,
  isJogadaValida as isJogadaValidaDominorio,
} from '../games/dominorio/logic';

import type { GatosCaesState, Posicao as GatosCaesPosicao } from '../games/gatos-caes/types';
import type { DominorioState, Domino } from '../games/dominorio/types';
import {
  criarEstadoInicial as criarQuelhas,
  colocarSegmento as colocarQuelhasSegmento,
  isSegmentoValido as isSegmentoValidoQuelhas,
  trocarOrientacoes as trocarOrientacoesQuelhas,
} from '../games/quelhas/logic';
import type { QuelhasState, Segmento as QuelhasSegmento } from '../games/quelhas/types';

import {
  criarEstadoInicial as criarProduto,
  colocarPeca as colocarProdutoPeca,
  getCasasVazias as getProdutoVazias,
} from '../games/produto/logic';
import type { ProdutoState, Posicao as ProdutoPosicao } from '../games/produto/types';

import {
  criarEstadoInicial as criarAtariGo,
  colocarPedra as colocarAtariGoPedra,
  isJogadaValida as isJogadaValidaAtariGo,
} from '../games/atari-go/logic';
import type { AtariGoState, Posicao as AtariGoPosicao } from '../games/atari-go/types';

import {
  criarEstadoInicial as criarNex,
  executarAcao as executarNexAcao,
  executarSwap as executarNexSwap,
  converterAcaoEmCurso as converterNexAcaoEmCurso,
  isAcaoCompleta as isNexAcaoCompleta,
  getCorJogador as getNexCorJogador,
} from '../games/nex/logic';
import type { NexState, Acao as NexAcao, AcaoEmCurso as NexAcaoEmCurso } from '../games/nex/types';

// ============================================================================
// Tipos
// ============================================================================

export type GameState = GatosCaesState | DominorioState | QuelhasState | ProdutoState | AtariGoState | NexState;

export type GameMove =
  | GatosCaesPosicao
  | Domino
  | QuelhasSegmento
  | { swap: true }
  | { pos: ProdutoPosicao; cor: 'preta' | 'branca' }
  | AtariGoPosicao
  | NexAcao
  | { type: 'nex_swap' }
  | NexAcaoEmCurso;

export interface GameAdapter {
  createInitialState(): GameState;
  applyMove(state: GameState, move: unknown): GameState | null;
  isValidMove(state: GameState, move: unknown): boolean;
  isGameOver(state: GameState): boolean;
  getWinner(state: GameState): 'jogador1' | 'jogador2' | null;
  getCurrentPlayer(state: GameState): 'jogador1' | 'jogador2';
}

// ============================================================================
// Adaptador para Gatos & Cães
// ============================================================================

const gatosCaesAdapter: GameAdapter = {
  createInitialState(): GatosCaesState {
    return criarGatosCaes('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): GatosCaesState | null {
    const gcState = state as GatosCaesState;
    const pos = move as GatosCaesPosicao;

    if (!this.isValidMove(gcState, pos)) {
      return null;
    }

    return colocarGatosCaes(gcState, pos);
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const gcState = state as GatosCaesState;
    const pos = move as GatosCaesPosicao;

    // Validação básica de estrutura
    if (!pos || typeof pos.linha !== 'number' || typeof pos.coluna !== 'number') {
      return false;
    }

    return isJogadaValidaGatosCaes(gcState, pos);
  },

  isGameOver(state: GameState): boolean {
    return state.estado !== 'a-jogar';
  },

  getWinner(state: GameState): 'jogador1' | 'jogador2' | null {
    if (state.estado === 'vitoria-jogador1') return 'jogador1';
    if (state.estado === 'vitoria-jogador2') return 'jogador2';
    return null;
  },

  getCurrentPlayer(state: GameState): 'jogador1' | 'jogador2' {
    return state.jogadorAtual;
  },
};

// ============================================================================
// Adaptador para Dominório
// ============================================================================

const dominorioAdapter: GameAdapter = {
  createInitialState(): DominorioState {
    return criarDominorio('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): DominorioState | null {
    const domState = state as DominorioState;
    const domino = move as Domino;

    if (!this.isValidMove(domState, domino)) {
      return null;
    }

    return colocarDominorio(domState, domino);
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const domState = state as DominorioState;
    const domino = move as Domino;

    // Validação básica de estrutura
    if (!domino || !domino.pos1 || !domino.pos2) {
      return false;
    }
    if (typeof domino.pos1.linha !== 'number' || typeof domino.pos1.coluna !== 'number') {
      return false;
    }
    if (typeof domino.pos2.linha !== 'number' || typeof domino.pos2.coluna !== 'number') {
      return false;
    }

    return isJogadaValidaDominorio(domState, domino);
  },

  isGameOver(state: GameState): boolean {
    return state.estado !== 'a-jogar';
  },

  getWinner(state: GameState): 'jogador1' | 'jogador2' | null {
    if (state.estado === 'vitoria-jogador1') return 'jogador1';
    if (state.estado === 'vitoria-jogador2') return 'jogador2';
    return null;
  },

  getCurrentPlayer(state: GameState): 'jogador1' | 'jogador2' {
    return state.jogadorAtual;
  },
};

// ============================================================================
// Adaptador para Quelhas
// ============================================================================

function parseQuelhasMove(move: unknown): { kind: 'swap' } | { kind: 'segmento'; segmento: QuelhasSegmento } | null {
  if (!move || typeof move !== 'object') return null;
  const anyMove = move as any;

  // Regra de troca
  if (anyMove.swap === true) {
    const cells = anyMove.cells;
    if (cells == null || (Array.isArray(cells) && cells.length === 0)) {
      return { kind: 'swap' };
    }
    return null;
  }

  // Segmento no formato local
  if (
    anyMove.inicio &&
    typeof anyMove.inicio.linha === 'number' &&
    typeof anyMove.inicio.coluna === 'number' &&
    typeof anyMove.comprimento === 'number' &&
    (anyMove.orientacao === 'vertical' || anyMove.orientacao === 'horizontal')
  ) {
    return {
      kind: 'segmento',
      segmento: {
        inicio: { linha: anyMove.inicio.linha, coluna: anyMove.inicio.coluna },
        comprimento: anyMove.comprimento,
        orientacao: anyMove.orientacao,
      },
    };
  }

  // Segmento no formato de rede: { cells: [{row,col}, ...] }
  if (Array.isArray(anyMove.cells) && anyMove.cells.length >= 2) {
    const cells = anyMove.cells as Array<{ row: unknown; col: unknown }>;
    const parsed = cells
      .map(c => ({ row: Number(c?.row), col: Number(c?.col) }))
      .filter(c => Number.isFinite(c.row) && Number.isFinite(c.col));

    if (parsed.length !== cells.length) return null;

    const rows = new Set<number>(parsed.map(c => c.row));
    const cols = new Set<number>(parsed.map(c => c.col));

    let orientacao: 'vertical' | 'horizontal' | null = null;
    if (rows.size === 1 && cols.size >= 2) orientacao = 'horizontal';
    if (cols.size === 1 && rows.size >= 2) orientacao = 'vertical';
    if (!orientacao) return null;

    if (orientacao === 'horizontal') {
      const linha = parsed[0].row;
      const colunas = [...cols].sort((a, b) => a - b);
      const colunaMin = colunas[0];
      const colunaMax = colunas[colunas.length - 1];
      const comprimento = colunaMax - colunaMin + 1;
      if (comprimento !== parsed.length) return null;
      const unique = new Set(parsed.map(c => `${c.row},${c.col}`));
      if (unique.size !== parsed.length) return null;
      for (let c = colunaMin; c <= colunaMax; c++) {
        if (!unique.has(`${linha},${c}`)) return null;
      }
      return { kind: 'segmento', segmento: { inicio: { linha, coluna: colunaMin }, comprimento, orientacao } };
    }

    // vertical
    const coluna = parsed[0].col;
    const linhas = [...rows].sort((a, b) => a - b);
    const linhaMin = linhas[0];
    const linhaMax = linhas[linhas.length - 1];
    const comprimento = linhaMax - linhaMin + 1;
    if (comprimento !== parsed.length) return null;
    const unique = new Set(parsed.map(c => `${c.row},${c.col}`));
    if (unique.size !== parsed.length) return null;
    for (let r = linhaMin; r <= linhaMax; r++) {
      if (!unique.has(`${r},${coluna}`)) return null;
    }
    return { kind: 'segmento', segmento: { inicio: { linha: linhaMin, coluna }, comprimento, orientacao } };
  }

  return null;
}

const quelhasAdapter: GameAdapter = {
  createInitialState(): QuelhasState {
    return criarQuelhas('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): QuelhasState | null {
    const qState = state as QuelhasState;
    const parsed = parseQuelhasMove(move);
    if (!parsed) return null;

    if (parsed.kind === 'swap') {
      const next = trocarOrientacoesQuelhas(qState);
      return next === qState ? null : next;
    }

    const next = colocarQuelhasSegmento(qState, parsed.segmento);
    return next === qState ? null : next;
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const qState = state as QuelhasState;
    const parsed = parseQuelhasMove(move);
    if (!parsed) return false;

    if (parsed.kind === 'swap') {
      return qState.estado === 'a-jogar' && qState.trocaDisponivel;
    }

    return isSegmentoValidoQuelhas(qState, parsed.segmento);
  },

  isGameOver(state: GameState): boolean {
    return state.estado !== 'a-jogar';
  },

  getWinner(state: GameState): 'jogador1' | 'jogador2' | null {
    const qState = state as QuelhasState;
    if (qState.estado === 'vitoria-jogador1') return 'jogador1';
    if (qState.estado === 'vitoria-jogador2') return 'jogador2';
    return null;
  },

  getCurrentPlayer(state: GameState): 'jogador1' | 'jogador2' {
    return state.jogadorAtual;
  },
};

// ============================================================================
// Adaptador para Produto
// ============================================================================

const produtoAdapter: GameAdapter = {
  createInitialState(): ProdutoState {
    return criarProduto('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): ProdutoState | null {
    const pState = state as ProdutoState;
    const pMove = move as { pos: ProdutoPosicao; cor: 'preta' | 'branca' };

    if (!this.isValidMove(pState, pMove)) {
      return null;
    }

    return colocarProdutoPeca(pState, pMove.pos, pMove.cor);
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const pState = state as ProdutoState;
    const pMove = move as { pos: ProdutoPosicao; cor: 'preta' | 'branca' };

    if (!pMove || !pMove.pos || !pMove.cor) return false;
    if (typeof pMove.pos.q !== 'number' || typeof pMove.pos.r !== 'number') return false;
    if (pMove.cor !== 'preta' && pMove.cor !== 'branca') return false;

    // Verificar se casa está vazia
    const key = `${pMove.pos.q},${pMove.pos.r}`;
    return pState.tabuleiro[key] === 'vazia';
  },

  isGameOver(state: GameState): boolean {
    return state.estado !== 'a-jogar';
  },

  getWinner(state: GameState): 'jogador1' | 'jogador2' | null {
    if (state.estado === 'vitoria-jogador1') return 'jogador1';
    if (state.estado === 'vitoria-jogador2') return 'jogador2';
    return null;
  },

  getCurrentPlayer(state: GameState): 'jogador1' | 'jogador2' {
    return state.jogadorAtual;
  },
};

// ============================================================================
// Adaptador para Atari Go
// ============================================================================

const atariGoAdapter: GameAdapter = {
  createInitialState(): AtariGoState {
    return criarAtariGo('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): AtariGoState | null {
    const agState = state as AtariGoState;
    const pos = move as AtariGoPosicao;

    if (!this.isValidMove(agState, pos)) {
      return null;
    }

    return colocarAtariGoPedra(agState, pos);
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const agState = state as AtariGoState;
    const pos = move as AtariGoPosicao;

    if (!pos || typeof pos.linha !== 'number' || typeof pos.coluna !== 'number') {
      return false;
    }

    return isJogadaValidaAtariGo(agState, pos);
  },

  isGameOver(state: GameState): boolean {
    return state.estado !== 'a-jogar';
  },

  getWinner(state: GameState): 'jogador1' | 'jogador2' | null {
    if (state.estado === 'vitoria-jogador1') return 'jogador1';
    if (state.estado === 'vitoria-jogador2') return 'jogador2';
    return null;
  },

  getCurrentPlayer(state: GameState): 'jogador1' | 'jogador2' {
    return state.jogadorAtual;
  },
};

// ============================================================================
// Adaptador para Nex
// ============================================================================

const nexAdapter: GameAdapter = {
  createInitialState(): NexState {
    return criarNex('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): NexState | null {
    const nState = state as NexState;

    // Tratamento de Swap
    if (move && typeof move === 'object' && (move as any).type === 'nex_swap') {
      if (!nState.swapDisponivel) return null;
      return executarNexSwap(nState);
    }

    // Tratamento de Ação Completa ou Ação em Curso
    const nMove = move as NexAcao;
    if (nMove.tipo === 'colocacao' || nMove.tipo === 'substituicao') {
      const tempState = { ...nState, acaoEmCurso: nMove as any };
      return executarNexAcao(tempState);
    }

    return null;
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const nState = state as NexState;

    if (move && typeof move === 'object' && (move as any).type === 'nex_swap') {
      return nState.swapDisponivel;
    }

    const nMove = move as NexAcao;
    if (nMove.tipo === 'colocacao') {
      const posP = nMove.posPropria;
      const posN = nMove.posNeutra;
      if (!posP || !posN) return false;
      const rowP = nState.tabuleiro[posP.x];
      const rowN = nState.tabuleiro[posN.x];
      if (!rowP || !rowN) return false;

      return rowP[posP.y] === 'vazia' &&
        rowN[posN.y] === 'vazia' &&
        (posP.x !== posN.x || posP.y !== posN.y);
    }

    if (nMove.tipo === 'substituicao') {
      const n2p = nMove.neutrasParaProprias;
      const p2n = nMove.propriaParaNeutra;
      if (!n2p || n2p.length !== 2 || !p2n) return false;

      const corJogador = getNexCorJogador(nState, nState.jogadorAtual);
      const row0 = nState.tabuleiro[n2p[0].x];
      const row1 = nState.tabuleiro[n2p[1].x];
      const rowP2N = nState.tabuleiro[p2n.x];

      if (!row0 || !row1 || !rowP2N) return false;

      return row0[n2p[0].y] === 'neutra' &&
        row1[n2p[1].y] === 'neutra' &&
        rowP2N[p2n.y] === corJogador;
    }

    return false;
  },

  isGameOver(state: GameState): boolean {
    return state.estado !== 'a-jogar';
  },

  getWinner(state: GameState): 'jogador1' | 'jogador2' | null {
    if (state.estado === 'vitoria-jogador1') return 'jogador1';
    if (state.estado === 'vitoria-jogador2') return 'jogador2';
    return null;
  },

  getCurrentPlayer(state: GameState): 'jogador1' | 'jogador2' {
    return state.jogadorAtual;
  },
};

// ============================================================================
// Mapa de adaptadores
// ============================================================================

const adapters: Record<GameId, GameAdapter> = {
  'gatos-caes': gatosCaesAdapter,
  'dominorio': dominorioAdapter,
  'quelhas': quelhasAdapter,
  'produto': produtoAdapter,
  'atari-go': atariGoAdapter,
  'nex': nexAdapter,
};

// ============================================================================
// Funções públicas
// ============================================================================

export function getGameAdapter(gameId: GameId): GameAdapter | null {
  return adapters[gameId] ?? null;
}

export function getSupportedGames(): GameId[] {
  return Object.keys(adapters) as GameId[];
}

export function isGameSupported(gameId: GameId): boolean {
  return gameId in adapters;
}

// ============================================================================
// Funções de conveniência
// ============================================================================

export function createGameState(gameId: GameId): GameState | null {
  const adapter = getGameAdapter(gameId);
  if (!adapter) return null;
  return adapter.createInitialState();
}

export function applyGameMove(
  gameId: GameId,
  state: GameState,
  move: unknown
): GameState | null {
  const adapter = getGameAdapter(gameId);
  if (!adapter) return null;
  return adapter.applyMove(state, move);
}

export function isValidGameMove(
  gameId: GameId,
  state: GameState,
  move: unknown
): boolean {
  const adapter = getGameAdapter(gameId);
  if (!adapter) return false;
  return adapter.isValidMove(state, move);
}

export function isGameFinished(gameId: GameId, state: GameState): boolean {
  const adapter = getGameAdapter(gameId);
  if (!adapter) return false;
  return adapter.isGameOver(state);
}

export function getGameWinner(
  gameId: GameId,
  state: GameState
): 'jogador1' | 'jogador2' | null {
  const adapter = getGameAdapter(gameId);
  if (!adapter) return null;
  return adapter.getWinner(state);
}

export function getCurrentGamePlayer(
  gameId: GameId,
  state: GameState
): 'jogador1' | 'jogador2' {
  const adapter = getGameAdapter(gameId);
  if (!adapter) return 'jogador1';
  return adapter.getCurrentPlayer(state);
}
