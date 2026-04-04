/**
 * Gatos & Cães AI Engine
 *
 * Implements Negamax with Alpha-Beta pruning, iterative deepening,
 * transposition table, killer moves, and history heuristic.
 */

import { CompactBoard, Move, SearchStats, AIConfig, TTFlag, DIFFICULTY_CONFIGS } from './types';
import { TranspositionTable, computeHash } from './tt';
import { evaluate, generateMoves, countLegalMoves, INFINITY, WIN_SCORE, ADJACENT_MASKS, popcount, ctz64 } from './eval';
import type { GatosCaesState, Posicao, Celula } from '../types';
import type { Player } from '../../../types';

// Search state
let tt: TranspositionTable;
let killerMoves: number[][] = [];  // [depth][0..1]
let historyTable: number[][] = [];  // [from_color][to_square]
let nodes = 0;
let cutoffs = 0;
let startTime = 0;
let timeLimit = 0;
let aborted = false;

/**
 * Convert game state to compact board representation
 */
export function toCompactBoard(state: GatosCaesState): CompactBoard {
  let gatos = 0n;
  let caes = 0n;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = state.tabuleiro[row][col];
      const bit = 1n << BigInt(row * 8 + col);
      if (cell === 'gato') gatos |= bit;
      else if (cell === 'cao') caes |= bit;
    }
  }

  return {
    gatos,
    caes,
    sideToMove: state.jogadorAtual,
    primeiroGatoColocado: state.primeiroGatoColocado,
    primeiroCaoColocado: state.primeiroCaoColocado,
  };
}

/**
 * Make a move on the compact board (returns new board)
 */
function makeMove(board: CompactBoard, move: number): CompactBoard {
  const bit = 1n << BigInt(move);
  const isGatosMove = board.sideToMove === 'jogador1';

  return {
    gatos: isGatosMove ? board.gatos | bit : board.gatos,
    caes: isGatosMove ? board.caes : board.caes | bit,
    sideToMove: isGatosMove ? 'jogador2' : 'jogador1',
    primeiroGatoColocado: isGatosMove ? true : board.primeiroGatoColocado,
    primeiroCaoColocado: isGatosMove ? board.primeiroCaoColocado : true,
  };
}

/**
 * Get hash for a board position
 */
function getHash(board: CompactBoard): bigint {
  return computeHash(board.gatos, board.caes, board.sideToMove === 'jogador1');
}

/**
 * Score a move for ordering (higher = search first)
 */
function scoreMoveForOrdering(
  board: CompactBoard,
  move: number,
  depth: number,
  ttBestMove: number | null
): number {
  // TT best move gets highest priority
  if (move === ttBestMove) return 1000000;

  // Killer moves
  if (killerMoves[depth]) {
    if (killerMoves[depth][0] === move) return 900000;
    if (killerMoves[depth][1] === move) return 800000;
  }

  // History heuristic
  const colorIdx = board.sideToMove === 'jogador1' ? 0 : 1;
  const historyScore = historyTable[colorIdx]?.[move] ?? 0;

  // Center preference (squares closer to center)
  const row = Math.floor(move / 8);
  const col = move % 8;
  const centerDist = Math.abs(row - 3.5) + Math.abs(col - 3.5);
  const centerBonus = (7 - centerDist) * 10;

  return historyScore + centerBonus;
}

/**
 * Order moves for better pruning
 */
