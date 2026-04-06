import type { AtariGoState, Celula } from '../types';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard';

export interface AtariGoPackedState {
  board: Uint8Array; // 81 cells: 0 empty, 1 black, 2 white
  toPlay: 0 | 1; // 0 = pretas (jogador1), 1 = brancas (jogador2)
}

export interface AISearchStats {
  nodes?: number;
  depth?: number;
  ttHits?: number;
  ttProbes?: number;
  cutoffs?: number;
  elapsedMs?: number;
}

export interface AIMetrics {
  isThinking: boolean;
  lastTimeMs: number;
  usedWasm: boolean;
  lastStats?: AISearchStats;
}

export const INITIAL_METRICS: AIMetrics = {
  isThinking: false,
  lastTimeMs: 0,
  usedWasm: false,
};

export interface DifficultyPreset {
  timeMs: number;
  level: 1 | 2 | 3 | 4;
}

export interface AIComputeOverrides {
  timeBudgetMs?: number;
  seed?: number;
}

export const DIFFICULTY_PRESETS: Record<AIDifficulty, DifficultyPreset> = {
  easy: { timeMs: 3000, level: 1 },
  medium: { timeMs: 6000, level: 2 },
  hard: { timeMs: 10000, level: 3 },
  'very-hard': { timeMs: 15000, level: 4 },
};

export type AIRequest =
  | {
      type: 'choose';
      id: number;
      state: AtariGoPackedState;
      difficulty: AIDifficulty;
      timeBudgetMs?: number;
      seed?: number;
    }
  | { type: 'cancel'; id: number };

export type AIResponse =
  | { type: 'ready'; usedWasm: boolean }
  | {
      type: 'result';
      id: number;
      move: number | null; // 0..80
      elapsedMs: number;
      usedWasm: boolean;
      stats?: AISearchStats;
    }
  | { type: 'error'; id: number; message: string };

export function packBoard(tabuleiro: Celula[][]): Uint8Array {
  const out = new Uint8Array(81);
  let k = 0;
  for (let linha = 0; linha < 9; linha++) {
    for (let coluna = 0; coluna < 9; coluna++) {
      const c = tabuleiro[linha][coluna];
      out[k++] = c === 'vazia' ? 0 : c === 'preta' ? 1 : 2;
    }
  }
  return out;
}

export function packState(state: AtariGoState): AtariGoPackedState {
  return {
    board: packBoard(state.tabuleiro),
    toPlay: state.jogadorAtual === 'jogador1' ? 0 : 1,
  };
}
