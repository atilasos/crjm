import type { ProdutoState, Posicao } from '../types';
import { gerarPosicoesValidas, posToKey } from '../types';
import type { AIRequest, AIResponse, AIDifficulty, AIMetrics, ProdutoPackedMove } from './types';
import { buildIndexMaps, packState, DIFFICULTY_PRESETS, INITIAL_METRICS } from './types';

export interface AIClientOptions {
  onReady?: () => void;
  onMetricsUpdate?: (m: AIMetrics) => void;
}

export interface DecodedMove {
  pos1: Posicao;
  cor1: 'preta' | 'branca';
  pos2: Posicao | null;
  cor2: 'preta' | 'branca' | null;
}

const INDEX_MAPS = buildIndexMaps(gerarPosicoesValidas, posToKey);

export function decodeMove(move: ProdutoPackedMove, idxToPos: Posicao[]): DecodedMove | null {
  const pos1 = idxToPos[move.posA];
  if (!pos1) return null;
  const cor1 = move.colorA === 0 ? 'preta' : 'branca';

  if (move.posB < 0) {
    return { pos1, cor1, pos2: null, cor2: null };
  }

  const pos2 = idxToPos[move.posB];
  if (!pos2) return null;
  const cor2 = move.colorB === 0 ? 'preta' : 'branca';
  return { pos1, cor1, pos2, cor2 };
}

export class ProdutoAIClient {
  private worker: Worker | null = null;
  private isReady = false;
  private nextId = 1;
  private pending = new Map<number, { resolve: (m: ProdutoPackedMove | null) => void; reject: (e: Error) => void }>();
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
        this.worker = new Worker(new URL('./ai/produto/produto.worker.js', import.meta.url), { type: 'module' });
      } catch {
        // Dev (`bun --hot src/index.ts`): load worker directly from source.
        this.worker = new Worker(new URL('./produto.worker.ts', import.meta.url), { type: 'module' });
      }
      this.worker.onmessage = (event: MessageEvent<AIResponse>) => this.onMessage(event.data);
      this.worker.onerror = () => this.fallbackToNoWorker('worker-error');
      this.isReady = false; // becomes true on worker 'ready'
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
    this.cancel();
    console.warn?.('[ProdutoAI] Falling back (no worker):', reason);
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

  async getBestMove(state: ProdutoState, difficulty: AIDifficulty = 'hard'): Promise<ProdutoPackedMove | null> {
    this.currentMetrics = { ...this.currentMetrics, isThinking: true };
    this.options.onMetricsUpdate?.(this.currentMetrics);

    const preset = DIFFICULTY_PRESETS[difficulty];
    void preset; // reservado para presets adicionais no futuro

    if (!this.worker) {
      // Fallback mínimo: sem worker, sem WASM (deixar o jogo usar `jogadaComputador`)
      this.currentMetrics = { ...INITIAL_METRICS };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      return null;
    }

    const id = this.nextId++;
    const req: AIRequest = {
      type: 'choose',
      id,
      state: packState(state, INDEX_MAPS.keyToIdx),
      difficulty,
      seed: (Date.now() >>> 0) + id,
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

  get idxToPos(): Posicao[] {
    return INDEX_MAPS.idxToPos;
  }
}