function orderMoves(
  board: CompactBoard,
  moves: number[],
  depth: number,
  ttBestMove: number | null
): number[] {
  return moves
    .map(move => ({ move, score: scoreMoveForOrdering(board, move, depth, ttBestMove) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.move);
}

/**
 * Update killer moves
 */
function updateKillerMove(move: number, depth: number): void {
  if (!killerMoves[depth]) killerMoves[depth] = [-1, -1];
  if (killerMoves[depth][0] !== move) {
    killerMoves[depth][1] = killerMoves[depth][0];
    killerMoves[depth][0] = move;
  }
}

/**
 * Update history heuristic
 */
function updateHistory(board: CompactBoard, move: number, depth: number): void {
  const colorIdx = board.sideToMove === 'jogador1' ? 0 : 1;
  if (!historyTable[colorIdx]) historyTable[colorIdx] = new Array(64).fill(0);
  historyTable[colorIdx][move] += depth * depth;
}

/**
 * Check if we should abort the search
 */
function shouldAbort(): boolean {
  if (aborted) return true;
  if (timeLimit > 0 && Date.now() - startTime > timeLimit) {
    aborted = true;
    return true;
  }
  return false;
}

/**
 * Negamax with alpha-beta pruning
 */
function negamax(
  board: CompactBoard,
  depth: number,
  alpha: number,
  beta: number,
  ply: number
): number {
  if (shouldAbort()) return 0;

  nodes++;

  // Check time periodically
  if ((nodes & 4095) === 0 && shouldAbort()) return 0;

  const hash = getHash(board);
  const isGatosMove = board.sideToMove === 'jogador1';

  // Transposition table lookup
  const ttEntry = tt.probe(hash);
  let ttBestMove: number | null = null;

  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === TTFlag.EXACT) {
      return ttEntry.score;
    }
    if (ttEntry.flag === TTFlag.LOWER_BOUND && ttEntry.score >= beta) {
      return ttEntry.score;
    }
    if (ttEntry.flag === TTFlag.UPPER_BOUND && ttEntry.score <= alpha) {
      return ttEntry.score;
    }
    ttBestMove = ttEntry.bestMove;
  } else if (ttEntry) {
    ttBestMove = ttEntry.bestMove;
  }

  // Generate moves
  const moves = generateMoves(
    board,
    isGatosMove,
    board.primeiroGatoColocado,
    board.primeiroCaoColocado
  );

  // Terminal node - no moves means we lose
  if (moves.length === 0) {
    return -WIN_SCORE + ply;  // Prefer losing later
  }

  // Leaf node - evaluate
  if (depth === 0) {
    return evaluate(board);
  }

  // Order moves for better pruning
  const orderedMoves = orderMoves(board, moves, ply, ttBestMove);

  let bestScore = -INFINITY;
  let bestMove: number | null = null;
  let flag = TTFlag.UPPER_BOUND;

  for (const move of orderedMoves) {
    const newBoard = makeMove(board, move);

    // Check if opponent has no moves after this (immediate win)
    const oppMoves = countLegalMoves(
      newBoard,
      newBoard.sideToMove === 'jogador1',
      newBoard.primeiroGatoColocado,
      newBoard.primeiroCaoColocado
    );

    let score: number;
    if (oppMoves === 0) {
      // Opponent can't move, we win!
      score = WIN_SCORE - ply - 1;
    } else {
      score = -negamax(newBoard, depth - 1, -beta, -alpha, ply + 1);
    }

    if (shouldAbort()) return bestScore !== -INFINITY ? bestScore : 0;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    if (score > alpha) {
      alpha = score;
      flag = TTFlag.EXACT;
    }

    if (alpha >= beta) {
      // Beta cutoff
      cutoffs++;
      updateKillerMove(move, ply);
      updateHistory(board, move, depth);
      flag = TTFlag.LOWER_BOUND;
      break;
    }
  }

  // Store in TT
  tt.store(hash, depth, bestScore, flag, bestMove);

  return bestScore;
}

/**
 * Iterative deepening search
 */
