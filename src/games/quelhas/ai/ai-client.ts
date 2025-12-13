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

export class QuelhasAIClient {
  private worker: Worker | null = null;
  private isReady = false;
  private nextId = 1;
  private pending = new Map<number, { resolve: (m: Segmento | null) => void; reject: (e: Error) => void }>();
  private currentMetrics: AIMetrics = { ...INITIAL_METRICS };
  private options: AIClientOptions;

  constructor(options: AIClientOptions = {}) {
    this.options = options;
    this.initWorker();
  }

  private initWorker(): void {
    try {
      this.worker = new Worker(new URL('./quelhas.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<AIResponse>) => this.onMessage(event.data);
      this.worker.onerror = () => {
        this.isReady = false;
      };
    } catch {
      // Fallback: sem worker (dev / ambiente limitado)
      this.worker = null;
      this.isReady = true;
      this.options.onReady?.();
    }
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

  async getBestMove(state: QuelhasState, difficulty: AIDifficulty = 'hard'): Promise<Segmento | null> {
    const minhaOrientacao = getOrientacaoJogador(state, state.jogadorAtual);
    const orientacaoAdv = getOrientacaoJogador(
      state,
      state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1'
    );

    this.currentMetrics = { ...this.currentMetrics, isThinking: true };
    this.options.onMetricsUpdate?.(this.currentMetrics);

    const preset = DIFFICULTY_PRESETS[difficulty];

    if (!this.worker) {
      const result = searchBestMove(state.tabuleiro, minhaOrientacao, preset);
      this.currentMetrics = {
        isThinking: false,
        lastDepth: result.depthReached,
        lastNodes: result.nodesSearched,
        lastTimeMs: result.elapsedMs,
        lastTTHitRate: result.ttHitRate,
        lastScore: result.score,
        fromBook: result.fromBook,
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
      difficulty,
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

