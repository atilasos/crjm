/**
 * AI Client for Gatos & Cães.
 *
 * Browser searches run in a worker so a long N4/N5 search never blocks board
 * interaction. Restricted environments keep the same bounded inline engine.
 */

import { getDifficultyProfile } from '../../../ai-core/difficulty';
import type { GatosCaesState, Posicao } from '../types';
import { computeBestMove } from './engine';
import type { SearchStats, WorkerMessage, WorkerResponse } from './types';

export interface AIComputeOverrides {
  timeLimitMs?: number;
}

interface WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: Event) => void) | null;
  postMessage(message: WorkerMessage): void;
  terminate(): void;
}

type ComputeInline = typeof computeBestMove;

export interface GatosCaesAIClientOptions {
  workerFactory?: () => WorkerLike | null;
  computeInline?: ComputeInline;
}

interface PendingSearch {
  state: GatosCaesState;
  difficulty: number;
  timeLimitMs: number;
  resolve: (result: AIResult) => void;
}

interface AIResult {
  move: Posicao | null;
  stats: SearchStats;
}

function emptyStats(runtime: 'worker' | 'inline'): SearchStats {
  return {
    nodes: 0,
    ttHits: 0,
    ttProbes: 0,
    cutoffs: 0,
    depth: 0,
    score: 0,
    bestMove: null,
    timeMs: 0,
    nodesPerSecond: 0,
    runtime,
  };
}

function createBrowserWorker(): WorkerLike | null {
  if (typeof Worker === 'undefined') return null;

  try {
    return new Worker(new URL('./ai/gatos-caes/gatos-caes.worker.js', import.meta.url), {
      type: 'module',
    });
  } catch {
    try {
      return new Worker(new URL('./gatos-caes.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      return null;
    }
  }
}

function resolveTimeLimit(difficulty: number, override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override)) {
    return Math.max(1, Math.trunc(override));
  }
  return getDifficultyProfile(difficulty).timeBudgetMs;
}

export class GatosCaesAIClient {
  private worker: WorkerLike | null;
  private readonly computeInline: ComputeInline;
  private readonly pending = new Map<number, PendingSearch>();
  private nextRequestId = 1;
  private ready: boolean;

  constructor(options: GatosCaesAIClientOptions = {}) {
    this.computeInline = options.computeInline ?? computeBestMove;
    this.worker = options.workerFactory ? options.workerFactory() : createBrowserWorker();
    this.ready = this.worker === null;

    if (this.worker) {
      this.worker.onmessage = (event) => this.handleMessage(event.data);
      this.worker.onerror = () => this.fallbackPendingInline();
    }
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  async computeMove(
    state: GatosCaesState,
    difficulty = 3,
    overrides: AIComputeOverrides = {},
  ): Promise<AIResult> {
    const timeLimitMs = resolveTimeLimit(difficulty, overrides.timeLimitMs);

    if (!this.worker) {
      return this.runInline(state, difficulty, timeLimitMs);
    }

    const requestId = this.nextRequestId++;
    return new Promise<AIResult>((resolve) => {
      this.pending.set(requestId, { state, difficulty, timeLimitMs, resolve });
      try {
        this.worker?.postMessage({
          type: 'compute_move',
          state,
          difficulty,
          requestId,
          timeLimitMs,
        });
      } catch {
        const pending = this.pending.get(requestId);
        this.pending.delete(requestId);
        this.worker = null;
        if (pending) pending.resolve(this.runInline(pending.state, pending.difficulty, pending.timeLimitMs));
      }
    });
  }

  cancel(): void {
    this.worker?.postMessage({ type: 'cancel' });
    for (const pending of this.pending.values()) {
      pending.resolve({ move: null, stats: emptyStats('worker') });
    }
    this.pending.clear();
  }

  terminate(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }

  get isReady(): boolean {
    return this.ready;
  }

  private handleMessage(message: WorkerResponse): void {
    if (message.type === 'ready') {
      this.ready = true;
      return;
    }

    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    this.pending.delete(message.requestId);
    pending.resolve({
      move: message.move,
      stats: { ...message.stats, runtime: 'worker' },
    });
  }

  private runInline(state: GatosCaesState, difficulty: number, timeLimitMs: number): AIResult {
    const result = this.computeInline(state, difficulty, { timeLimit: timeLimitMs });
    return {
      move: result.move,
      stats: { ...result.stats, runtime: 'inline' },
    };
  }

  private fallbackPendingInline(): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    try {
      this.worker?.terminate();
    } catch {
      // A worker that already failed may also reject termination.
    }
    this.worker = null;
    this.ready = true;

    for (const request of pending) {
      request.resolve(this.runInline(request.state, request.difficulty, request.timeLimitMs));
    }
  }
}

let sharedClient: GatosCaesAIClient | null = null;

function getSharedClient(): GatosCaesAIClient {
  sharedClient ??= new GatosCaesAIClient();
  return sharedClient;
}

export function initAI(): Promise<void> {
  return getSharedClient().init();
}

export function computeMove(
  state: GatosCaesState,
  difficulty = 3,
  overrides: AIComputeOverrides = {},
): Promise<AIResult> {
  return getSharedClient().computeMove(state, difficulty, overrides);
}

export function cancelComputation(): void {
  sharedClient?.cancel();
}

export function terminateAI(): void {
  sharedClient?.terminate();
  sharedClient = null;
}

export function isAIReady(): boolean {
  return sharedClient?.isReady ?? false;
}
