/**
 * Dominório Bitboard Implementation (TypeScript reference)
 * 
 * This serves as:
 * 1. Reference implementation for the Rust WASM version
 * 2. Fallback if WASM is not available
 * 3. Test oracle for validating WASM implementation
 * 
 * Board representation: 64-bit bitboard as two 32-bit integers [low, high]
 * - Bit 0-31 in low, bit 32-63 in high
 * - bitIndex = row * 8 + col (row 0 = top)
 */

import type { Side } from './types';
import { squareIndex, indexToSquare, setBit, getBit, popCount } from './types';

// ============================================================================
// Constants
// ============================================================================

const NOT_FILE_H_LOW = 0x7F7F7F7F;
const NOT_FILE_H_HIGH = 0x7F7F7F7F;

// ============================================================================
// Move Generation
// ============================================================================

/**
 * Generate all valid moves for a side.
 * Returns array of anchor square indices.
 * 
 * @param occupiedLow - Low 32 bits of occupied squares
 * @param occupiedHigh - High 32 bits of occupied squares
 * @param side - 0 = Vertical, 1 = Horizontal
 */
export function generateMoves(
  occupiedLow: number,
  occupiedHigh: number,
  side: Side
): number[] {
  const moves: number[] = [];
  
  // empty = ~occupied
  const emptyLow = (~occupiedLow) >>> 0;
  const emptyHigh = (~occupiedHigh) >>> 0;
  
  if (side === 0) {
    // Vertical moves: anchor at row r, second cell at row r+1
    // valid anchor = empty[r][c] && empty[r+1][c]
    // In bitboard: anchor bits where both anchor and (anchor >> 8) are empty
    // But we must not check anchors in row 7 (would go off board)
    
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 8; col++) {
        const anchor = squareIndex(row, col);
        const below = squareIndex(row + 1, col);
        
        if (getBit(emptyLow, emptyHigh, anchor) && 
            getBit(emptyLow, emptyHigh, below)) {
          moves.push(anchor);
        }
      }
    }
  } else {
    // Horizontal moves: anchor at col c, second cell at col c+1
    // valid anchor = empty[r][c] && empty[r][c+1]
    // Anchors must not be in column 7
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 7; col++) {
        const anchor = squareIndex(row, col);
        const right = squareIndex(row, col + 1);
        
        if (getBit(emptyLow, emptyHigh, anchor) && 
            getBit(emptyLow, emptyHigh, right)) {
          moves.push(anchor);
        }
      }
    }
  }
  
  return moves;
}

/**
 * Count moves without generating the list (faster for evaluation)
 */
export function countMoves(
  occupiedLow: number,
  occupiedHigh: number,
  side: Side
): number {
  const emptyLow = (~occupiedLow) >>> 0;
  const emptyHigh = (~occupiedHigh) >>> 0;
  
  let count = 0;
  
  if (side === 0) {
    // Vertical: check pairs in each column
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 8; col++) {
        const anchor = squareIndex(row, col);
        const below = squareIndex(row + 1, col);
        if (getBit(emptyLow, emptyHigh, anchor) && 
            getBit(emptyLow, emptyHigh, below)) {
          count++;
        }
      }
    }
  } else {
    // Horizontal: check pairs in each row
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 7; col++) {
        const anchor = squareIndex(row, col);
        const right = squareIndex(row, col + 1);
        if (getBit(emptyLow, emptyHigh, anchor) && 
            getBit(emptyLow, emptyHigh, right)) {
          count++;
        }
      }
    }
  }
  
  return count;
}

/**
 * Apply a move to the board
 * 
 * @param occupiedLow - Low 32 bits of occupied squares
 * @param occupiedHigh - High 32 bits of occupied squares
 * @param anchor - Anchor square index
 * @param side - 0 = Vertical, 1 = Horizontal
 * @returns New occupied bitboard as [low, high]
 */
export function applyMove(
  occupiedLow: number,
  occupiedHigh: number,
  anchor: number,
  side: Side
): [number, number] {
  const { row, col } = indexToSquare(anchor);
  
  let second: number;
  if (side === 0) {
    // Vertical: second cell is below
    second = squareIndex(row + 1, col);
  } else {
    // Horizontal: second cell is to the right
    second = squareIndex(row, col + 1);
  }
  
  let [newLow, newHigh] = setBit(occupiedLow, occupiedHigh, anchor);
  [newLow, newHigh] = setBit(newLow, newHigh, second);
  
  return [newLow, newHigh];
}

/**
 * Check if game is over (current side has no moves = loses)
 */
export function isGameOver(
  occupiedLow: number,
  occupiedHigh: number,
  side: Side
): boolean {
  return countMoves(occupiedLow, occupiedHigh, side) === 0;
}

// ============================================================================
// Evaluation Heuristics
// ============================================================================

/**
 * Simple mobility-based evaluation
 * Positive = good for side to move
 */
export function evaluate(
  occupiedLow: number,
  occupiedHigh: number,
  side: Side
): number {
  const myMoves = countMoves(occupiedLow, occupiedHigh, side);
  const oppMoves = countMoves(occupiedLow, occupiedHigh, (1 - side) as Side);
  
  // If we have no moves, we lose
  if (myMoves === 0) return -10000;
  // If opponent has no moves, we win
  if (oppMoves === 0) return 10000;
  
  // Basic mobility difference
  // Weight opponent moves more heavily (we want to restrict them)
  return myMoves * 10 - oppMoves * 15;
}

