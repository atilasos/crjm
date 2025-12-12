/**
 * Dominório AI Web Worker
 * 
 * This worker runs the AI engine in a separate thread to avoid blocking the UI.
 * It attempts to use WASM for maximum performance, with a TypeScript fallback.
 */

import type { AIRequest, AIResponse, AIError, AIReady, Side, DifficultyParams } from './types';
import { DIFFICULTY_PRESETS } from './types';
import * as bitboard from './bitboard';
import openingBook from './book.json';

// WASM module type (will be dynamically imported if available)
interface WasmEngine {
  new(tt_size_bits: number): WasmEngine;
  search(
    occupied_low: number,
    occupied_high: number,
    side: number,
    time_budget_ms: number,
    max_depth: number,
    top_n: number,
    score_delta: number
  ): {
    best_move: number;
    depth_reached: number;
    nodes_searched: bigint;
    elapsed_ms: number;
    tt_hits: bigint;
    tt_probes: bigint;
    score: number;
  };
  clear_tt(): void;
}

// State
let wasmEngine: WasmEngine | null = null;
let useWasm = false;

// TypeScript fallback engine state
interface TSEngineState {
  nodes: number;
  deadline: number;
  aborted: boolean;
}

/**
 * Initialize the worker
 */
async function init(): Promise<void> {
  try {
    // Try to load WASM module
    const wasmModule = await import('./wasm/pkg/dominorio_ai.js');
    await wasmModule.default();
    wasmEngine = new wasmModule.DominorioEngine(18); // 256K entries TT
    useWasm = true;
    console.log('[DominorioAI] WASM engine initialized');
  } catch (e) {
    console.warn('[DominorioAI] WASM not available, using TypeScript fallback:', e);
    useWasm = false;
  }
  
  // Signal ready
  const ready: AIReady = { type: 'ready' };
  self.postMessage(ready);
}

/**
 * Check opening book for a move
 */
function checkOpeningBook(
  occupiedLow: number,
  occupiedHigh: number,
  sideToMove: Side,
  plyCount: number
): number | null {
  if (plyCount > (openingBook.maxPly || 6)) {
    return null;
  }
  
  const key = `${occupiedLow.toString(16)}:${occupiedHigh.toString(16)}:${sideToMove}`;
  const entries = (openingBook.entries as Record<string, number[]>)[key];
  
  if (entries && entries.length > 0) {
    // Pick randomly from book moves
    const idx = Math.floor(Math.random() * entries.length);
    return entries[idx];
  }
  
  return null;
}

/**
 * TypeScript fallback search implementation
 */
function searchTS(
  occupiedLow: number,
  occupiedHigh: number,
  side: Side,
  params: DifficultyParams
): AIResponse {
  const startTime = performance.now();
  const state: TSEngineState = {
    nodes: 0,
    deadline: startTime + params.timeBudgetMs,
    aborted: false,
  };
  
  const INF = 30000;
  const MATE = 29000;
  
  // Simple iterative deepening with alpha-beta
  let bestMove = -1;
  let bestScore = -INF;
  let depthReached = 0;
  
  const moves = bitboard.generateMoves(occupiedLow, occupiedHigh, side);
  
  if (moves.length === 0) {
    return {
      type: 'result',
      bestMove: -1,
      depthReached: 0,
      nodesSearched: 0,
      principalVariation: [],
      elapsedMs: performance.now() - startTime,
      ttHitRate: 0,
      score: -MATE,
      fromBook: false,
    };
  }
  
  // Order moves once at root
  const orderedMoves = bitboard.orderMoves(occupiedLow, occupiedHigh, moves, side);
  
  function negamax(
    occLow: number,
    occHigh: number,
    currentSide: Side,
    depth: number,
    alpha: number,
    beta: number,
    ply: number
  ): number {
    state.nodes++;
    
    // Time check every 1024 nodes
    if ((state.nodes & 1023) === 0 && performance.now() >= state.deadline) {
      state.aborted = true;
      return 0;
    }
    
    // Terminal check
    const myMoves = bitboard.countMoves(occLow, occHigh, currentSide);
    if (myMoves === 0) {
      return -MATE + ply;
    }
    
    // Leaf evaluation
    if (depth === 0) {
      return bitboard.evaluateAdvanced(occLow, occHigh, currentSide);
    }
    
    const childMoves = bitboard.generateMoves(occLow, occHigh, currentSide);
    const orderedChildMoves = bitboard.orderMoves(occLow, occHigh, childMoves, currentSide);
    
    let bestChildScore = -INF;
    
    for (const mv of orderedChildMoves) {
      const [newLow, newHigh] = bitboard.applyMove(occLow, occHigh, mv, currentSide);
      const oppSide = (1 - currentSide) as Side;
      
      const score = -negamax(newLow, newHigh, oppSide, depth - 1, -beta, -alpha, ply + 1);
      
      if (state.aborted) return 0;
      
      if (score > bestChildScore) {
        bestChildScore = score;
      }
      
      if (score > alpha) {
        alpha = score;
      }
      
      if (alpha >= beta) {
        break;
      }
    }
    
    return bestChildScore;
  }
  
  // Iterative deepening
  for (let depth = 1; depth <= params.maxDepth; depth++) {
    state.aborted = false;
    
    let alpha = -INF;
    const beta = INF;
    let currentBest = orderedMoves[0];
    
    for (const mv of orderedMoves) {
      const [newLow, newHigh] = bitboard.applyMove(occupiedLow, occupiedHigh, mv, side);
      const oppSide = (1 - side) as Side;
      
      const score = -negamax(newLow, newHigh, oppSide, depth - 1, -beta, -alpha, 1);
      
      if (state.aborted) break;
      
      if (score > alpha) {
        alpha = score;
        currentBest = mv;
      }
    }
    
    if (state.aborted) break;
    
    depthReached = depth;
    bestScore = alpha;
    bestMove = currentBest;
  }
  
  // Apply randomization for easier difficulties
  if (params.topN > 0 && moves.length > 1) {
    const scoredMoves: { move: number; score: number }[] = [];
    
    for (const mv of orderedMoves.slice(0, params.topN)) {
      const [newLow, newHigh] = bitboard.applyMove(occupiedLow, occupiedHigh, mv, side);
      const oppSide = (1 - side) as Side;
      const score = -bitboard.evaluateAdvanced(newLow, newHigh, oppSide);
      scoredMoves.push({ move: mv, score });
    }
    
    scoredMoves.sort((a, b) => b.score - a.score);
    
    const candidates = scoredMoves.filter(
      s => scoredMoves[0].score - s.score <= params.scoreDelta
    );
    
    if (candidates.length > 1) {
      const idx = Math.floor(Math.random() * candidates.length);
      bestMove = candidates[idx].move;
      bestScore = candidates[idx].score;
    }
  }
  
  return {
    type: 'result',
    bestMove,
    depthReached,
    nodesSearched: state.nodes,
    principalVariation: bestMove >= 0 ? [bestMove] : [],
    elapsedMs: performance.now() - startTime,
    ttHitRate: 0, // No TT in TS fallback
    score: bestScore,
    fromBook: false,
  };
}

