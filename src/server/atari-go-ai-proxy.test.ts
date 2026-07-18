import { afterEach, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import {
  ATARI_GO_AI_PROXY_MAX_BODY_BYTES,
  createAtariGoAiProxy,
} from './atari-go-ai-proxy';

const SECRET = 'proxy-test-secret';
const COOKIE_NAME = 'crjm_session';

function signedCookie(sessionId: string): string {
  const signature = createHmac('sha256', SECRET).update(sessionId).digest('base64url');
  return `${COOKIE_NAME}=${encodeURIComponent(`${sessionId}.${signature}`)}`;
}

function request(
  path: string,
  init: RequestInit = {},
  sessionId?: string,
): Request {
  const headers = new Headers(init.headers);
  headers.set('cf-connecting-ip', '203.0.113.10');
  if (sessionId) headers.set('cookie', signedCookie(sessionId));
  return new Request(`http://app.test${path}`, { ...init, headers });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('proxy da IA N6 do Atari Go', () => {
  test('encaminha apenas GET /health e preserva query/status/content-type', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? 'GET' });
      return Response.json({ status: 'ok' }, { status: 201 });
    }) as typeof fetch;
    const proxy = createAtariGoAiProxy({
      upstreamBaseUrl: 'http://127.0.0.1:8100/',
      sessionCookieName: COOKIE_NAME,
      sessionSecret: SECRET,
      fetchImpl,
    });

    const response = await proxy(request('/api/ai/atari-go/health?probe=1'));

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(calls).toEqual([
      { url: 'http://127.0.0.1:8100/health?probe=1', method: 'GET' },
    ]);
  });

  test('rejeita caminhos e métodos que não fazem parte da superfície pública', async () => {
    const fetchImpl = (async () => Response.json({ unexpected: true })) as typeof fetch;
    const proxy = createAtariGoAiProxy({
      upstreamBaseUrl: 'http://127.0.0.1:8100',
      sessionCookieName: COOKIE_NAME,
      sessionSecret: SECRET,
      fetchImpl,
    });

    const missing = await proxy(request('/api/ai/atari-go/admin'));
    const wrongMethod = await proxy(request('/api/ai/atari-go/health', { method: 'POST' }));

    expect(missing.status).toBe(404);
    expect(wrongMethod.status).toBe(405);
  });

  test('rejeita o corpo acima de 8 KiB antes de contactar a GPU', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return Response.json({ move: 0 });
    }) as typeof fetch;
    const proxy = createAtariGoAiProxy({
      upstreamBaseUrl: 'http://127.0.0.1:8100',
      sessionCookieName: COOKIE_NAME,
      sessionSecret: SECRET,
      fetchImpl,
    });
    const body = 'x'.repeat(ATARI_GO_AI_PROXY_MAX_BODY_BYTES + 1);

    const response = await proxy(request('/api/ai/atari-go/move', {
      method: 'POST',
      body,
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'payload-too-large' });
    expect(calls).toBe(0);
  });

  test('aplica o rate limit por sessão assinada, sem misturar alunos no mesmo IP', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return Response.json({ move: 40 });
    }) as typeof fetch;
    const proxy = createAtariGoAiProxy({
      upstreamBaseUrl: 'http://127.0.0.1:8100',
      sessionCookieName: COOKIE_NAME,
      sessionSecret: SECRET,
      fetchImpl,
      sessionRateLimit: 1,
      ipRateLimit: 10,
    });
    const moveInit = { method: 'POST', body: '{}' };

    const firstA = await proxy(request('/api/ai/atari-go/move', moveInit, 'student-a'));
    const secondA = await proxy(request('/api/ai/atari-go/move', moveInit, 'student-a'));
    const firstB = await proxy(request('/api/ai/atari-go/move', moveInit, 'student-b'));

    expect(firstA.status).toBe(200);
    expect(secondA.status).toBe(429);
    expect(secondA.headers.get('retry-after')).toBe('60');
    expect(firstB.status).toBe(200);
    expect(calls).toBe(2);
  });

  test('trata cookie forjado com assinatura multibyte como sessão anónima, sem lançar', async () => {
    const fetchImpl = (async () => Response.json({ move: 40 })) as typeof fetch;
    const proxy = createAtariGoAiProxy({
      upstreamBaseUrl: 'http://127.0.0.1:8100',
      sessionCookieName: COOKIE_NAME,
      sessionSecret: SECRET,
      fetchImpl,
    });
    // 43 caracteres (comprimento de um HMAC base64url) mas com um multibyte:
    // em bytes fica maior do que o esperado e tem de falhar fechado, não com 500.
    const forgedSignature = `${'A'.repeat(42)}é`;
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.10',
      cookie: `${COOKIE_NAME}=${encodeURIComponent(`atacante.${forgedSignature}`)}`,
    });
    const response = await proxy(
      new Request('http://app.test/api/ai/atari-go/move', { method: 'POST', body: '{}', headers }),
    );
    expect(response.status).toBe(200);
  });

  test('converte falhas e timeouts do upstream em 503 para ativar o fallback N5', async () => {
    const fetchImpl = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    const proxy = createAtariGoAiProxy({
      upstreamBaseUrl: 'http://127.0.0.1:8100',
      sessionCookieName: COOKIE_NAME,
      sessionSecret: SECRET,
      fetchImpl,
    });

    const response = await proxy(request('/api/ai/atari-go/move', {
      method: 'POST',
      body: '{}',
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'ai-service-unavailable',
      message: 'Serviço de IA do Atari Go indisponível.',
    });
  });
});
