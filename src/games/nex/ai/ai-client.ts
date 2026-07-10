import type { NexState } from '../types';
import type { AIDifficulty, AIRequest, AIResponse, AIMetrics, NexAiAction } from './types';
import { DIFFICULTY_PRESETS, INITIAL_METRICS, isValidAiAction, packState } from './types';
import { chooseFallbackActionFromState } from './fallback-engine';

export interface AIClientOptions {
  onReady?: () => void;
  onMetricsUpdate?: (m: AIMetrics) => void;
}

export class NexAIClient {
  private worker: Worker | null = null;
  private isReady = false;
  private nextId = 1;
  private pending = new Map<number, {
    resolve: (a: NexAiAction | null) => void;
    reject: (e: Error) => void;
    runFallback: () => NexAiAction | null;
  }>();
  private currentMetrics: AIMetrics = { ...INITIAL_METRICS };
  private options: AIClientOptions;

  constructor(options: AIClientOptions = {}) {
    this.options = options;
    this.initWorker();
  }

  private initWorker(): void {
    try {
      try {
        this.worker = new Worker(new URL('./ai/nex/nex.worker.js', import.meta.url), { type: 'module' });
      } catch {
        this.worker = new Worker(new URL('./nex.worker.ts', import.meta.url), { type: 'module' });
      }
      this.worker.onmessage = (event: MessageEvent<AIResponse>) => this.onMessage(event.data);
      this.worker.onerror = () => this.fallbackToNoWorker('worker-error');
      this.isReady = false;
    } catch {
      this.worker = null;
      this.isReady = true;
      this.options.onReady?.();
    }
  }

  private fallbackToNoWorker(reason: string): void {
    if (!this.worker) return;
    try {
      this.worker.terminate();
    } catch {
      // ignore
    }
    this.worker = null;
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const request of pending) request.resolve(request.runFallback());
    this.currentMetrics = { ...INITIAL_METRICS, lastExplain: 'Fallback estratégico local' };
    this.options.onMetricsUpdate?.(this.currentMetrics);
    console.warn?.('[NexAI] Falling back (no worker):', reason);
    this.isReady = true;
    this.options.onReady?.();
  }

  private onMessage(msg: AIResponse): void {
    if (msg.type === 'ready') {
      this.isReady = true;
      this.options.onReady?.();
      return;
    }

    if (msg.type === 'result') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      this.currentMetrics = {
        isThinking: false,
        lastTimeMs: msg.elapsedMs,
        usedWasm: msg.usedWasm,
        lastExplain: msg.explain,
      };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      p.resolve(msg.action);
      return;
    }

    if (msg.type === 'error') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      this.currentMetrics = { ...INITIAL_METRICS };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      p.reject(new Error(msg.message));
    }
  }

  async getBestAction(
    state: NexState,
    difficulty: AIDifficulty,
    options: { timeBudgetMs?: number; seed?: number } = {},
  ): Promise<NexAiAction | null> {
    this.currentMetrics = { ...this.currentMetrics, isThinking: true };
    this.options.onMetricsUpdate?.(this.currentMetrics);

    const preset = DIFFICULTY_PRESETS[difficulty];
    void preset;

    if (!this.worker) {
      const fallbackAction = chooseFallbackActionFromState(state, difficulty, options);
      this.currentMetrics = { ...INITIAL_METRICS };
      this.currentMetrics.lastExplain = 'Fallback estratégico local';
      this.options.onMetricsUpdate?.(this.currentMetrics);
      return fallbackAction;
    }

    const id = this.nextId++;
    const req: AIRequest = {
      type: 'choose',
      id,
      state: packState(state),
      difficulty,
      timeBudgetMs: options.timeBudgetMs,
      seed: options.seed ?? (((Date.now() >>> 0) + id) >>> 0),
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (action) => resolve(isValidAiAction(state, action) ? action : null),
        reject,
        runFallback: () => chooseFallbackActionFromState(state, difficulty, options),
      });
      this.worker!.postMessage(req);
    });
  }

  cancel(): void {
    for (const [id, p] of this.pending) {
      this.pending.delete(id);
      p.reject(new Error('cancelled'));
    }
    this.currentMetrics = { ...INITIAL_METRICS };
    this.options.onMetricsUpdate?.(this.currentMetrics);
  }

  terminate(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
    this.isReady = false;
  }

  get ready(): boolean {
    return this.isReady;
  }

  get metrics(): AIMetrics {
    return this.currentMetrics;
  }
}
