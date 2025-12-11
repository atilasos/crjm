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

// ============================================================================
// Tipos
// ============================================================================

export type GameState = GatosCaesState | DominorioState;

export type GameMove = GatosCaesPosicao | Domino;

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
// Mapa de adaptadores
// ============================================================================

const adapters: Partial<Record<GameId, GameAdapter>> = {
  'gatos-caes': gatosCaesAdapter,
  'dominorio': dominorioAdapter,
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