/**
 * Count "safe" moves - runs of 2+ empty squares in our orientation
 * This is a lower bound on guaranteed moves
 */
export function countSafeMoves(
  occupiedLow: number,
  occupiedHigh: number,
  side: Side
): number {
  let safe = 0;
  
  if (side === 0) {
    // Vertical: count pairs in isolated column segments
    for (let col = 0; col < 8; col++) {
      let runLength = 0;
      for (let row = 0; row < 8; row++) {
        if (!getBit(occupiedLow, occupiedHigh, squareIndex(row, col))) {
          runLength++;
        } else {
          safe += Math.floor(runLength / 2);
          runLength = 0;
        }
      }
      safe += Math.floor(runLength / 2);
    }
  } else {
    // Horizontal: count pairs in isolated row segments
    for (let row = 0; row < 8; row++) {
      let runLength = 0;
      for (let col = 0; col < 8; col++) {
        if (!getBit(occupiedLow, occupiedHigh, squareIndex(row, col))) {
          runLength++;
        } else {
          safe += Math.floor(runLength / 2);
          runLength = 0;
        }
      }
      safe += Math.floor(runLength / 2);
    }
  }
  
  return safe;
}

/**
 * Advanced evaluation combining multiple heuristics
 */
export function evaluateAdvanced(
  occupiedLow: number,
  occupiedHigh: number,
  side: Side
): number {
  const myMoves = countMoves(occupiedLow, occupiedHigh, side);
  const oppMoves = countMoves(occupiedLow, occupiedHigh, (1 - side) as Side);
  
  // Terminal states
  if (myMoves === 0) return -10000;
  if (oppMoves === 0) return 10000;
  
  const mySafe = countSafeMoves(occupiedLow, occupiedHigh, side);
  const oppSafe = countSafeMoves(occupiedLow, occupiedHigh, (1 - side) as Side);
  
  // Combine mobility and safe moves
  // Safe moves are more valuable as they're guaranteed
  return (myMoves * 10 - oppMoves * 15) + (mySafe * 20 - oppSafe * 25);
}

// ============================================================================
// Move Ordering Heuristics
// ============================================================================

/**
 * Score a move for ordering (higher = search first)
 */
export function scoreMoveForOrdering(
  occupiedLow: number,
  occupiedHigh: number,
  anchor: number,
  side: Side
): number {
  // Apply move
  const [newLow, newHigh] = applyMove(occupiedLow, occupiedHigh, anchor, side);
  const oppSide = (1 - side) as Side;
  
  // Count opponent moves after this move
  const oppMovesAfter = countMoves(newLow, newHigh, oppSide);
  
  // If this move wins, highest priority
  if (oppMovesAfter === 0) return 100000;
  
  // Count our moves after opponent's response (approximate)
  const myMovesAfter = countMoves(newLow, newHigh, side);
  
  // Prefer moves that minimize opponent mobility
  // and maximize our own mobility
  let score = -oppMovesAfter * 100 + myMovesAfter * 50;
  
  // Centrality bonus (prefer central squares early)
  const { row, col } = indexToSquare(anchor);
  const centerDist = Math.abs(row - 3.5) + Math.abs(col - 3.5);
  score -= centerDist * 5;
  
  return score;
}

/**
 * Order moves by heuristic score (descending)
 */
export function orderMoves(
  occupiedLow: number,
  occupiedHigh: number,
  moves: number[],
  side: Side
): number[] {
  const scored = moves.map(m => ({
    move: m,
    score: scoreMoveForOrdering(occupiedLow, occupiedHigh, m, side),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map(s => s.move);
}

// ============================================================================
// Board Symmetry (for opening book)
// ============================================================================

/**
 * Get the 8 symmetry transformations of a board (D4 group)
 * Returns the lexicographically smallest as canonical form
 */
export function canonicalize(low: number, high: number): [number, number] {
  // For simplicity, just return as-is for now
  // Full implementation would compute all 8 rotations/reflections
  // and return the minimum
  return [low, high];
}

// ============================================================================
// Conversion from game state
// ============================================================================

import type { Celula } from '../types';

/**
 * Convert Celula[][] board to bitboard
 */
export function boardToBitboard(tabuleiro: Celula[][]): [number, number] {
  let low = 0;
  let high = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (tabuleiro[row][col] !== 'vazia') {
        const index = squareIndex(row, col);
        if (index < 32) {
          low |= (1 << index);
        } else {
          high |= (1 << (index - 32));
        }
      }
    }
  }
  
  return [low >>> 0, high >>> 0];
}

/**
 * Convert anchor move to Domino format
 */
export function anchorToDomino(anchor: number, side: Side): { 
  pos1: { linha: number; coluna: number }; 
  pos2: { linha: number; coluna: number };
  orientacao: 'vertical' | 'horizontal';
} {
  const { row, col } = indexToSquare(anchor);
  
  if (side === 0) {
    return {
      pos1: { linha: row, coluna: col },
      pos2: { linha: row + 1, coluna: col },
      orientacao: 'vertical',
    };
  } else {
    return {
      pos1: { linha: row, coluna: col },
      pos2: { linha: row, coluna: col + 1 },
      orientacao: 'horizontal',
    };
  }
}

/**
 * Convert player to side
 */
export function playerToSide(jogador: 'jogador1' | 'jogador2'): Side {
  return jogador === 'jogador1' ? 0 : 1;
}


