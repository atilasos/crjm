import { describe, expect, test } from 'bun:test';
import { criarEstadoInicial, isJogadaValida } from '../logic';
import {
  AtariGoAIClient,
  SERVER_AI_TOTAL_TIMEOUT_MS,
  SERVER_AI_WITH_FALLBACK_TIMEOUT_MS,
  idxToPos,
} from './ai-client';

function makeFetchMock(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): {
  fetchFn: typeof fetch;
  calls: string[];
  bodies: string[];
} {
  const calls: string[] = [];
  const bodies: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (typeof init?.body === 'string') bodies.push(init.body);
    return handler(url, init);
  }) as typeof fetch;
  return { fetchFn, calls, bodies };
}

function serverOkFetch(move: number) {
  return makeFetchMock((url) => {
    if (url.endsWith('/health')) {
      return Response.json({ status: 'ok', model: 'runs/az-v1/best.pt', device: 'cuda' });
    }
    return Response.json({
      move,
      value: 0.12,
      topMoves: [{ move, prior: 0.4, visits: 250 }],
      stats: { sims: 400, elapsedMs: 480, engine: 'server-nn' },
    });
  });
}

describe('AtariGoAIClient — nível 6 (servidor) e fallback', () => {
  test('nível 6 usa a jogada do servidor e regista engine server-nn', async () => {
    const { fetchFn, calls, bodies } = serverOkFetch(40);
    const client = new AtariGoAIClient({ disableWorker: true, serverFetch: fetchFn });

    const state = criarEstadoInicial('vs-computador');
    state.ultimaJogada = { linha: 1, coluna: 2 };
    const move = await client.getBestMove(state, 'very-hard', { level: 6, seed: 7 });

    expect(move).toBe(40);
    expect(client.metrics.lastEngine).toBe('server-nn');
    expect(client.metrics.lastStats?.nodes).toBe(400);
    expect(calls.some((url) => url.endsWith('/health'))).toBe(true);
    expect(calls.some((url) => url.endsWith('/move'))).toBe(true);
    expect(JSON.parse(bodies.at(-1)!).lastMove).toBe(11);
    client.terminate();
  });

  test('nível 6 com fetch a falhar cai silenciosamente no caminho local (N5)', async () => {
    const { fetchFn } = makeFetchMock(() => {
      throw new Error('ECONNREFUSED');
    });
    const client = new AtariGoAIClient({ disableWorker: true, serverFetch: fetchFn });

    const state = criarEstadoInicial('vs-computador');
    const move = await client.getBestMove(state, 'very-hard', { level: 6, seed: 7 });

    expect(move).not.toBeNull();
    expect(isJogadaValida(state, idxToPos(move!))).toBe(true);
    expect(client.metrics.lastEngine).toBe('ts-fallback');
    client.terminate();
  });

  test('nível 6 com health-check 503 cai no caminho local', async () => {
    const { fetchFn, calls } = makeFetchMock(() =>
      Response.json({ error: 'ai-service-unavailable' }, { status: 503 }),
    );
    const client = new AtariGoAIClient({ disableWorker: true, serverFetch: fetchFn });

    const state = criarEstadoInicial('vs-computador');
    const move = await client.getBestMove(state, 'very-hard', { level: 6, seed: 11 });

    expect(move).not.toBeNull();
    expect(isJogadaValida(state, idxToPos(move!))).toBe(true);
    expect(client.metrics.lastEngine).toBe('ts-fallback');
    expect(calls.filter((url) => url.endsWith('/move')).length).toBe(0);
    client.terminate();
  });

  test('nível 6 com jogada ilegal do servidor cai no caminho local', async () => {
    const state = criarEstadoInicial('vs-computador');
    state.tabuleiro[4]![4] = 'preta'; // 40 fica ocupada -> ilegal
    state.jogadasValidas = state.jogadasValidas.filter(
      (p) => !(p.linha === 4 && p.coluna === 4),
    );

    const { fetchFn } = serverOkFetch(40);
    const client = new AtariGoAIClient({ disableWorker: true, serverFetch: fetchFn });

    const move = await client.getBestMove(state, 'very-hard', { level: 6, seed: 3 });

    expect(move).not.toBeNull();
    expect(move).not.toBe(40);
    expect(isJogadaValida(state, idxToPos(move!))).toBe(true);
    expect(client.metrics.lastEngine).toBe('ts-fallback');
    client.terminate();
  });

  test('cancelamento durante o fetch N6 aborta o pedido e não inicia fallback tardio', async () => {
    let aborted = false;
    const fetchFn = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('cancelled', 'AbortError'));
        });
      })) as typeof fetch;
    const client = new AtariGoAIClient({ disableWorker: true, serverFetch: fetchFn });
    const pending = client.getBestMove(criarEstadoInicial('vs-computador'), 'very-hard', {
      level: 6,
    });

    client.cancel();

    expect(await pending).toBeNull();
    expect(aborted).toBe(true);
    expect(client.metrics.lastEngine).toBeUndefined();
    client.terminate();
  });

  test('timeout total reserva o orçamento completo para o fallback N5', () => {
    expect(SERVER_AI_WITH_FALLBACK_TIMEOUT_MS).toBeGreaterThanOrEqual(
      SERVER_AI_TOTAL_TIMEOUT_MS + 2000 + 500,
    );
  });

  test('níveis 1..5 nunca contactam o servidor', async () => {
    const { fetchFn, calls } = serverOkFetch(40);
    const client = new AtariGoAIClient({ disableWorker: true, serverFetch: fetchFn });

    const state = criarEstadoInicial('vs-computador');
    const move = await client.getBestMove(state, 'hard', { level: 5, seed: 1 });

    expect(move).not.toBeNull();
    expect(isJogadaValida(state, idxToPos(move!))).toBe(true);
    expect(calls.length).toBe(0);
    client.terminate();
  });
});
