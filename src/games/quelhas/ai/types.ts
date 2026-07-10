import type { Celula, Orientacao, Segmento } from '../types';

export type AIDifficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'master';

export interface DifficultyParams {
  timeBudgetMs: number;
  maxDepth: number;
  topN: number;
  scoreDelta: number;
  /** 0 mantém a melhor pesquisa; 1 escolhe a cauda da avaliação imediata. */
  selectionQuantile: number;
}

export const DIFFICULTY_PRESETS: Record<AIDifficulty, DifficultyParams> = {
  beginner: { timeBudgetMs: 100, maxDepth: 2, topN: 0, scoreDelta: 0, selectionQuantile: 0.99 },
  easy: { timeBudgetMs: 250, maxDepth: 4, topN: 0, scoreDelta: 0, selectionQuantile: 0.8 },
  medium: { timeBudgetMs: 500, maxDepth: 8, topN: 0, scoreDelta: 0, selectionQuantile: 0.3 },
  hard: { timeBudgetMs: 1000, maxDepth: 13, topN: 0, scoreDelta: 0, selectionQuantile: 0.08 },
  master: { timeBudgetMs: 2000, maxDepth: 18, topN: 0, scoreDelta: 0, selectionQuantile: 0 },
};

export interface AIMetrics {
  isThinking: boolean;
  lastDepth: number;
  lastNodes: number;
  lastTimeMs: number;
  lastTTHitRate: number;
  lastScore: number;
  fromBook: boolean;
  lastEngine?: 'rust-wasm' | 'ts-fallback';
  lastUsedWasm?: boolean;
}

export const INITIAL_METRICS: AIMetrics = {
  isThinking: false,
  lastDepth: 0,
  lastNodes: 0,
  lastTimeMs: 0,
  lastTTHitRate: 0,
  lastScore: 0,
  fromBook: false,
};

export type AIRequest = {
  type: 'search';
  id: number;
  tabuleiro: Celula[][];
  orientacaoIA: Orientacao;
  orientacaoAdv: Orientacao;
  timeBudgetMs?: number;
  difficulty: AIDifficulty;
};

export type AIResponse =
  | { type: 'ready' }
  | {
      type: 'result';
      id: number;
      bestMove: Segmento | null;
      depthReached: number;
      nodesSearched: number;
      elapsedMs: number;
      ttHitRate: number;
      score: number;
      fromBook: boolean;
      engine: 'rust-wasm' | 'ts-fallback';
      usedWasm: boolean;
    }
  | {
      type: 'error';
      id?: number;
      message: string;
    };
