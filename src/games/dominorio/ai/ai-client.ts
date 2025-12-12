/**
 * AI Client - Interface between UI and AI Worker
 * 
 * Uses inline search (non-blocking via yielding) instead of Web Worker
 * due to Bun dev server limitations. Still runs the TypeScript engine
 * with the same API, and can be upgraded to Worker when needed.
 */

import type { 
  AIRequest, 
  AIResponse, 
  AIDifficulty, 
  AIMetrics, 
  Side,
} from './types';
import { INITIAL_METRICS, DIFFICULTY_PRESETS } from './types';
import * as bitboard from './bitboard';
import type { DominorioState, Domino } from '../types';
import openingBook from './book.json';

export interface AIClientOptions {
  onMetricsUpdate?: (metrics: AIMetrics) => void;
  onReady?: () => void;
}

export class DominorioAIClient {
  private isReady = false;
  private options: AIClientOptions;
  private currentMetrics: AIMetrics = { ...INITIAL_METRICS };
  private searchAborted = false;
  
  constructor(options: AIClientOptions = {}) {
    this.options = options;
    // Signal ready immediately (no worker to initialize)
    setTimeout(() => {
      this.isReady = true;
      this.options.onReady?.();
    }, 0);
  }
  
  /**
   * Check opening book for a move
   */
  private checkOpeningBook(
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
      const idx = Math.floor(Math.random() * entries.length);
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
    scoreDelta: number
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
        const idx = Math.floor(Math.random() * candidates.length);
        bestMove = candidates[idx].move;
        bestScore = candidates[idx].score;
      }
    }
    
    return {
      type: 'result',
      bestMove,
      depthReached,
      nodesSearched: nodes,
      principalVariation: bestMove >= 0 ? [bestMove] : [],
      elapsedMs: performance.now() - startTime,
      ttHitRate: 0,
      score: bestScore,
      fromBook: false,
    };
  }
  
  /**
   * Get the best move for the current position
   */
  async getBestMove(
    state: DominorioState,
    difficulty: AIDifficulty = 'medium'
  ): Promise<Domino | null> {
    // Convert board state to bitboard
    const [occupiedLow, occupiedHigh] = bitboard.boardToBitboard(state.tabuleiro);
    const side = bitboard.playerToSide(state.jogadorAtual);
    const plyCount = state.dominosColocados.length;
    
    // Update metrics to show thinking
    this.currentMetrics = { ...this.currentMetrics, isThinking: true };
    this.options.onMetricsUpdate?.(this.currentMetrics);
    
    // Check opening book first
    const bookMove = this.checkOpeningBook(occupiedLow, occupiedHigh, side, plyCount);
    
    if (bookMove !== null) {
      const response: AIResponse = {
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
      
      this.updateMetrics(response);
      return bitboard.anchorToDomino(bookMove, side);
    }
    
    // Get difficulty params
    const params = DIFFICULTY_PRESETS[difficulty];
    
    // Run search
    const response = await this.searchTS(
      occupiedLow,
      occupiedHigh,
      side,
      params.timeBudgetMs,
      params.maxDepth,
      params.topN,
      params.scoreDelta
    );
    
    this.updateMetrics(response);
    
    // Convert anchor to Domino
    if (response.bestMove < 0) {
      return null;
    }
    
    return bitboard.anchorToDomino(response.bestMove, side);
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