/**
 * Search using WASM engine
 */
function searchWASM(
  occupiedLow: number,
  occupiedHigh: number,
  side: Side,
  params: DifficultyParams
): AIResponse {
  if (!wasmEngine) {
    throw new Error('WASM engine not initialized');
  }
  
  const startTime = performance.now();
  
  const result = wasmEngine.search(
    occupiedLow,
    occupiedHigh,
    side,
    params.timeBudgetMs,
    params.maxDepth,
    params.topN,
    params.scoreDelta
  );
  
  const ttProbes = Number(result.tt_probes);
  const ttHits = Number(result.tt_hits);
  
  return {
    type: 'result',
    bestMove: result.best_move,
    depthReached: result.depth_reached,
    nodesSearched: Number(result.nodes_searched),
    principalVariation: result.best_move >= 0 ? [result.best_move] : [],
    elapsedMs: performance.now() - startTime,
    ttHitRate: ttProbes > 0 ? ttHits / ttProbes : 0,
    score: result.score,
    fromBook: false,
  };
}

/**
 * Handle search request
 */
function handleSearch(request: AIRequest): AIResponse {
  const params = DIFFICULTY_PRESETS[request.difficulty];
  
  // Check opening book first
  const bookMove = checkOpeningBook(
    request.occupiedLow,
    request.occupiedHigh,
    request.sideToMove,
    request.plyCount
  );
  
  if (bookMove !== null) {
    return {
      type: 'result',
      bestMove: bookMove,
      depthReached: 0,
      nodesSearched: 0,
      principalVariation: [bookMove],
      elapsedMs: 0,
      ttHitRate: 0,
      score: 0,
      fromBook: true,
    };
  }
  
  // Override time budget if specified
  const effectiveParams: DifficultyParams = {
    ...params,
    timeBudgetMs: request.timeBudgetMs || params.timeBudgetMs,
  };
  
  // Use WASM if available, otherwise TypeScript fallback
  if (useWasm && wasmEngine) {
    return searchWASM(
      request.occupiedLow,
      request.occupiedHigh,
      request.sideToMove,
      effectiveParams
    );
  } else {
    return searchTS(
      request.occupiedLow,
      request.occupiedHigh,
      request.sideToMove,
      effectiveParams
    );
  }
}

/**
 * Message handler
 */
self.onmessage = (event: MessageEvent<AIRequest>) => {
  try {
    const request = event.data;
    
    if (request.type === 'search') {
      const response = handleSearch(request);
      self.postMessage(response);
    }
  } catch (e) {
    const error: AIError = {
      type: 'error',
      message: e instanceof Error ? e.message : String(e),
    };
    self.postMessage(error);
  }
};

// Initialize on load
init().catch(e => {
  console.error('[DominorioAI] Initialization failed:', e);
  // Still signal ready so fallback can work
  const ready: AIReady = { type: 'ready' };
  self.postMessage(ready);
});


