/**
 * Quelhas AI Client - inspirado no Dominório:
 * - Worker para não bloquear UI
 * - métricas para display
 * - presets de dificuldade
 */

import type { QuelhasState, Segmento } from '../types';
import type { AIRequest, AIResponse, AIDifficulty, AIMetrics } from './types';
import { DIFFICULTY_PRESETS, INITIAL_METRICS } from './types';
import { calcularJogadasValidas, getOrientacaoJogador } from '../logic';
import { searchBestMove } from './engine';

export const QUELHAS_SERVER_AI_BASE_URL = '/api/ai/quelhas';
export const QUELHAS_SERVER_AI_TOTAL_TIMEOUT_MS = 2500;
/** Espera máxima do N6 incluindo fallback local (servidor + N5). */
export const QUELHAS_SERVER_AI_WITH_FALLBACK_TIMEOUT_MS = 5000;
const SERVER_AI_HEALTH_TIMEOUT_MS = 600;
const BOARD_SIZE = 10;

function actionToSegmento(action: number, orientacao: 'vertical' | 'horizontal'): Segmento {
  const start = Math.floor(action / 9);
  return {
    inicio: { linha: Math.floor(start / BOARD_SIZE), coluna: start % BOARD_SIZE },
    comprimento: (action % 9) + 2,
    orientacao,
  };
}

function sameSegmento(a: Segmento, b: Segmento): boolean {
  return (
    a.inicio.linha === b.inicio.linha &&
    a.inicio.coluna === b.inicio.coluna &&
    a.comprimento === b.comprimento &&
    a.orientacao === b.orientacao
  );
}

export interface AIClientOptions {
  onReady?: () => void;
  onMetricsUpdate?: (m: AIMetrics) => void;
  serverBaseUrl?: string;
  serverTimeoutMs?: number;
  serverFetch?: typeof fetch;
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

  private serverGeneration = 0;

  /**
   * Nível 6 «Mestre»: tenta a rede az-quelhas no servidor (health rápido +
   * POST /move, jogada validada como legal); em qualquer falha degrada em
   * silêncio para o N5 local (worker WASM/TS). `cancel()` invalida a geração.
   */
  async getBestMoveN6(state: QuelhasState, overrides: AIRequestOverrides = {}): Promise<Segmento | null> {
    const generation = ++this.serverGeneration;
    const controller = new AbortController();
    const serverMove = await this.tryServerMove(state, overrides, controller.signal, generation);
    if (generation !== this.serverGeneration) return null;
    if (serverMove) {
      this.currentMetrics = {
        ...this.currentMetrics,
        isThinking: false,
        lastEngine: 'server-nn',
        lastUsedWasm: false,
      };
      this.options.onMetricsUpdate?.(this.currentMetrics);
      return serverMove;
    }
    return this.getBestMove(state, 'master', overrides);
  }

  private async tryServerMove(
    state: QuelhasState,
    overrides: AIRequestOverrides,
    signal: AbortSignal,
    generation: number,
  ): Promise<Segmento | null> {
    const fetchFn = this.options.serverFetch ?? globalThis.fetch?.bind(globalThis);
    if (!fetchFn) return null;
    const base = this.options.serverBaseUrl ?? QUELHAS_SERVER_AI_BASE_URL;
    const totalTimeoutMs = this.options.serverTimeoutMs ?? QUELHAS_SERVER_AI_TOTAL_TIMEOUT_MS;
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

      const board = state.tabuleiro.flat().map((c) => (c === 'vazia' ? 0 : 1));
      const budgetMs = Math.max(
        100,
        Math.min(
          typeof overrides.timeBudgetMs === 'number' && Number.isFinite(overrides.timeBudgetMs)
            ? Math.trunc(overrides.timeBudgetMs)
            : 2000,
          remainingMs - 200,
        ),
      );
      const response = await fetchFn(`${base}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board,
          toPlay: state.jogadorAtual === 'jogador1' ? 1 : 2,
          timeBudgetMs: budgetMs,
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(remainingMs)]),
      });
      if (signal.aborted || generation !== this.serverGeneration || !response.ok) return null;

      const data = (await response.json()) as { move?: number };
      if (signal.aborted || generation !== this.serverGeneration) return null;
      const action = data?.move;
      if (typeof action !== 'number' || !Number.isInteger(action) || action < 0 || action > 899) {
        return null;
      }
      const orientacao = getOrientacaoJogador(state, state.jogadorAtual);
      const move = actionToSegmento(action, orientacao);
      const legal = calcularJogadasValidas(state.tabuleiro, orientacao);
      return legal.some((m) => sameSegmento(m, move)) ? move : null;
    } catch {
      return null;
    }
  }

  cancel(): void {
    this.serverGeneration += 1;
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
