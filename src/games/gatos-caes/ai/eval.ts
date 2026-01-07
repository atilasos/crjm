/**
 * Evaluation function for Gatos & Cães
 *
 * The game is "Normal Play" - last player to move WINS.
 * Key factors:
 * - Mobility (number of legal moves)
 * - Territory control (exclusive regions)
 * - Center control (early game)
 * - Safe moves (guaranteed future moves)
 */

import { CompactBoard } from './types';
import { CASAS_CENTRAIS } from '../types';

// Constants for evaluation
const INFINITY = 100000;
const WIN_SCORE = 50000;

// Adjacency masks for each square (precomputed)
const ADJACENT_MASKS: bigint[] = [];

// Initialize adjacency masks
function initAdjacentMasks(): void {
  for (let sq = 0; sq < 64; sq++) {
    const row = Math.floor(sq / 8);
    const col = sq % 8;
    let mask = 0n;

    // Up
    if (row > 0) mask |= 1n << BigInt(sq - 8);
    // Down
    if (row < 7) mask |= 1n << BigInt(sq + 8);
    // Left
    if (col > 0) mask |= 1n << BigInt(sq - 1);
    // Right
    if (col < 7) mask |= 1n << BigInt(sq + 1);

    ADJACENT_MASKS.push(mask);
  }
}

initAdjacentMasks();

// Central squares mask
const CENTER_MASK = CASAS_CENTRAIS.reduce(
  (acc, pos) => acc | (1n << BigInt(pos.linha * 8 + pos.coluna)),
  0n
);

/**
 * Count legal moves for a player
 */
export function countLegalMoves(
  board: CompactBoard,
  forGatos: boolean,
  primeiroGato: boolean,
  primeiroCao: boolean
): number {
  const occupied = board.gatos | board.caes;

  if (forGatos) {
    // First gato: only central squares
    if (!primeiroGato) {
      const available = CENTER_MASK & ~occupied;
      return popcount(available);
    }

    // Normal gato moves: empty squares not adjacent to any cao
    let count = 0;
    let empty = ~occupied & 0xFFFFFFFFFFFFFFFFn;

    while (empty !== 0n) {
      const sq = ctz64(empty);
      const bit = 1n << BigInt(sq);

      // Check if adjacent to any cao
      const adjMask = ADJACENT_MASKS[sq];
      if ((adjMask & board.caes) === 0n) {
        count++;
      }

      empty &= empty - 1n;
    }
    return count;
  } else {
    // First cao: outside central, not adjacent to gatos
    if (!primeiroCao) {
      let count = 0;
      let empty = ~occupied & ~CENTER_MASK & 0xFFFFFFFFFFFFFFFFn;

      while (empty !== 0n) {
        const sq = ctz64(empty);
        const adjMask = ADJACENT_MASKS[sq];
        if ((adjMask & board.gatos) === 0n) {
          count++;
        }
        empty &= empty - 1n;
      }
      return count;
    }

    // Normal cao moves: empty squares not adjacent to any gato
    let count = 0;
    let empty = ~occupied & 0xFFFFFFFFFFFFFFFFn;

    while (empty !== 0n) {
      const sq = ctz64(empty);
      const adjMask = ADJACENT_MASKS[sq];
      if ((adjMask & board.gatos) === 0n) {
        count++;
      }
      empty &= empty - 1n;
    }
    return count;
  }
}

/**
 * Generate all legal moves as packed integers
 */
export function generateMoves(
  board: CompactBoard,
  forGatos: boolean,
  primeiroGato: boolean,
  primeiroCao: boolean
): number[] {
  const occupied = board.gatos | board.caes;
  const moves: number[] = [];

  if (forGatos) {
    if (!primeiroGato) {
      // First gato: only central squares
      let available = CENTER_MASK & ~occupied;
      while (available !== 0n) {
        const sq = ctz64(available);
        moves.push(sq);
        available &= available - 1n;
      }
      return moves;
    }

    // Normal gato moves
    let empty = ~occupied & 0xFFFFFFFFFFFFFFFFn;
    while (empty !== 0n) {
      const sq = ctz64(empty);
      const adjMask = ADJACENT_MASKS[sq];
      if ((adjMask & board.caes) === 0n) {
        moves.push(sq);
      }
      empty &= empty - 1n;
    }
  } else {
    if (!primeiroCao) {
      // First cao: outside central, not adjacent to gatos
      let empty = ~occupied & ~CENTER_MASK & 0xFFFFFFFFFFFFFFFFn;
      while (empty !== 0n) {
        const sq = ctz64(empty);
        const adjMask = ADJACENT_MASKS[sq];
        if ((adjMask & board.gatos) === 0n) {
          moves.push(sq);
        }
        empty &= empty - 1n;
      }
      return moves;
    }

    // Normal cao moves
    let empty = ~occupied & 0xFFFFFFFFFFFFFFFFn;
    while (empty !== 0n) {
      const sq = ctz64(empty);
      const adjMask = ADJACENT_MASKS[sq];
      if ((adjMask & board.gatos) === 0n) {
        moves.push(sq);
      }
      empty &= empty - 1n;
    }
  }

  return moves;
}

