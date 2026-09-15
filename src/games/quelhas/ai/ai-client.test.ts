import { describe, expect, test } from 'bun:test';
import { QuelhasAIClient, type QuelhasWorkerPort } from './ai-client';
import { criarEstadoInicial, parseTabuleiroASCII } from '../logic';
import type { AIRequest, AIResponse } from './types';

class WorkerDouble implements QuelhasWorkerPort {
  onmessage: QuelhasWorkerPort['onmessage'] = null;
  onerror: QuelhasWorkerPort['onerror'] = null;
  requests: AIRequest[] = [];
  terminated = false;
  postMessage(request: AIRequest) { this.requests.push(request); }
  terminate() { this.terminated = true; }
  reply(message: AIResponse) { this.onmessage?.(new MessageEvent('message', { data: message })); }
}

describe('Quelhas request lifecycle', () => {
  test('cancelling actually interrupts the worker before the next turn', async () => {
    const workers: WorkerDouble[] = [];
    const client = new QuelhasAIClient({ workerFactory: () => {
      const worker = new WorkerDouble(); workers.push(worker); return worker;
    } });
    const state = criarEstadoInicial('vs-computador');
    const first = client.getBestMove(state, 'master');
    const rejection = first.catch((error: unknown) => error instanceof Error ? error.message : 'unknown');
    client.cancel();
    expect(await rejection).toBe('cancelled');
    expect(workers[0]!.terminated).toBe(true);
    const second = client.getBestMove(state, 'hard');
    expect(workers).toHaveLength(2);
    const request = workers[1]!.requests[0]!;
    const move = state.jogadasValidas[0]!;
    workers[1]!.reply({ type: 'result', id: request.id, bestMove: move,
      depthReached: 4, nodesSearched: 100, elapsedMs: 10, ttHitRate: 0, score: 0,
      fromBook: false, engine: 'rust-wasm', usedWasm: true });
    expect(await second).toEqual(move);
    client.terminate();
    expect(workers).toHaveLength(2);
    expect(workers[1]!.terminated).toBe(true);
  });

  test('N6 sends the orientation after swap and aborts a cancelled server request', async () => {
    let sentSide: number | undefined;
    let requestSignal: AbortSignal | undefined;
    let posted!: () => void;
    const requestStarted = new Promise<void>(resolve => { posted = resolve; });
    const client = new QuelhasAIClient({ workerFactory: () => new WorkerDouble(), serverFetch: async (url, init) => {
      if (String(url).endsWith('/health')) return new Response('{}');
      if (typeof init?.body !== 'string') throw new Error('missing body');
      sentSide = JSON.parse(init.body).toPlay;
      requestSignal = init.signal ?? undefined;
      posted();
      return new Promise<Response>((_, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    } });
    const state = { ...criarEstadoInicial('vs-computador'), orientacaoJogador1: 'horizontal' as const, orientacaoJogador2: 'vertical' as const };
    const pending = client.getBestMoveN6(state);
    await requestStarted;
    expect(sentSide).toBe(2);
    client.cancel();
    expect(requestSignal?.aborted).toBe(true);
    expect(await pending).toBeNull();
    client.terminate();
  });

  test('N6 resolves an independent long-strip final before asking the network', async () => {
    let calls = 0;
    const client = new QuelhasAIClient({ workerFactory: () => new WorkerDouble(), serverFetch: async () => { calls++; return new Response('{}'); } });
    const state = { ...criarEstadoInicial('vs-computador'), tabuleiro: parseTabuleiroASCII(
      Array.from({length: 10}, (_, r) => r === 4 ? '.#........' : '.#########').join('\n')) };
    const move = await client.getBestMoveN6(state);
    expect(move?.comprimento).toBeGreaterThanOrEqual(8);
    expect(calls).toBe(0);
    expect(client.metrics.lastEngine).toBe('exact-endgame');
    client.terminate();
  });
});
