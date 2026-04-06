import type { AtariGoState, Posicao } from '../types';
import type {
  AIComputeOverrides,
  AIRequest,
  AIResponse,
  AIDifficulty,
  AIMetrics,
} from './types';
import { INITIAL_METRICS, packState } from './types';

export interface AIClientOptions {
  onReady?: () => void;
  onMetricsUpdate?: (m: AIMetrics) => void;
}

export function idxToPos(idx: number): Posicao {
  return { linha: Math.floor(idx / 9), coluna: idx % 9 };
}

export class AtariGoAIClient {
  private worker: Worker | null = null;
  private isReady = false;
  private nextId = 1;
  private pending = new Map<number, { resolve: (m: number | null) => void; reject: (e: Error) => void }>();
  private currentMetrics: AIMetrics = { ...INITIAL_METRICS };
  private options: AIClientOptions;

  constructor(options: AIClientOptions = {}) {
    this.options = options;
    this.initWorker();
  }

  private initWorker(): void {
    try {
      // Production (GitHub Pages build): worker bundle lives under `dist/ai/...`
      try {
        this.worker = new Worker(new URL('./ai/atari-go/atari-go.worker.js', import.meta.url), { type: 'module' });
      } catch {
        // Dev (`bun --hot src/index.ts`): load worker directly from source.
        this.worker = new Worker(new URL('./atari-go.worker.ts', import.meta.url), { type: 'module' });
      }

      this.worker.onmessage = (event: MessageEvent<AIResponse>) => this.onMessage(event.data);
      this.worker.onerror = () => this.fallbackToNoWorker('worker-error');
      this.isReady = false; // becomes true on worker 'ready'
    } catch {
      this.worker = null;
      this.isReady = true; // allow UI to proceed with TS fallback
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
    this.cancel();
    console.warn?.('[AtariGoAI] Falling back (no worker):', reason);
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
        lastStats: msg.stats,
      };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      p.resolve(msg.move);
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

  async getBestMove(
    state: AtariGoState,
    difficulty: AIDifficulty = 'hard',
    overrides: AIComputeOverrides = {},
  ): Promise<number | null> {
    this.currentMetrics = { ...this.currentMetrics, isThinking: true };
    this.options.onMetricsUpdate?.(this.currentMetrics);

    if (!this.worker) {
      this.currentMetrics = { ...INITIAL_METRICS };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      return null;
    }

    const id = this.nextId++;
    const timeBudgetMs =
      typeof overrides.timeBudgetMs === 'number' && Number.isFinite(overrides.timeBudgetMs)
        ? Math.max(1, Math.trunc(overrides.timeBudgetMs))
        : undefined;
    const seed =
      typeof overrides.seed === 'number' && Number.isFinite(overrides.seed)
        ? Math.trunc(overrides.seed) >>> 0
        : ((Date.now() >>> 0) + id) >>> 0;
    const req: AIRequest = {
      type: 'choose',
      id,
      state: packState(state),
      difficulty,
      timeBudgetMs,
      seed,
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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