function iterativeDeepening(
  board: CompactBoard,
  config: AIConfig
): { bestMove: number | null; score: number; depth: number } {
  let bestMove: number | null = null;
  let bestScore = -INFINITY;
  let reachedDepth = 0;

  // Generate root moves
  const isGatosMove = board.sideToMove === 'jogador1';
  const rootMoves = generateMoves(
    board,
    isGatosMove,
    board.primeiroGatoColocado,
    board.primeiroCaoColocado
  );

  if (rootMoves.length === 0) {
    return { bestMove: null, score: -WIN_SCORE, depth: 0 };
  }

  if (rootMoves.length === 1) {
    // Only one move, return it immediately
    return { bestMove: rootMoves[0], score: 0, depth: 0 };
  }

  // Iterative deepening
  for (let depth = 1; depth <= config.maxDepth; depth++) {
    if (shouldAbort()) break;

    const hash = getHash(board);
    const ttBestMove = tt.getBestMove(hash);
    const orderedMoves = orderMoves(board, rootMoves, 0, ttBestMove);

    let alpha = -INFINITY;
    const beta = INFINITY;
    let depthBestMove: number | null = null;
    let depthBestScore = -INFINITY;

    for (const move of orderedMoves) {
      const newBoard = makeMove(board, move);

      // Check for immediate win
      const oppMoves = countLegalMoves(
        newBoard,
        newBoard.sideToMove === 'jogador1',
        newBoard.primeiroGatoColocado,
        newBoard.primeiroCaoColocado
      );

      let score: number;
      if (oppMoves === 0) {
        score = WIN_SCORE - 1;
      } else {
        score = -negamax(newBoard, depth - 1, -beta, -alpha, 1);
      }

      if (shouldAbort()) break;

      if (score > depthBestScore) {
        depthBestScore = score;
        depthBestMove = move;
      }

      if (score > alpha) {
        alpha = score;
      }

      // Found a win, no need to search more
      if (score >= WIN_SCORE - 100) {
        break;
      }
    }

    if (!shouldAbort() && depthBestMove !== null) {
      bestMove = depthBestMove;
      bestScore = depthBestScore;
      reachedDepth = depth;

      // Store root position in TT
      tt.store(hash, depth, bestScore, TTFlag.EXACT, bestMove);
    }

    // Early exit if we found a forced win
    if (bestScore >= WIN_SCORE - 100) {
      break;
    }
  }

  return { bestMove, score: bestScore, depth: reachedDepth };
}

/**
 * Convert packed move to Posicao
 */
function unpackMove(packed: number): Posicao {
  return {
    linha: Math.floor(packed / 8),
    coluna: packed % 8,
  };
}

/**
 * Main entry point: compute best move for a game state
 */
export function computeBestMove(
  state: GatosCaesState,
  difficulty: number,
  overrides: Partial<AIConfig> = {}
): { move: Posicao | null; stats: SearchStats } {
  const config = {
    ...(DIFFICULTY_CONFIGS[difficulty] ?? DIFFICULTY_CONFIGS[3]),
    ...overrides,
  };

  // Initialize search state
  tt = new TranspositionTable(config.ttSize);
  killerMoves = [];
  historyTable = [];
  nodes = 0;
  cutoffs = 0;
  startTime = Date.now();
  timeLimit = config.timeLimit;
  aborted = false;

  // Convert to compact representation
  const board = toCompactBoard(state);

  // Run search
  const { bestMove, score, depth } = iterativeDeepening(board, config);

  const endTime = Date.now();
  const elapsed = endTime - startTime;
  const ttStats = tt.getStats();

  // Handle difficulty randomization for easy levels
  let finalMove = bestMove;

  if (config.topN > 1 && config.randomFactor > 0 && bestMove !== null) {
    // Get top N moves for easier difficulty
    const isGatosMove = board.sideToMove === 'jogador1';
    const allMoves = generateMoves(
      board,
      isGatosMove,
      board.primeiroGatoColocado,
      board.primeiroCaoColocado
    );

    if (allMoves.length > 1 && Math.random() < config.randomFactor) {
      // Sometimes pick a random move from top N
      const shuffled = allMoves.sort(() => Math.random() - 0.5);
      finalMove = shuffled[Math.floor(Math.random() * Math.min(config.topN, shuffled.length))];
    }
  }

  const stats: SearchStats = {
    nodes,
    ttHits: ttStats.hits,
    ttProbes: ttStats.probes,
    cutoffs,
    depth,
    score,
    bestMove: finalMove !== null ? { pos: unpackMove(finalMove), packed: finalMove } : null,
    timeMs: elapsed,
    nodesPerSecond: elapsed > 0 ? Math.floor(nodes / (elapsed / 1000)) : 0,
  };

  return {
    move: finalMove !== null ? unpackMove(finalMove) : null,
    stats,
  };
}

/**
 * Cancel ongoing search
 */
export function cancelSearch(): void {
  aborted = true;
}
