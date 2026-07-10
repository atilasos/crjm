/**
 * AI Client - Interface between UI and AI Worker
 *
 * Uses the Dominório worker when available so the adapter can activate the
 * Rust/WASM engine in production, while preserving the inline TypeScript
 * fallback for dev / restricted environments.
 */

import type { 
  AIError,
  AIRequest, 
  AIReady,
  AIResponse, 
  AIDifficulty, 
  AIMetrics, 
  Side,
} from './types';
import { INITIAL_METRICS, DIFFICULTY_PRESETS } from './types';
import * as bitboard from './bitboard';
import type { DominorioState, Domino } from '../types';
import openingBook from './book.json';
import { selectDidacticBeginnerMove } from './difficulty-policy';

export interface AIClientOptions {
  onMetricsUpdate?: (metrics: AIMetrics) => void;
  onReady?: () => void;
}

export interface AIRuntimeInfo {
  engine: 'rust-wasm' | 'ts-fallback';
  usedWasm: boolean;
  fromBook: boolean;
}

export interface AIComputeOverrides {
  timeBudgetMs?: number;
  seed?: number;
  benchmarkMode?: boolean;
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
  deterministicFallback: boolean,
): () => number {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    if (deterministicFallback) {
      return mulberry32(fnv1a32(key));
    }
    return Math.random;
  }
  const mixedSeed = ((Math.trunc(seed) >>> 0) ^ fnv1a32(key)) >>> 0;
  return mulberry32(mixedSeed);
}

export class DominorioAIClient {
  private worker: Worker | null = null;
  private isReady = false;
  private nextId = 1;
  private options: AIClientOptions;
  private currentMetrics: AIMetrics = { ...INITIAL_METRICS };
  private searchAborted = false;
  private pending = new Map<
    number,
    {
      side: Side;
      resolve: (move: Domino | null) => void;
      reject: (error: Error) => void;
      runInline: () => Promise<Domino | null>;
    }
  >();
  
  constructor(options: AIClientOptions = {}) {
    this.options = options;
    this.initWorker();
  }

  private initWorker(): void {
    try {
      try {
        this.worker = new Worker(new URL('./ai/dominorio/dominorio.worker.js', import.meta.url), {
          type: 'module',
        });
      } catch {
        this.worker = new Worker(new URL('./dominorio.worker.ts', import.meta.url), {
          type: 'module',
        });
      }

      this.worker.onmessage = (event: MessageEvent<AIResponse | AIError | AIReady>) =>
        this.onMessage(event.data);
      this.worker.onerror = () => this.fallbackToInline('worker-error');
      this.isReady = false;
    } catch {
      this.worker = null;
      this.isReady = true;
      this.options.onReady?.();
    }
  }

  private fallbackToInline(reason: string): void {
    if (!this.worker) {
      this.isReady = true;
      this.options.onReady?.();
      return;
    }

    try {
      this.worker.terminate();
    } catch {
      // ignore
    }

    this.worker = null;
    this.isReady = true;
    console.warn?.('[DominorioAI] Falling back to inline engine:', reason);

    for (const [id, request] of this.pending) {
      this.pending.delete(id);
      void request
        .runInline()
        .then(request.resolve)
        .catch((error) => {
          request.reject(error instanceof Error ? error : new Error(String(error)));
        });
    }

    this.options.onReady?.();
  }

  private onMessage(message: AIResponse | AIError | AIReady): void {
    if (message.type === 'ready') {
      this.isReady = true;
      this.currentMetrics = { ...this.currentMetrics, usedWasm: message.usedWasm };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      this.options.onReady?.();
      return;
    }

    if (message.type === 'result') {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);

      this.updateMetrics(message);
      request.resolve(
        message.bestMove >= 0 ? bitboard.anchorToDomino(message.bestMove, request.side) : null,
      );
      return;
    }

