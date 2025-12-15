import type { NexState, Posicao } from '../types';
import { LADO_TABULEIRO, posToKey } from '../types';
import { getCorJogador, podeColocar, podeSubstituir } from '../logic';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'master';

export interface NexAiActionSwap {
  type: 'swap';
}

export interface NexAiActionRecusarSwap {
  type: 'recusar_swap';
}

export interface NexAiActionColocar {
  type: 'colocar';
  own: Posicao;
  neutral: Posicao;
}

export interface NexAiActionSubstituir {
  type: 'substituir';
  n1: Posicao;
  n2: Posicao;
  sacrifice: Posicao;
}

export type NexAiAction = NexAiActionSwap | NexAiActionRecusarSwap | NexAiActionColocar | NexAiActionSubstituir;

export interface NexPackedState {
  board: Uint8Array; // 121 bytes: 0 vazio, 1 preta, 2 branca, 3 neutra
  toPlay: 0 | 1; // 0=pretas, 1=brancas (cor do jogador atual)
  flags: number; // bit0=swapDisponivel, bit1=swapEfetuado, bit2=primeiraJogada
}

export interface DifficultyPreset {
  timeMs: number;
  level: number; // 1..4 (WASM)
}

export const DIFFICULTY_PRESETS: Record<AIDifficulty, DifficultyPreset> = {
  easy: { timeMs: 3000, level: 1 },
  medium: { timeMs: 6000, level: 2 },
  hard: { timeMs: 10000, level: 3 },
  master: { timeMs: 15000, level: 4 },
};

export interface AIMetrics {
  isThinking: boolean;
  lastTimeMs: number;
  usedWasm: boolean;
  lastExplain?: string;
}

export const INITIAL_METRICS: AIMetrics = {
  isThinking: false,
  lastTimeMs: 0,
  usedWasm: false,
};

export type AIRequest =
  | {
      type: 'choose';
      id: number;
      state: NexPackedState;
      difficulty: AIDifficulty;
      seed: number;
    };

export type AIResponse =
  | { type: 'ready'; usedWasm: boolean }
  | { type: 'result'; id: number; action: NexAiAction | null; elapsedMs: number; usedWasm: boolean; explain?: string }
  | { type: 'error'; id: number; message: string };

function dentro(pos: Posicao): boolean {
  return pos.x >= 0 && pos.x < LADO_TABULEIRO && pos.y >= 0 && pos.y < LADO_TABULEIRO;
}

export function packState(state: NexState): NexPackedState {
  const board = new Uint8Array(LADO_TABULEIRO * LADO_TABULEIRO);
  for (let x = 0; x < LADO_TABULEIRO; x++) {
    for (let y = 0; y < LADO_TABULEIRO; y++) {
      const v = state.tabuleiro[x][y];
      const idx = x * LADO_TABULEIRO + y;
      board[idx] = v === 'vazia' ? 0 : v === 'preta' ? 1 : v === 'branca' ? 2 : 3;
    }
  }

  const toPlay = (getCorJogador(state, state.jogadorAtual) === 'preta' ? 0 : 1) as 0 | 1;
  const flags =
    (state.swapDisponivel ? 1 : 0) |
    (state.swapEfetuado ? 2 : 0) |
    (state.primeiraJogada ? 4 : 0);

  return { board, toPlay, flags };
}

export function isValidAiAction(state: NexState, action: NexAiAction | null): action is NexAiAction {
  if (!action) return false;

  if (action.type === 'swap') {
    return state.swapDisponivel;
  }

  if (action.type === 'recusar_swap') {
    return state.swapDisponivel;
  }

  if (state.swapDisponivel) {
    return false;
  }

  if (action.type === 'colocar') {
    if (!podeColocar(state.tabuleiro)) return false;
    if (!dentro(action.own) || !dentro(action.neutral)) return false;
    if (posToKey(action.own) === posToKey(action.neutral)) return false;
    return state.tabuleiro[action.own.x][action.own.y] === 'vazia' && state.tabuleiro[action.neutral.x][action.neutral.y] === 'vazia';
  }

  if (action.type === 'substituir') {
    if (!podeSubstituir(state.tabuleiro, state.jogadorAtual, state.swapEfetuado)) return false;
    if (!dentro(action.n1) || !dentro(action.n2) || !dentro(action.sacrifice)) return false;
    if (posToKey(action.n1) === posToKey(action.n2)) return false;
    const cor = getCorJogador(state, state.jogadorAtual);
    return (
      state.tabuleiro[action.n1.x][action.n1.y] === 'neutra' &&
      state.tabuleiro[action.n2.x][action.n2.y] === 'neutra' &&
      state.tabuleiro[action.sacrifice.x][action.sacrifice.y] === cor
    );
  }

  return false;
}
