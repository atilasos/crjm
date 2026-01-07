/**
 * Transposition Table for Gatos & Cães
 *
 * Uses Zobrist hashing for position identification.
 * Stores search results to avoid re-computing the same positions.
 */

import { TTEntry, TTFlag } from './types';

// Zobrist hash keys (pre-generated random 64-bit values)
// We need: 64 squares × 2 piece types + 1 for side to move
const ZOBRIST_GATO: bigint[] = [];
const ZOBRIST_CAO: bigint[] = [];
let ZOBRIST_SIDE: bigint;

// Initialize Zobrist keys with pseudo-random values
function initZobrist(): void {
  // Simple PRNG for reproducible keys
  let seed = 0x12345678n;
  const next = (): bigint => {
    seed = (seed * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
    return seed;
  };

  for (let i = 0; i < 64; i++) {
    ZOBRIST_GATO.push(next());
    ZOBRIST_CAO.push(next());
  }
  ZOBRIST_SIDE = next();
}

// Initialize on module load
initZobrist();

/**
 * Compute Zobrist hash for a board position
 */
export function computeHash(gatos: bigint, caes: bigint, isGatosMove: boolean): bigint {
  let hash = 0n;

  // Hash gato positions
  let bits = gatos;
  while (bits !== 0n) {
    const sq = ctz64(bits);
    hash ^= ZOBRIST_GATO[sq];
    bits &= bits - 1n;
  }

  // Hash cao positions
  bits = caes;
  while (bits !== 0n) {
    const sq = ctz64(bits);
    hash ^= ZOBRIST_CAO[sq];
    bits &= bits - 1n;
  }

  // Hash side to move
  if (isGatosMove) {
    hash ^= ZOBRIST_SIDE;
  }

  return hash;
}

/**
 * Count trailing zeros in 64-bit integer
 */
function ctz64(n: bigint): number {
  if (n === 0n) return 64;
  let count = 0;
  while ((n & 1n) === 0n) {
    n >>= 1n;
    count++;
  }
  return count;
}

/**
 * Transposition Table implementation
 */
export class TranspositionTable {
  private entries: (TTEntry | null)[];
  private size: number;
  private mask: number;
  private hits: number = 0;
  private probes: number = 0;

  constructor(size: number) {
    // Round up to power of 2
    this.size = 1;
    while (this.size < size) this.size <<= 1;
    this.mask = this.size - 1;
    this.entries = new Array(this.size).fill(null);
  }

  /**
   * Get index for a hash
   */
  private index(hash: bigint): number {
    return Number(hash & BigInt(this.mask));
  }

  /**
   * Probe the table for an entry
   */
  probe(hash: bigint): TTEntry | null {
    this.probes++;
    const idx = this.index(hash);
    const entry = this.entries[idx];

    if (entry && entry.hash === hash) {
      this.hits++;
      return entry;
    }
    return null;
  }

  /**
   * Store an entry in the table
   * Uses "always replace" strategy (could be improved with depth-preferred)
   */
  store(
    hash: bigint,
    depth: number,
    score: number,
    flag: TTFlag,
    bestMove: number | null
  ): void {
    const idx = this.index(hash);
    const existing = this.entries[idx];

    // Replace if: empty, different position, or deeper/equal search
    if (!existing || existing.hash !== hash || existing.depth <= depth) {
      this.entries[idx] = { hash, depth, score, flag, bestMove };
    }
  }

  /**
   * Get the best move from TT for move ordering
   */
  getBestMove(hash: bigint): number | null {
    const entry = this.probe(hash);
    return entry?.bestMove ?? null;
  }

  /**
   * Clear the table
   */
  clear(): void {
    this.entries.fill(null);
    this.hits = 0;
    this.probes = 0;
  }

  /**
   * Get statistics
   */
  getStats(): { hits: number; probes: number; hitRate: number } {
    return {
      hits: this.hits,
      probes: this.probes,
      hitRate: this.probes > 0 ? this.hits / this.probes : 0,
    };
  }
}
