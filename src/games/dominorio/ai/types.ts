/**
 * Dominório AI Types
 * 
 * Bitboard Mapping (8×8 = 64 bits):
 * - bitIndex = row * 8 + col
 * - row 0 = top, row 7 = bottom
 * - col 0 = left, col 7 = right
 * 
 * Move Encoding:
 * - A move is encoded as an "anchor" square (top-left cell of the domino)
 * - Vertical: anchor at (r,c), second cell at (r+1,c)
 * - Horizontal: anchor at (r,c), second cell at (r,c+1)
 */

// ============================================================================
// Difficulty Settings
// ============================================================================

export type AIDifficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'hardPlus';

export interface DifficultyParams {
  timeBudgetMs: number;
  maxDepth: number;
  /** Number of top moves to consider for random selection (0 = always pick best) */
  topN: number;
  /** Score delta within which moves are considered equivalent */
  scoreDelta: number;
}

export const DIFFICULTY_PRESETS: Record<AIDifficulty, DifficultyParams> = {
  beginner: {
    timeBudgetMs: 2600,
    maxDepth: 3,
    topN: 8,
    scoreDelta: 100,
  },
  easy: {
    timeBudgetMs: 2600,
    maxDepth: 4,
    topN: 6,
    scoreDelta: 70,
  },
  medium: {
    timeBudgetMs: 7800,
    maxDepth: 7,
    topN: 2,
    scoreDelta: 10,
  },
  hard: {
    timeBudgetMs: 15000,
    maxDepth: 13,
    topN: 2,
    scoreDelta: 10,
  },
  hardPlus: {
    timeBudgetMs: 15000,
    maxDepth: 17,
    topN: 0,
    scoreDelta: 0,
  },
};

// ============================================================================
// Worker Communication Protocol
// ============================================================================

/** Side to move: 0 = Vertical (J1), 1 = Horizontal (J2) */
export type Side = 0 | 1;

/** Request sent from UI to Worker */
export interface AIRequest {
  type: 'search';
  /** Request id for worker correlation */
  id: number;
  /** 64-bit occupied mask as two 32-bit numbers [low, high] */
  occupiedLow: number;
  occupiedHigh: number;
  /** 0 = Vertical, 1 = Horizontal */
  sideToMove: Side;
  /** Time budget in milliseconds */
  timeBudgetMs: number;
  /** Difficulty level */
  difficulty: AIDifficulty;
  /** Number of half-moves played (for opening book) */
  plyCount: number;
  /** Optional deterministic seed for book / fallback tie-breaks */
  seed?: number;
}

/** Response sent from Worker to UI */
export interface AIResponse {
  type: 'result';
  /** Request id for worker correlation */
  id: number;
  /** Anchor square of best move (0-63), or -1 if no move */
  bestMove: number;
  /** Search depth reached */
  depthReached: number;
  /** Total nodes searched */
  nodesSearched: number;
  /** Principal variation as array of anchor squares */
  principalVariation: number[];
  /** Time elapsed in milliseconds */
  elapsedMs: number;
  /** Transposition table hit rate (0-1) */
  ttHitRate: number;
  /** Best score found */
  score: number;
  /** Whether move came from opening book */
  fromBook: boolean;
  /** Whether the WASM engine was used */
  usedWasm: boolean;
}

/** Error response from Worker */
export interface AIError {
  type: 'error';
  id?: number;
  message: string;
}

/** Ready notification from Worker */
export interface AIReady {
  type: 'ready';
  usedWasm: boolean;
}

export type WorkerMessage = AIResponse | AIError | AIReady;

// ============================================================================
// Bitboard Constants
// ============================================================================

/** Full 64-bit mask (all squares) */
export const FULL_MASK_LOW = 0xFFFFFFFF;
export const FULL_MASK_HIGH = 0xFFFFFFFF;

/** Mask excluding file H (rightmost column) for horizontal move generation */
export const NOT_FILE_H_LOW = 0x7F7F7F7F;
export const NOT_FILE_H_HIGH = 0x7F7F7F7F;

/** Mask excluding rank 8 (bottom row) for vertical move generation */
export const NOT_RANK_8_LOW = 0xFFFFFFFF;
export const NOT_RANK_8_HIGH = 0x00FFFFFF;

// ============================================================================
// Conversion Utilities (for TypeScript reference implementation)
// ============================================================================

/**
 * Convert row/col to bit index
 */
export function squareIndex(row: number, col: number): number {
  return row * 8 + col;
}

/**
 * Convert bit index to row/col
 */
export function indexToSquare(index: number): { row: number; col: number } {
  return {
    row: Math.floor(index / 8),
    col: index % 8,
  };
}

/**
 * Set a bit in a 64-bit number represented as [low, high]
 */
export function setBit(low: number, high: number, index: number): [number, number] {
  if (index < 32) {
    return [(low | (1 << index)) >>> 0, high];
  } else {
    return [low, (high | (1 << (index - 32))) >>> 0];
  }
}

/**
 * Get a bit from a 64-bit number represented as [low, high]
 */
export function getBit(low: number, high: number, index: number): boolean {
  if (index < 32) {
    return (low & (1 << index)) !== 0;
  } else {
    return (high & (1 << (index - 32))) !== 0;
  }
}

/**
 * Count set bits (population count)
 */
export function popCount(low: number, high: number): number {
  let count = 0;
  let n = low >>> 0;
  while (n) {
    count++;
    n &= n - 1;
  }
  n = high >>> 0;
  while (n) {
    count++;
    n &= n - 1;
  }
  return count;
}

// ============================================================================
// AI Metrics (for UI display)
// ============================================================================

export interface AIMetrics {
  isThinking: boolean;
  lastDepth: number;
  lastNodes: number;
  lastTimeMs: number;
  lastTTHitRate: number;
  lastScore: number;
  fromBook: boolean;
  usedWasm: boolean;
}

export const INITIAL_METRICS: AIMetrics = {
  isThinking: false,
  lastDepth: 0,
  lastNodes: 0,
  lastTimeMs: 0,
  lastTTHitRate: 0,
  lastScore: 0,
  fromBook: false,
  usedWasm: false,
};
