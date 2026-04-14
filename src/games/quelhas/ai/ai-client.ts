/**
 * Quelhas AI Client - inspirado no Dominório:
 * - Worker para não bloquear UI
 * - métricas para display
 * - presets de dificuldade
 */

import type { QuelhasState, Segmento } from '../types';
import type { AIRequest, AIResponse, AIDifficulty, AIMetrics } from './types';
import { DIFFICULTY_PRESETS, INITIAL_METRICS } from './types';
import { getOrientacaoJogador } from '../logic';
import { searchBestMove } from './engine';

export interface AIClientOptions {
  onReady?: () => void;
  onMetricsUpdate?: (m: AIMetrics) => void;
}

export interface AIRequestOverrides {
  timeBudgetMs?: number;
}

export class QuelhasAIClient {
  private worker: Worker | null = null;
  private isReady = false;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (m: Segmento | null) => void;
      reject: (e: Error) => void;
      runInline: () => Segmento | null;
    }
  >();
  private currentMetrics: AIMetrics = { ...INITIAL_METRICS };
  private options: AIClientOptions;

  constructor(options: AIClientOptions = {}) {
    this.options = options;
    this.initWorker();
  }

  private initWorker(): void {
    try {
      try {
        this.worker = new Worker(new URL('./ai/quelhas/quelhas.worker.js', import.meta.url), { type: 'module' });
      } catch {
        this.worker = new Worker(new URL('./quelhas.worker.ts', import.meta.url), { type: 'module' });
      }
      this.worker.onmessage = (event: MessageEvent<AIResponse>) => this.onMessage(event.data);
      this.worker.onerror = () => this.fallbackToInline('worker-error');
      // Considerar pronto imediatamente: o worker sinaliza "ready" cedo e usa TS fallback se o WASM ainda estiver a carregar.
      this.isReady = true;
      this.options.onReady?.();
    } catch {
      // Fallback: sem worker (dev / ambiente limitado)
      this.worker = null;
      this.isReady = true;
      this.options.onReady?.();
    }
  }

  private fallbackToInline(reason: string): void {
    // Se já estamos em fallback, não repetir
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

    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      try {
        pending.resolve(pending.runInline());
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Opcional: manter log só em ambientes com consola
    console.warn?.('[QuelhasAI] Falling back to inline engine:', reason);
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
      if (!p) return; // pode ter sido cancelado
      this.pending.delete(msg.id);

      this.currentMetrics = {
        isThinking: false,
        lastDepth: msg.depthReached,
        lastNodes: msg.nodesSearched,
        lastTimeMs: msg.elapsedMs,
        lastTTHitRate: msg.ttHitRate,
        lastScore: msg.score,
        fromBook: msg.fromBook,
        lastEngine: msg.engine,
        lastUsedWasm: msg.usedWasm,
      };
      this.options.onMetricsUpdate?.(this.currentMetrics);

      p.resolve(msg.bestMove);
      return;
    }

    if (msg.type === 'error') {
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          this.currentMetrics = { ...INITIAL_METRICS };
          this.options.onMetricsUpdate?.(this.currentMetrics);
          p.reject(new Error(msg.message));
        }
      }
    }
  }

  async getBestMove(
    state: QuelhasState,
    difficulty: AIDifficulty = 'hard',
    overrides: AIRequestOverrides = {},
  ): Promise<Segmento | null> {
    const minhaOrientacao = getOrientacaoJogador(state, state.jogadorAtual);
    const orientacaoAdv = getOrientacaoJogador(
      state,
      state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1'
    );

    this.currentMetrics = { ...this.currentMetrics, isThinking: true };
    this.options.onMetricsUpdate?.(this.currentMetrics);

    const preset = DIFFICULTY_PRESETS[difficulty];
    const timeBudgetMs =
      typeof overrides.timeBudgetMs === 'number' && Number.isFinite(overrides.timeBudgetMs)
        ? Math.max(1, Math.trunc(overrides.timeBudgetMs))
        : preset.timeBudgetMs;

    if (!this.worker) {
      const result = searchBestMove(state.tabuleiro, minhaOrientacao, {
        ...preset,
        timeBudgetMs,
      });
      this.currentMetrics = {
        isThinking: false,
        lastDepth: result.depthReached,
        lastNodes: result.nodesSearched,
        lastTimeMs: result.elapsedMs,
        lastTTHitRate: result.ttHitRate,
        lastScore: result.score,
        fromBook: result.fromBook,
        lastEngine: 'ts-fallback',
        lastUsedWasm: false,
      };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      return result.bestMove;
    }

    const id = this.nextId++;
    const req: AIRequest = {
      type: 'search',
      id,
      tabuleiro: state.tabuleiro,
      orientacaoIA: minhaOrientacao,
      orientacaoAdv,
      timeBudgetMs,
      difficulty,
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        runInline: () => {
          const result = searchBestMove(state.tabuleiro, minhaOrientacao, {
            ...preset,
            timeBudgetMs,
          });
          this.currentMetrics = {
            isThinking: false,
            lastDepth: result.depthReached,
            lastNodes: result.nodesSearched,
            lastTimeMs: result.elapsedMs,
            lastTTHitRate: result.ttHitRate,
            lastScore: result.score,
            fromBook: result.fromBook,
            lastEngine: 'ts-fallback',
            lastUsedWasm: false,
          };
          this.options.onMetricsUpdate?.(this.currentMetrics);
          return result.bestMove;
        },
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
