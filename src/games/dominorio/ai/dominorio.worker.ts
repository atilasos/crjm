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

interface WasmSearchResult {
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
}

// WASM module type (will be dynamically imported if available)
interface WasmEngine {
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

interface WasmModule {
  default: (opts: { module_or_path: URL | string }) => Promise<unknown>;
  DominorioEngine: new(tt_size_bits: number) => WasmEngine;
}

// State
let wasmEngine: WasmEngine | null = null;
let useWasm = false;
let initDone = false;

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
    const wasmModule = (await import('./wasm/pkg/dominorio_ai.js')) as WasmModule;
    const wasmUrl = new URL('./wasm/pkg/dominorio_ai_bg.wasm', import.meta.url);
    await wasmModule.default({ module_or_path: wasmUrl });
    wasmEngine = new wasmModule.DominorioEngine(18); // 256K entries TT
    useWasm = true;
    console.log('[DominorioAI] WASM engine initialized');
  } catch (e) {
    console.warn('[DominorioAI] WASM not available, using TypeScript fallback:', e);
    useWasm = false;
  } finally {
    initDone = true;
  }
  
  // Signal ready
  const ready: AIReady = { type: 'ready', usedWasm: useWasm };
  self.postMessage(ready);
}

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRandom(
  seed: number | undefined,
  key: string,
): () => number {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    return Math.random;
  }
  const mixedSeed = ((Math.trunc(seed) >>> 0) ^ fnv1a32(key)) >>> 0;
  return mulberry32(mixedSeed);
}

/**
 * Check opening book for a move
 */
function checkOpeningBook(
  occupiedLow: number,
  occupiedHigh: number,
  sideToMove: Side,
  plyCount: number,
  random: () => number,
): number | null {
  if (plyCount > (openingBook.maxPly || 6)) {
    return null;
  }
  
  const key = `${occupiedLow.toString(16)}:${occupiedHigh.toString(16)}:${sideToMove}`;
  const entries = (openingBook.entries as Record<string, number[]>)[key];
  
  if (entries && entries.length > 0) {
    const idx = Math.floor(random() * entries.length);
    return entries[idx] ?? null;
  }
  
  return null;
}

/**
 * TypeScript fallback search implementation
 */
function searchTS(
  requestId: number,
  occupiedLow: number,
  occupiedHigh: number,
  side: Side,
  params: DifficultyParams,
  random: () => number,
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
      id: requestId,
      bestMove: -1,
      depthReached: 0,
      nodesSearched: 0,
      principalVariation: [],
      elapsedMs: performance.now() - startTime,
      ttHitRate: 0,
      score: -MATE,
      fromBook: false,
      usedWasm: false,
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
      let currentBest = orderedMoves[0] ?? -1;
    
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
    
    const topScore = scoredMoves[0]?.score;
    const candidates = topScore === undefined
      ? []
      : scoredMoves.filter(
        s => topScore - s.score <= params.scoreDelta
      );
    
    if (candidates.length > 1) {
      const idx = Math.floor(random() * candidates.length);
      const selected = candidates[idx];
      if (selected) {
        bestMove = selected.move;
        bestScore = selected.score;
      }
    }
  }
  
  return {
    type: 'result',
    id: requestId,
    bestMove,
    depthReached,
    nodesSearched: state.nodes,
    principalVariation: bestMove >= 0 ? [bestMove] : [],
    elapsedMs: performance.now() - startTime,
    ttHitRate: 0, // No TT in TS fallback
    score: bestScore,
    fromBook: false,
    usedWasm: false,
  };
}

/**
 * Search using WASM engine
 */
function searchWASM(
  requestId: number,
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
    id: requestId,
    bestMove: result.best_move,
    depthReached: result.depth_reached,
    nodesSearched: Number(result.nodes_searched),
    principalVariation: result.best_move >= 0 ? [result.best_move] : [],
    elapsedMs: performance.now() - startTime,
    ttHitRate: ttProbes > 0 ? ttHits / ttProbes : 0,
    score: result.score,
    fromBook: false,
    usedWasm: true,
  };
}

/**
 * Handle search request
 */
function handleSearch(request: AIRequest): AIResponse {
  const params = DIFFICULTY_PRESETS[request.difficulty];
  const random = createRandom(
    request.seed,
    `${request.occupiedLow}:${request.occupiedHigh}:${request.sideToMove}:${request.plyCount}:${request.difficulty}`,
  );
  
  // Check opening book first
  const bookMove = checkOpeningBook(
    request.occupiedLow,
    request.occupiedHigh,
    request.sideToMove,
    request.plyCount,
    random,
  );
  
  if (bookMove !== null) {
    return {
      type: 'result',
      id: request.id,
      bestMove: bookMove,
      depthReached: 0,
      nodesSearched: 0,
      principalVariation: [bookMove],
      elapsedMs: 0,
      ttHitRate: 0,
      score: 0,
      fromBook: true,
      usedWasm: false,
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
      request.id,
      request.occupiedLow,
      request.occupiedHigh,
      request.sideToMove,
      effectiveParams
    );
  } else {
    return searchTS(
      request.id,
      request.occupiedLow,
      request.occupiedHigh,
      request.sideToMove,
      effectiveParams,
      random,
    );
  }
}

/**
 * Message handler
 */
self.onmessage = (event: MessageEvent<AIRequest>) => {
  void (async () => {
    if (!initDone) {
      await initPromise;
    }

    try {
      const request = event.data;
      
      if (request.type === 'search') {
        const response = handleSearch(request);
        self.postMessage(response);
      }
    } catch (e) {
      const request = event.data;
      const error: AIError = {
        type: 'error',
        id: request?.id,
        message: e instanceof Error ? e.message : String(e),
      };
      self.postMessage(error);
    }
  })();
};

// Initialize on load
const initPromise = init().catch(e => {
  console.error('[DominorioAI] Initialization failed:', e);
  // Still signal ready so fallback can work
  initDone = true;
  const ready: AIReady = { type: 'ready', usedWasm: false };
  self.postMessage(ready);
});
