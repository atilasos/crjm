import { getDifficultyProfile } from '../../../ai-core/difficulty';
import { calcularJogadasValidas } from '../logic';
import type { AtariGoState, Posicao } from '../types';
import type {
  AIComputeOverrides,
  AIRequest,
  AIResponse,
  AIDifficulty,
  AIMetrics,
} from './types';
import { INITIAL_METRICS, packState } from './types';
import { chooseFallbackMoveIndex } from './fallback-engine';

export const SERVER_AI_BASE_URL = '/api/ai/atari-go';
export const SERVER_AI_TOTAL_TIMEOUT_MS = 2500;
/** Servidor (2,5 s) + fallback local N5 (2 s) + margem de UI. */
export const SERVER_AI_WITH_FALLBACK_TIMEOUT_MS = 5000;
const SERVER_AI_HEALTH_TIMEOUT_MS = 600;
/** Nível que ativa o caminho servidor (rede neuronal, N6 «Mestre»). */
const SERVER_AI_LEVEL = 6;
/** Perfil usado no fallback local quando o servidor falha. */
const SERVER_FALLBACK_LEVEL = 5;

interface ServerMoveResponse {
  move?: unknown;
  value?: unknown;
  stats?: { sims?: number; elapsedMs?: number };
}

export interface AIClientOptions {
  onReady?: () => void;
  onMetricsUpdate?: (m: AIMetrics) => void;
  /** Base do serviço de inferência (default: proxy `/api/ai/atari-go`). */
  serverBaseUrl?: string;
  /** Timeout total do caminho servidor, health-check incluído. */
  serverTimeoutMs?: number;
  /** Injeção de fetch para testes. */
  serverFetch?: typeof fetch;
  /** Força o caminho inline (sem worker) — usado em testes e scripts. */
  disableWorker?: boolean;
}

export function idxToPos(idx: number): Posicao {
  return { linha: Math.floor(idx / 9), coluna: idx % 9 };
}

/** O worker/fallback TS só conhece níveis 1..5; o 6 usa o perfil 5. */
function clampWorkerLevel(
  level: AIComputeOverrides['level'],
): 1 | 2 | 3 | 4 | 5 | undefined {
  if (level === undefined) return undefined;
  return level >= SERVER_FALLBACK_LEVEL ? SERVER_FALLBACK_LEVEL : level;
}

export class AtariGoAIClient {
  private worker: Worker | null = null;
  private isReady = false;
  private nextId = 1;
  private pending = new Map<number, {
    resolve: (m: number | null) => void;
    reject: (e: Error) => void;
    runFallback: () => number | null;
  }>();
  private currentMetrics: AIMetrics = { ...INITIAL_METRICS };
  private options: AIClientOptions;
  private serverAbortController: AbortController | null = null;
  private serverGeneration = 0;

  constructor(options: AIClientOptions = {}) {
    this.options = options;
    this.initWorker();
  }

  private initWorker(): void {
    if (this.options.disableWorker) {
      this.worker = null;
      this.isReady = true;
      this.options.onReady?.();
      return;
    }
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
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const request of pending) request.resolve(request.runFallback());
    this.currentMetrics = { ...INITIAL_METRICS };
    this.options.onMetricsUpdate?.(this.currentMetrics);
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
        lastEngine: msg.usedWasm ? 'rust-wasm' : 'ts-fallback',
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

  /**
   * Caminho servidor (N6): health-check rápido + POST /move dentro do timeout
   * total. Devolve o índice da jogada validado como legal, ou null em qualquer
   * falha (timeout, 503, offline, resposta inválida ou jogada ilegal).
   */
  private async tryServerMove(
    state: AtariGoState,
    overrides: AIComputeOverrides,
    signal: AbortSignal,
    generation: number,
  ): Promise<number | null> {
    const fetchFn = this.options.serverFetch ?? globalThis.fetch?.bind(globalThis);
    if (!fetchFn) return null;
    const base = this.options.serverBaseUrl ?? SERVER_AI_BASE_URL;
    const totalTimeoutMs = this.options.serverTimeoutMs ?? SERVER_AI_TOTAL_TIMEOUT_MS;
    const started = Date.now();
    try {
      const health = await fetchFn(`${base}/health`, {
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(Math.min(SERVER_AI_HEALTH_TIMEOUT_MS, totalTimeoutMs)),
        ]),
      });
      if (signal.aborted || generation !== this.serverGeneration || !health.ok) return null;

      const remainingMs = totalTimeoutMs - (Date.now() - started);
      if (remainingMs <= 100) return null;