/**
 * Evaluate a position from the perspective of the side to move
 *
 * Positive = good for side to move
 * Negative = bad for side to move
 */
export function evaluate(board: CompactBoard): number {
  const isGatosMove = board.sideToMove === 'jogador1';

  // Count moves for both sides
  const myMoves = countLegalMoves(
    board,
    isGatosMove,
    board.primeiroGatoColocado,
    board.primeiroCaoColocado
  );
  const oppMoves = countLegalMoves(
    board,
    !isGatosMove,
    board.primeiroGatoColocado,
    board.primeiroCaoColocado
  );

  // Terminal detection
  if (myMoves === 0) {
    // I have no moves, I lose
    return -WIN_SCORE;
  }
  if (oppMoves === 0) {
    // After my move, if opponent has no moves, I might win
    // But this is checked after the move, so here opponent still has moves
  }

  let score = 0;

  // Phase detection (0 = opening, 1 = endgame)
  const totalPieces = popcount(board.gatos) + popcount(board.caes);
  const phase = Math.min(totalPieces / 30, 1);

  // --- Mobility ---
  // More moves = more options = generally better
  // Weight increases in endgame
  const mobilityWeight = 100 + Math.floor(phase * 150);
  score += (myMoves - oppMoves) * mobilityWeight;

  // --- Territory Control ---
  // Count squares that only I can reach (not blocked by opponent's pieces)
  const myExclusive = countExclusiveTerritory(board, isGatosMove);
  const oppExclusive = countExclusiveTerritory(board, !isGatosMove);
  score += (myExclusive - oppExclusive) * 50;

  // --- Center Control (early game) ---
  if (phase < 0.3) {
    const myCenterControl = popcount(
      (isGatosMove ? board.gatos : board.caes) & CENTER_MASK
    );
    const oppCenterControl = popcount(
      (isGatosMove ? board.caes : board.gatos) & CENTER_MASK
    );
    score += (myCenterControl - oppCenterControl) * 30;
  }

  // --- Parity consideration for endgame ---
  // In endgame, having the right parity (even/odd moves remaining) matters
  if (phase > 0.7) {
    // If total remaining moves is odd, and it's my turn, I might get last move
    const totalMoves = myMoves + oppMoves;
    const parityBonus = totalMoves % 2 === 1 ? 20 : -20;
    score += parityBonus;
  }

  // --- Safe moves (squares with 2+ escape routes) ---
  const mySafeMoves = countSafeMoves(board, isGatosMove);
  const oppSafeMoves = countSafeMoves(board, !isGatosMove);
  score += (mySafeMoves - oppSafeMoves) * 40;

  return score;
}

/**
 * Count squares that only the specified player can reach
 */
function countExclusiveTerritory(board: CompactBoard, forGatos: boolean): number {
  const occupied = board.gatos | board.caes;
  const blockedByOpp = forGatos ? board.caes : board.gatos;
  let count = 0;

  let empty = ~occupied & 0xFFFFFFFFFFFFFFFFn;
  while (empty !== 0n) {
    const sq = ctz64(empty);
    const adjMask = ADJACENT_MASKS[sq];

    // Check if blocked for opponent but not for us
    const blockedForOpp = (adjMask & (forGatos ? board.gatos : board.caes)) !== 0n;
    const blockedForUs = (adjMask & blockedByOpp) !== 0n;

    if (blockedForOpp && !blockedForUs) {
      count++;
    }

    empty &= empty - 1n;
  }

  return count;
}

/**
 * Count "safe" moves - squares where we can play and still have options
 */
function countSafeMoves(board: CompactBoard, forGatos: boolean): number {
  const occupied = board.gatos | board.caes;
  const blockedBy = forGatos ? board.caes : board.gatos;
  let count = 0;

  let empty = ~occupied & 0xFFFFFFFFFFFFFFFFn;
  while (empty !== 0n) {
    const sq = ctz64(empty);
    const adjMask = ADJACENT_MASKS[sq];

    // Is this square legal for us?
    if ((adjMask & blockedBy) === 0n) {
      // Count how many adjacent empty squares we could still reach after
      let neighbors = adjMask & ~occupied & ~(1n << BigInt(sq));
      let safeNeighbors = 0;

      while (neighbors !== 0n) {
        const nsq = ctz64(neighbors);
        const nAdjMask = ADJACENT_MASKS[nsq];
        // After placing our piece at sq, is nsq still legal?
        // For gatos: nsq can't be adj to caes (unchanged) or our new piece (doesn't matter)
        // The key is whether it's adj to opponent
        if ((nAdjMask & blockedBy) === 0n) {
          safeNeighbors++;
        }
        neighbors &= neighbors - 1n;
      }

      if (safeNeighbors >= 2) {
        count++;
      }
    }

    empty &= empty - 1n;
  }

  return count;
}

/**
 * Count trailing zeros (position of lowest set bit)
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
 * Population count (number of set bits)
 */
function popcount(n: bigint): number {
  let count = 0;
  while (n !== 0n) {
    count++;
    n &= n - 1n;
  }
  return count;
}

export { INFINITY, WIN_SCORE, ADJACENT_MASKS, popcount, ctz64 };
