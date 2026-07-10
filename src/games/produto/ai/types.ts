import type { Posicao, ProdutoState } from '../types';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard' | 'max';

export interface ProdutoPackedState {
  blackLo: number;
  blackHi: number;
  whiteLo: number;
  whiteHi: number;
  playerToMove: 0 | 1; // 0 = pretas (jogador1), 1 = brancas (jogador2)
  primeiraJogada: boolean;
}

export interface ProdutoPackedMove {
  posA: number; // 0..60
  colorA: 0 | 1; // 0 = preta, 1 = branca
  posB: number; // 0..60 or -1
  colorB: 0 | 1;
}

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

export interface DifficultyPreset {
  timeMs: number;
  candidateK: number;
  endgameEmptyN: number;
}

export const DIFFICULTY_PRESETS: Record<AIDifficulty, DifficultyPreset> = {
  easy: { timeMs: 3000, candidateK: 16, endgameEmptyN: 0 },
  medium: { timeMs: 6000, candidateK: 20, endgameEmptyN: 0 },
  hard: { timeMs: 9000, candidateK: 22, endgameEmptyN: 0 },
  'very-hard': { timeMs: 12000, candidateK: 24, endgameEmptyN: 6 },
  max: { timeMs: 15000, candidateK: 28, endgameEmptyN: 8 },
};

export type AIRequest =
  | {
    type: 'choose';
    id: number;
    state: ProdutoPackedState;
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
    move: ProdutoPackedMove | null;
    elapsedMs: number;
    usedWasm: boolean;
    explain?: string;
  }
  | { type: 'error'; id: number; message: string };

export interface IndexMaps {
  idxToPos: Posicao[];
  keyToIdx: Map<string, number>;
}

export function buildIndexMaps(gerarPosicoesValidas: () => Posicao[], posToKey: (p: Posicao) => string): IndexMaps {
  const idxToPos = gerarPosicoesValidas();
  const keyToIdx = new Map<string, number>();
  for (let i = 0; i < idxToPos.length; i++) {
    keyToIdx.set(posToKey(idxToPos[i]), i);
  }
  return { idxToPos, keyToIdx };
}

export function packState(
  state: ProdutoState,
  keyToIdx: Map<string, number>
): ProdutoPackedState {
  let blackLo = 0;
  let blackHi = 0;
  let whiteLo = 0;
  let whiteHi = 0;

  for (const [key, cell] of Object.entries(state.tabuleiro)) {
    if (cell === 'vazia') continue;
    const idx = keyToIdx.get(key);
    if (idx === undefined) continue;
    if (idx < 32) {
      const bit = (1 << idx) >>> 0;
      if (cell === 'preta') blackLo = (blackLo | bit) >>> 0;
      else whiteLo = (whiteLo | bit) >>> 0;
    } else {
      const s = idx - 32;
      const bit = (1 << s) >>> 0;
      if (cell === 'preta') blackHi = (blackHi | bit) >>> 0;
      else whiteHi = (whiteHi | bit) >>> 0;
    }
  }

  return {
    blackLo,
    blackHi,
    whiteLo,
    whiteHi,
    playerToMove: state.jogadorAtual === 'jogador1' ? 0 : 1,
    primeiraJogada: state.primeiraJogada,
  };
}
