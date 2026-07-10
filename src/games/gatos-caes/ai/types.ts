/**
 * Types for Gatos & Cães AI Engine
 */

import type { Celula, Posicao, GatosCaesState } from '../types';
import type { Player } from '../../../types';

// Compact board representation for efficient hashing and manipulation
export interface CompactBoard {
  // Bitboards: 64 bits for 8x8 board
  gatos: bigint;  // 1 = gato present
  caes: bigint;   // 1 = cao present
  sideToMove: Player;
  primeiroGatoColocado: boolean;
  primeiroCaoColocado: boolean;
}

// Move representation
export interface Move {
  pos: Posicao;
  // Packed format: row * 8 + col (0-63)
  packed: number;
}

// Transposition table entry
export interface TTEntry {
  hash: bigint;
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove: number | null;  // packed move
}

export enum TTFlag {
  EXACT = 0,
  LOWER_BOUND = 1,  // Beta cutoff (fail-high)
  UPPER_BOUND = 2,  // Alpha cutoff (fail-low)
}

// Search statistics
export interface SearchStats {
  nodes: number;
  ttHits: number;
  ttProbes: number;
  cutoffs: number;
  depth: number;
  score: number;
  bestMove: Move | null;
  timeMs: number;
  nodesPerSecond: number;
  runtime?: 'worker' | 'inline';
}

// AI configuration per difficulty level
export interface AIConfig {
  maxDepth: number;
  timeLimit: number;
  ttSize: number;
  // For easier levels, pick from top N moves with some randomness
  topN: number;
  randomFactor: number;
}

// Difficulty presets
export const DIFFICULTY_CONFIGS: Record<number, AIConfig> = {
  1: { maxDepth: 2,  timeLimit: 500,   ttSize: 65536,   topN: 8, randomFactor: 0.85 },
  2: { maxDepth: 6,  timeLimit: 1500,  ttSize: 131072,  topN: 2, randomFactor: 0.15 },
  3: { maxDepth: 8,  timeLimit: 3000,  ttSize: 262144,  topN: 1, randomFactor: 0 },
  4: { maxDepth: 10, timeLimit: 6000,  ttSize: 524288,  topN: 1, randomFactor: 0 },
  5: { maxDepth: 14, timeLimit: 12000, ttSize: 1048576, topN: 1, randomFactor: 0 },
};

// Worker message types
export interface WorkerRequest {
  type: 'compute_move';
  state: GatosCaesState;
  difficulty: number;
  requestId: number;
  timeLimitMs: number;
}

export interface WorkerMoveResponse {
  type: 'move_result';
  move: Posicao | null;
  stats: SearchStats;
  requestId: number;
}

export interface WorkerReady {
  type: 'ready';
}

export type WorkerResponse = WorkerMoveResponse | WorkerReady;

export interface WorkerCancel {
  type: 'cancel';
}

export type WorkerMessage = WorkerRequest | WorkerCancel;
