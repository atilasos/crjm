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
      const rowArr = [...rows];
      const linha = rowArr[0];
      if (typeof linha !== 'number') return null;

      const colunas = [...cols].sort((a, b) => a - b);
      const colunaMin = colunas[0];
      const colunaMax = colunas[colunas.length - 1];
      if (typeof colunaMin !== 'number' || typeof colunaMax !== 'number') return null;

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
    const colArr = [...cols];
    const coluna = colArr[0];
    if (typeof coluna !== 'number') return null;

    const linhas = [...rows].sort((a, b) => a - b);
    const linhaMin = linhas[0];
    const linhaMax = linhas[linhas.length - 1];
    if (typeof linhaMin !== 'number' || typeof linhaMax !== 'number') return null;

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

// ============================================================================
// Adaptador para Produto
// ============================================================================

function parseProdutoMove(move: unknown, state: ProdutoState): Array<{ pos: ProdutoPosicao; cor: 'preta' | 'branca' }> | null {
  if (!move || typeof move !== 'object') return null;
  const anyMove = move as any;

  // 1. Formato local: { pos: { q, r }, cor } ou { q, r, cor }
  let pPos = anyMove.pos || (typeof anyMove.q === 'number' && typeof anyMove.r === 'number' ? { q: anyMove.q, r: anyMove.r } : null);
  let pCor = anyMove.cor;

  if (pPos && pCor) {
    if (pCor === 'preta' || pCor === 'branca') {
      return [{ pos: pPos, cor: pCor }];
    }
  }

  // 2. Formato de rede: { placements: [{ coord, color }, ...] }
  if (Array.isArray(anyMove.placements)) {
    const placements = anyMove.placements;
    // Se estivermos a enviar placements peça a peça do cliente, ou a jogada completa
    const result: Array<{ pos: ProdutoPosicao; cor: 'preta' | 'branca' }> = [];

    for (const p of placements) {
      if (p && p.coord && p.color) {
        result.push({
          pos: { q: p.coord.q, r: p.coord.r },
          cor: p.color === 'black' ? 'preta' : 'branca'
        });
      }
    }

    if (result.length > 0) {
      // Se houver múltiplas peças, mas o state já tem uma em curso, 
      // talvez queiramos apenas as que faltam? 
      // No servidor, o mais seguro é:
      // - Se a primeira peça do placements já é igual à pos1 em curso, ignoramos a primeira.
      if (state.jogadaEmCurso.pos1 && result.length >= 2) {
        const p1 = result[0];
        const s1 = state.jogadaEmCurso.pos1;
        if (p1 && p1.pos.q === s1.q && p1.pos.r === s1.r && result[1]) {
          return [result[1]]; // Só aplica a segunda
        }
      }
      return result;
    }
  }

  return null;
}

