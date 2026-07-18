import { createHmac, timingSafeEqual } from 'node:crypto';

export const ATARI_GO_AI_PROXY_PREFIX = '/api/ai/atari-go';
export const ATARI_GO_AI_PROXY_MAX_BODY_BYTES = 8 * 1024;

const DEFAULT_UPSTREAM_TIMEOUT_MS = 2_500;
const DEFAULT_BODY_READ_TIMEOUT_MS = 2_000;
const DEFAULT_RATE_WINDOW_MS = 60_000;
const DEFAULT_SESSION_RATE_LIMIT = 30;
const DEFAULT_IP_RATE_LIMIT = 120;
const DEFAULT_RATE_CACHE_MAX = 20_000;

interface RateBucket {
  windowStartedAt: number;
  count: number;
}

export interface AtariGoAiProxyOptions {
  upstreamBaseUrl: string;
  sessionCookieName: string;
  sessionSecret: string;
  fetchImpl?: typeof fetch;
  upstreamTimeoutMs?: number;
  bodyReadTimeoutMs?: number;
  rateWindowMs?: number;
  sessionRateLimit?: number;
  ipRateLimit?: number;
  rateCacheMax?: number;
  now?: () => number;
}

class AiProxyRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function verifiedSessionId(
  request: Request,
  cookieName: string,
  secret: string,
): string | null {
  const encoded = request.headers.get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!encoded) return null;

  let raw: string;
  try {
    raw = decodeURIComponent(encoded);
  } catch {
    return null;
  }

  const separator = raw.lastIndexOf('.');
  if (separator <= 0 || separator === raw.length - 1) return null;
  const sessionId = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = createHmac('sha256', secret).update(sessionId).digest('base64url');
  // Comparação em bytes: length em caracteres deixa passar multibyte e
  // timingSafeEqual lança com buffers de tamanhos diferentes.
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (signatureBytes.byteLength !== expectedBytes.byteLength) return null;
  return timingSafeEqual(signatureBytes, expectedBytes) ? sessionId : null;
}

async function readLimitedBody(request: Request, timeoutMs: number): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > ATARI_GO_AI_PROXY_MAX_BODY_BYTES) {
    throw new AiProxyRequestError(413, 'payload-too-large');
  }

  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const deadline = Date.now() + timeoutMs;
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new AiProxyRequestError(408, 'request-body-timeout');
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new AiProxyRequestError(408, 'request-body-timeout')),
            remaining,
          );
        }),
      ]).finally(() => timer && clearTimeout(timer));
      if (result.done) break;
      total += result.value.byteLength;
      if (total > ATARI_GO_AI_PROXY_MAX_BODY_BYTES) {
        throw new AiProxyRequestError(413, 'payload-too-large');
      }
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function createAtariGoAiProxy(options: AtariGoAiProxyOptions) {
  const rateLimits = new Map<string, RateBucket>();
  const upstreamBaseUrl = options.upstreamBaseUrl.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
  const bodyReadTimeoutMs = options.bodyReadTimeoutMs ?? DEFAULT_BODY_READ_TIMEOUT_MS;
  const rateWindowMs = options.rateWindowMs ?? DEFAULT_RATE_WINDOW_MS;
  const sessionRateLimit = options.sessionRateLimit ?? DEFAULT_SESSION_RATE_LIMIT;
  const ipRateLimit = options.ipRateLimit ?? DEFAULT_IP_RATE_LIMIT;
  const rateCacheMax = options.rateCacheMax ?? DEFAULT_RATE_CACHE_MAX;
  const now = options.now ?? Date.now;

  function consumeRateBucket(key: string, limit: number, currentTime: number): boolean {
    const current = rateLimits.get(key);
    if (!current || currentTime - current.windowStartedAt >= rateWindowMs) {
      rateLimits.delete(key);
      rateLimits.set(key, { windowStartedAt: currentTime, count: 1 });
    } else {
      current.count += 1;
      rateLimits.delete(key);
      rateLimits.set(key, current);
      if (current.count > limit) return false;
    }

    while (rateLimits.size > rateCacheMax) {
      const oldest = rateLimits.keys().next().value as string | undefined;
      if (!oldest) break;
      rateLimits.delete(oldest);
    }
    return true;
  }

  function consumeRateLimit(request: Request): boolean {
    const currentTime = now();
    const ip = clientIp(request);
    if (!consumeRateBucket(`ip:${ip}`, ipRateLimit, currentTime)) return false;
    const sessionId = verifiedSessionId(
      request,
      options.sessionCookieName,
      options.sessionSecret,
    );
    return sessionId
      ? consumeRateBucket(`session:${sessionId}`, sessionRateLimit, currentTime)
      : consumeRateBucket(`anonymous:${ip}`, sessionRateLimit, currentTime);
  }

  return async function proxyAtariGoAi(request: Request, url = new URL(request.url)): Promise<Response> {
    const suffix = url.pathname.slice(ATARI_GO_AI_PROXY_PREFIX.length) || '/';
    const allowedMethod = suffix === '/health' ? 'GET' : suffix === '/move' ? 'POST' : null;
    if (!allowedMethod) return Response.json({ error: 'not-found' }, { status: 404 });
    if (request.method !== allowedMethod) {
      return Response.json({ error: 'method-not-allowed' }, { status: 405 });
    }
    if (suffix === '/move' && !consumeRateLimit(request)) {
      return Response.json(
        { error: 'rate-limited', message: 'Limite temporário da IA atingido; a usar N5 local.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    try {
      const body = request.method === 'POST'
        ? await readLimitedBody(request, bodyReadTimeoutMs)
        : undefined;
      const response = await fetchImpl(`${upstreamBaseUrl}${suffix}${url.search}`, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(upstreamTimeoutMs),
      });
      return new Response(await response.arrayBuffer(), {
        status: response.status,
        headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
      });
    } catch (error) {
      if (error instanceof AiProxyRequestError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      return Response.json(
        { error: 'ai-service-unavailable', message: 'Serviço de IA do Atari Go indisponível.' },
        { status: 503 },
      );
    }
  };
}