      const packed = packState(state);
      const budgetMs = Math.max(
        100,
        Math.min(
          typeof overrides.timeBudgetMs === 'number' && Number.isFinite(overrides.timeBudgetMs)
            ? Math.trunc(overrides.timeBudgetMs)
            : getDifficultyProfile(SERVER_AI_LEVEL, 'atari-go').timeBudgetMs,
          remainingMs - 200,
        ),
      );
      const response = await fetchFn(`${base}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: Array.from(packed.board),
          toPlay: packed.toPlay === 0 ? 1 : 2,
          lastMove: state.ultimaJogada
            ? state.ultimaJogada.linha * 9 + state.ultimaJogada.coluna
            : null,
          timeBudgetMs: budgetMs,
          seed: overrides.seed,
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(remainingMs)]),
      });
      if (signal.aborted || generation !== this.serverGeneration || !response.ok) return null;

      const data = (await response.json()) as ServerMoveResponse;
      if (signal.aborted || generation !== this.serverGeneration) return null;
      const move = data?.move;
      if (typeof move !== 'number' || !Number.isInteger(move) || move < 0 || move > 80) {
        return null;
      }
      const legalMoves =
        state.jogadasValidas.length > 0
          ? state.jogadasValidas
          : calcularJogadasValidas(state.tabuleiro, state.jogadorAtual);
      if (!legalMoves.some((p) => p.linha * 9 + p.coluna === move)) return null;
      if (signal.aborted || generation !== this.serverGeneration) return null;

      this.currentMetrics = {
        isThinking: false,
        lastTimeMs: Date.now() - started,
        usedWasm: false,
        lastEngine: 'server-nn',
        lastStats: {
          nodes: data.stats?.sims,
          elapsedMs: data.stats?.elapsedMs,
        },
      };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      return move;
    } catch {
      return null;
    }
  }

  async getBestMove(
    state: AtariGoState,
    difficulty: AIDifficulty = 'hard',
    overrides: AIComputeOverrides = {},
  ): Promise<number | null> {
    this.currentMetrics = { ...this.currentMetrics, isThinking: true };
    this.options.onMetricsUpdate?.(this.currentMetrics);

    let effectiveOverrides = overrides;
    if (overrides.level === SERVER_AI_LEVEL) {
      const generation = ++this.serverGeneration;
      this.serverAbortController?.abort();
      const controller = new AbortController();
      this.serverAbortController = controller;
      const serverMove = await this.tryServerMove(
        state,
        overrides,
        controller.signal,
        generation,
      );
      if (this.serverAbortController === controller) this.serverAbortController = null;
      if (serverMove !== null) return serverMove;
      if (controller.signal.aborted || generation !== this.serverGeneration) return null;
      // Fallback silencioso: caminho local (worker/WASM ou TS) com o perfil N5.
      effectiveOverrides = {
        ...overrides,
        level: SERVER_FALLBACK_LEVEL,
        timeBudgetMs: getDifficultyProfile(SERVER_FALLBACK_LEVEL).timeBudgetMs,
      };
    } else {
      this.serverGeneration += 1;
      this.serverAbortController?.abort();
      this.serverAbortController = null;
    }

    if (!this.worker) {
      const move = chooseFallbackMoveIndex(state, {
        ...effectiveOverrides,
        level: clampWorkerLevel(effectiveOverrides.level),
      });
      this.currentMetrics = {
        ...INITIAL_METRICS,
        lastEngine: 'ts-fallback',
      };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      return move;
    }

    const id = this.nextId++;
    const timeBudgetMs =
      typeof effectiveOverrides.timeBudgetMs === 'number' && Number.isFinite(effectiveOverrides.timeBudgetMs)
        ? Math.max(1, Math.trunc(effectiveOverrides.timeBudgetMs))
        : undefined;
    const seed =
      typeof effectiveOverrides.seed === 'number' && Number.isFinite(effectiveOverrides.seed)
        ? Math.trunc(effectiveOverrides.seed) >>> 0
        : ((Date.now() >>> 0) + id) >>> 0;
    const req: AIRequest = {
      type: 'choose',
      id,
      state: packState(state),
      difficulty,
      timeBudgetMs,
      seed,
      coreLevel: clampWorkerLevel(effectiveOverrides.level),
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        runFallback: () =>
          chooseFallbackMoveIndex(state, {
            ...effectiveOverrides,
            level: clampWorkerLevel(effectiveOverrides.level),
          }),
      });
      this.worker!.postMessage(req);
    });
  }

  cancel(): void {
    this.serverGeneration += 1;
    this.serverAbortController?.abort();
    this.serverAbortController = null;
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