const produtoAdapter: GameAdapter = {
  createInitialState(): ProdutoState {
    return criarProduto('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): ProdutoState | null {
    let pState = state as ProdutoState;
    const parsed = parseProdutoMove(move, pState);

    if (!parsed) return null;

    if (!this.isValidMove(pState, move)) {
      return null;
    }

    // Aplicar cada peça
    let currentState = pState;
    for (const item of parsed) {
      currentState = colocarProdutoPeca(currentState, item.pos, item.cor);
    }
    return currentState;
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const pState = state as ProdutoState;
    const parsed = parseProdutoMove(move, pState);

    if (!parsed) return false;

    let tempState = pState;
    for (const item of parsed) {
      if (!item.pos || typeof item.pos.q !== 'number' || typeof item.pos.r !== 'number') return false;
      if (item.cor !== 'preta' && item.cor !== 'branca') return false;

      // Na primeira jogada do jogo, a peça tem de ser da cor do jogador
      if (pState.primeiraJogada) {
        const corEsperada = pState.jogadorAtual === 'jogador1' ? 'preta' : 'branca';
        if (item.cor !== corEsperada) return false;
      }

      const key = `${item.pos.q},${item.pos.r}`;
      if (tempState.tabuleiro[key] !== 'vazia') return false;
      // ... rest of the loop
      if (tempState.jogadaEmCurso.pos1) {
        const p1 = tempState.jogadaEmCurso.pos1;
        if (p1.q === item.pos.q && p1.r === item.pos.r) return false;
      }
      tempState = colocarProdutoPeca(tempState, item.pos, item.cor);
    }

    return true;
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

// ============================================================================
// Adaptador para Atari Go
// ============================================================================

function parseAtariGoMove(move: unknown): AtariGoPosicao | null {
  if (!move || typeof move !== 'object') return null;
  const anyMove = move as any;

  // 1. Formato local: { linha, coluna }
  if (typeof anyMove.linha === 'number' && typeof anyMove.coluna === 'number') {
    return { linha: anyMove.linha, coluna: anyMove.coluna };
  }

  // 2. Formato de rede: { row, col, pass? }
  if (typeof anyMove.row === 'number' && typeof anyMove.col === 'number') {
    // Nota: pass não é suportado no logic.ts atual de Atari Go mas o protocolo prevê
    return { linha: anyMove.row, coluna: anyMove.col };
  }

  return null;
}

const atariGoAdapter: GameAdapter = {
  createInitialState(): AtariGoState {
    return criarAtariGo('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): AtariGoState | null {
    const agState = state as AtariGoState;
    const parsed = parseAtariGoMove(move);

    if (!parsed || !this.isValidMove(agState, move)) {
      return null;
    }

    return colocarAtariGoPedra(agState, parsed);
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const agState = state as AtariGoState;
    const parsed = parseAtariGoMove(move);

    if (!parsed) return false;

    return isJogadaValidaAtariGo(agState, parsed);
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

// ============================================================================
// Adaptador para Nex
// ============================================================================

function parseNexMove(move: unknown): NexAcao | { type: 'nex_swap' | 'swap' } | null {
  if (!move || typeof move !== 'object') return null;
  const anyMove = move as any;

  // 1. Formato local: { tipo: 'colocacao' | 'substituicao', ... } ou { type: 'nex_swap' }
  if (anyMove.tipo === 'colocacao' || anyMove.tipo === 'substituicao') {
    return anyMove as NexAcao;
  }
  if (anyMove.tipo === 'swap' || anyMove.type === 'nex_swap' || anyMove.type === 'swap') {
    return { type: 'swap' };
  }

  // 2. Formato de rede: { type: 'place' | 'convert' | 'swap', ... }
  if (anyMove.type === 'place') {
    if (!anyMove.ownPiece || !anyMove.neutralPiece) return null;
    return {
      tipo: 'colocacao',
      posPropria: { x: anyMove.ownPiece.row, y: anyMove.ownPiece.col },
      posNeutra: { x: anyMove.neutralPiece.row, y: anyMove.neutralPiece.col }
    };
  }

  if (anyMove.type === 'convert') {
    if (!Array.isArray(anyMove.neutralsToConvert) || anyMove.neutralsToConvert.length !== 2 || !anyMove.ownToNeutral) return null;
    return {
      tipo: 'substituicao',
      neutrasParaProprias: [
        { x: anyMove.neutralsToConvert[0].row, y: anyMove.neutralsToConvert[0].col },
        { x: anyMove.neutralsToConvert[1].row, y: anyMove.neutralsToConvert[1].col }
      ],
      propriaParaNeutra: { x: anyMove.ownToNeutral.row, y: anyMove.ownToNeutral.col }
    };
  }

  return null;
}

const nexAdapter: GameAdapter = {
  createInitialState(): NexState {
    return criarNex('dois-jogadores');
  },

  applyMove(state: GameState, move: unknown): NexState | null {
    const nState = state as NexState;
    const parsed = parseNexMove(move);

    if (!parsed) return null;

    // Tratamento de Swap
    if ('type' in parsed && parsed.type === 'swap') {
      if (!nState.swapDisponivel) return null;
      return executarNexSwap(nState);
    }

    // Tratamento de Ação
    const nAcao = parsed as NexAcao;
    if (nAcao.tipo === 'colocacao' || nAcao.tipo === 'substituicao') {
      if (!this.isValidMove(nState, move)) return null;
      const tempState = { ...nState, acaoEmCurso: nAcao as any };
      return executarNexAcao(tempState);
    }

    return null;
  },

  isValidMove(state: GameState, move: unknown): boolean {
    const nState = state as NexState;
    const parsed = parseNexMove(move);

    if (!parsed) return false;

    if ('type' in parsed && parsed.type === 'swap') {
      return nState.swapDisponivel;
    }

    const nMove = parsed as NexAcao;
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
