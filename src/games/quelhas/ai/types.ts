import type { Celula, Orientacao, Segmento } from '../types';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyParams {
  timeBudgetMs: number;
  maxDepth: number;
  topN: number;
  scoreDelta: number;
}

export const DIFFICULTY_PRESETS: Record<AIDifficulty, DifficultyParams> = {
  easy: { timeBudgetMs: 250, maxDepth: 5, topN: 6, scoreDelta: 120 },
  medium: { timeBudgetMs: 900, maxDepth: 9, topN: 3, scoreDelta: 60 },
  hard: { timeBudgetMs: 2500, maxDepth: 18, topN: 0, scoreDelta: 0 },
};

export interface AIMetrics {
  isThinking: boolean;
  lastDepth: number;
  lastNodes: number;
  lastTimeMs: number;
  lastTTHitRate: number;
  lastScore: number;
  fromBook: boolean;
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
    }
  | {
      type: 'error';
      id?: number;
      message: string;
    };