    if (message.type === 'error' && message.id !== undefined) {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      this.currentMetrics = { ...INITIAL_METRICS };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      request.reject(new Error(message.message));
    }
  }
  
  /**
   * Check opening book for a move
   */
  private checkOpeningBook(
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
      return entries[idx];
    }
    
    return null;
  }
  
  /**
   * TypeScript search implementation (runs on main thread but yields periodically)
   */
  private async searchTS(
    occupiedLow: number,
    occupiedHigh: number,
    side: Side,
    timeBudgetMs: number,
    maxDepth: number,
    topN: number,
    scoreDelta: number,
    random: () => number,
  ): Promise<AIResponse> {
    const startTime = performance.now();
    const deadline = startTime + timeBudgetMs;
    
    let nodes = 0;
    this.searchAborted = false;
    
    const INF = 30000;
    const MATE = 29000;
    
    let bestMove = -1;
    let bestScore = -INF;
    let depthReached = 0;
    
    const moves = bitboard.generateMoves(occupiedLow, occupiedHigh, side);
    
    if (moves.length === 0) {
      return {
        type: 'result',
        id: 0,
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
    
    // Negamax with alpha-beta (yields every 512 nodes)
    const negamax = async (
      occLow: number,
      occHigh: number,
      currentSide: Side,
      depth: number,
      alpha: number,
      beta: number,
      ply: number
    ): Promise<number> => {
      nodes++;
      
      // Yield and check time every 512 nodes
      if ((nodes & 511) === 0) {
        await new Promise(r => setTimeout(r, 0));
        if (performance.now() >= deadline || this.searchAborted) {
          return 0;
        }
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
        
        const score = -(await negamax(newLow, newHigh, oppSide, depth - 1, -beta, -alpha, ply + 1));
        
        if (this.searchAborted || performance.now() >= deadline) return 0;
        
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
    };
    
    // Iterative deepening
    for (let depth = 1; depth <= maxDepth; depth++) {
      if (performance.now() >= deadline || this.searchAborted) break;
      
      let alpha = -INF;
      const beta = INF;
      let currentBest = orderedMoves[0];
      
      for (const mv of orderedMoves) {
        const [newLow, newHigh] = bitboard.applyMove(occupiedLow, occupiedHigh, mv, side);
        const oppSide = (1 - side) as Side;
        
        const score = -(await negamax(newLow, newHigh, oppSide, depth - 1, -beta, -alpha, 1));
        
        if (this.searchAborted || performance.now() >= deadline) break;
        
        if (score > alpha) {
          alpha = score;
          currentBest = mv;
        }
      }
      
      if (this.searchAborted || performance.now() >= deadline) break;
      
      depthReached = depth;
      bestScore = alpha;
      bestMove = currentBest;
    }
    
    // Apply randomization for easier difficulties
    if (topN > 0 && moves.length > 1) {
      const scoredMoves: { move: number; score: number }[] = [];
      
      for (const mv of orderedMoves.slice(0, topN)) {
        const [newLow, newHigh] = bitboard.applyMove(occupiedLow, occupiedHigh, mv, side);
        const oppSide = (1 - side) as Side;
        const score = -bitboard.evaluateAdvanced(newLow, newHigh, oppSide);
        scoredMoves.push({ move: mv, score });
      }
      
      scoredMoves.sort((a, b) => b.score - a.score);
      
      const candidates = scoredMoves.filter(
        s => scoredMoves[0].score - s.score <= scoreDelta
      );
      
      if (candidates.length > 1) {
        const idx = Math.floor(random() * candidates.length);
        bestMove = candidates[idx].move;
        bestScore = candidates[idx].score;
      }
    }
    
    return {
      type: 'result',
      id: 0,
      bestMove,
      depthReached,
      nodesSearched: nodes,
      principalVariation: bestMove >= 0 ? [bestMove] : [],
      elapsedMs: performance.now() - startTime,
      ttHitRate: 0,
      score: bestScore,
      fromBook: false,
      usedWasm: false,
    };
  }
  
  /**
   * Get the best move for the current position
   */
  async getBestMove(
    state: DominorioState,
    difficulty: AIDifficulty = 'medium',
    overrides: AIComputeOverrides = {},
  ): Promise<Domino | null> {
    // Convert board state to bitboard
    const [occupiedLow, occupiedHigh] = bitboard.boardToBitboard(state.tabuleiro);
    const side = bitboard.playerToSide(state.jogadorAtual);
    const plyCount = state.dominosColocados.length;
    
    const benchmarkMode =
      overrides.benchmarkMode === true ||
      (typeof overrides.seed === 'number' && Number.isFinite(overrides.seed));
    const random = createRandom(
      overrides.seed,
      `${occupiedLow}:${occupiedHigh}:${side}:${plyCount}:${difficulty}`,
      benchmarkMode,
    );
    
    // Update metrics to show thinking
    this.currentMetrics = { ...this.currentMetrics, isThinking: true };
    this.options.onMetricsUpdate?.(this.currentMetrics);

    if (difficulty === 'beginner') {
      const move = selectDidacticBeginnerMove(
        bitboard.generateMoves(occupiedLow, occupiedHigh, side),
        side,
      );
      if (move !== null) {
        const response: AIResponse = {
          type: 'result',
          id: 0,
          bestMove: move,
          depthReached: 0,
          nodesSearched: 0,
          principalVariation: [move],
          elapsedMs: 0,
          ttHitRate: 0,
          score: 0,
          fromBook: false,
          usedWasm: false,
        };
        this.updateMetrics(response);
        return bitboard.anchorToDomino(move, side);
      }
    }
    
    // Check opening book first
    const bookMove = this.checkOpeningBook(occupiedLow, occupiedHigh, side, plyCount, random);
    
    if (bookMove !== null) {
      const response: AIResponse = {
        type: 'result',
        id: 0,
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
      
      this.updateMetrics(response);
      return bitboard.anchorToDomino(bookMove, side);
    }
    
    // Get difficulty params
    const params = DIFFICULTY_PRESETS[difficulty];
    const timeBudgetMs =
      typeof overrides.timeBudgetMs === 'number' && Number.isFinite(overrides.timeBudgetMs)
        ? Math.max(1, Math.trunc(overrides.timeBudgetMs))
        : params.timeBudgetMs;

    const runInline = async (): Promise<Domino | null> => {
      const response = await this.searchTS(
        occupiedLow,
        occupiedHigh,
        side,
        timeBudgetMs,
        params.maxDepth,
        params.topN,
        params.scoreDelta,
        random,
      );

      this.updateMetrics(response);

      if (response.bestMove < 0) {
        return null;
      }

      return bitboard.anchorToDomino(response.bestMove, side);
    };

    if (this.worker) {
      const requestId = this.nextId++;
      const request: AIRequest = {
        type: 'search',
        id: requestId,
        occupiedLow,
        occupiedHigh,
        sideToMove: side,
        timeBudgetMs,
        difficulty,
        plyCount,
        seed: overrides.seed,
      };

      return await new Promise<Domino | null>((resolve, reject) => {
        this.pending.set(requestId, {
          side,
          resolve,
          reject,
          runInline,
        });

        try {
          this.worker?.postMessage(request);
        } catch (error) {
          this.pending.delete(requestId);
          void runInline().then(resolve).catch(reject);
          this.fallbackToInline(error instanceof Error ? error.message : String(error));
        }
      });
    }
    
    // Run search
    return await runInline();
  }
  
  /**
   * Update metrics from search result
   */
  private updateMetrics(response: AIResponse): void {
    this.currentMetrics = {
      isThinking: false,
      lastDepth: response.depthReached,
      lastNodes: response.nodesSearched,
      lastTimeMs: response.elapsedMs,
      lastTTHitRate: response.ttHitRate,
      lastScore: response.score,
      fromBook: response.fromBook,
      usedWasm: response.usedWasm,
    };
    this.options.onMetricsUpdate?.(this.currentMetrics);
  }
  
  /**
   * Cancel current search
   */
  cancel(): void {
    this.searchAborted = true;
    this.currentMetrics = { ...INITIAL_METRICS };
    this.options.onMetricsUpdate?.(this.currentMetrics);
  }
  
  /**
   * Terminate (no-op for inline version)
   */
  terminate(): void {
    this.searchAborted = true;
    this.isReady = false;
  }
  
  /**
   * Check if ready
   */
  get ready(): boolean {
    return this.isReady;
  }
  
  /**
   * Get current metrics
   */
  get metrics(): AIMetrics {
    return this.currentMetrics;
  }

  get runtimeInfo(): AIRuntimeInfo {
    return {
      engine: this.currentMetrics.usedWasm ? 'rust-wasm' : 'ts-fallback',
      usedWasm: this.currentMetrics.usedWasm,
      fromBook: this.currentMetrics.fromBook,
    };
  }
}

/**
 * Create a singleton AI client instance
 */
let clientInstance: DominorioAIClient | null = null;

export function getDominorioAIClient(options?: AIClientOptions): DominorioAIClient {
  if (!clientInstance) {
    clientInstance = new DominorioAIClient(options);
  }
  return clientInstance;
}

export function resetDominorioAIClient(): void {
  if (clientInstance) {
    clientInstance.terminate();
    clientInstance = null;
  }
}
