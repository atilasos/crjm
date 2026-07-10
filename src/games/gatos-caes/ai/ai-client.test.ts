import { describe, expect, test } from 'bun:test';
import { criarEstadoInicial } from '../logic';
import type { GatosCaesState, Posicao } from '../types';
import type { SearchStats, WorkerMessage, WorkerResponse } from './types';
import { GatosCaesAIClient } from './ai-client';

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly messages: WorkerMessage[] = [];
  terminated = false;

  postMessage(message: WorkerMessage): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: WorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>);
  }
}

function stats(move: Posicao | null, timeMs = 12): SearchStats {
  return {
    nodes: 42,
    ttHits: 3,
    ttProbes: 5,
    cutoffs: 2,
    depth: 4,
    score: 10,
    bestMove: move ? { pos: move, packed: move.linha * 8 + move.coluna } : null,
    timeMs,
    nodesPerSecond: 3500,
  };
}

describe('GatosCaesAIClient', () => {
  test('runs search in a worker and forwards the requested time limit', async () => {
    const worker = new FakeWorker();
    let inlineCalls = 0;
    const client = new GatosCaesAIClient({
      workerFactory: () => worker,
      computeInline: () => {
        inlineCalls += 1;
        return { move: null, stats: stats(null) };
      },
    });
    const state = criarEstadoInicial('vs-computador');

    const pending = client.computeMove(state, 4, { timeLimitMs: 73 });
    const request = worker.messages[0];

    expect(request).toMatchObject({
      type: 'compute_move',
      difficulty: 4,
      timeLimitMs: 73,
    });
    if (request.type !== 'compute_move') throw new Error('expected compute request');

    const move = state.jogadasValidas[0];
    worker.emit({
      type: 'move_result',
      requestId: request.requestId,
      move,
      stats: stats(move),
    });

    expect(await pending).toEqual({
      move,
      stats: { ...stats(move), runtime: 'worker' },
    });
    expect(inlineCalls).toBe(0);
  });

  test('uses the same time limit in the inline fallback', async () => {
    let receivedLimit = 0;
    const client = new GatosCaesAIClient({
      workerFactory: () => null,
      computeInline: (_state: GatosCaesState, _difficulty: number, options?: { timeLimit?: number }) => {
        receivedLimit = options?.timeLimit ?? 0;
        return { move: null, stats: stats(null) };
      },
    });

    await client.computeMove(criarEstadoInicial('vs-computador'), 5, { timeLimitMs: 91 });

    expect(receivedLimit).toBe(91);
  });

  test('cancels pending work without leaving a promise unresolved', async () => {
    const worker = new FakeWorker();
    const client = new GatosCaesAIClient({ workerFactory: () => worker });

    const pending = client.computeMove(criarEstadoInicial('vs-computador'), 3, { timeLimitMs: 50 });
    client.cancel();

    expect(await pending).toEqual({ move: null, stats: expect.objectContaining({ timeMs: 0 }) });
    expect(worker.messages.at(-1)).toEqual({ type: 'cancel' });
  });
});
