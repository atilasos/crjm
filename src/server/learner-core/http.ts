import type { Server } from 'bun';
import type { GameId } from '../../ai-core/types';
import type { LearnerCommandResponse, LearnerDashboardPayload } from '../../types/learner-core';
import { getLearnerCoreConfig } from './config';
import { getLearnerCoreDb } from './db';
import { LearnerCoreService } from './service';

const config = getLearnerCoreConfig();
const service = new LearnerCoreService(getLearnerCoreDb(config));

function json(data: LearnerDashboardPayload | LearnerCommandResponse | Record<string, unknown>, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function errorResponse(error: unknown, status = 400): Response {
  return json({ error: error instanceof Error ? error.message : 'unexpected error' }, { status });
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, chunk) => {
    const [rawKey, ...rest] = chunk.trim().split('=');
    if (!rawKey || rest.length === 0) return acc;
    acc[rawKey] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function sessionCookie(value: string): string {
  return `${config.sessionCookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.sessionCookieMaxAgeSeconds}`;
}

async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}

function withSession(req: Request): { userId: string; headers: Headers } {
  const cookies = parseCookies(req.headers.get('cookie'));
  const session = service.ensureSession(cookies[config.sessionCookieName] ?? null);
  const headers = new Headers();
  headers.append('Set-Cookie', sessionCookie(session.sessionId));
  return { userId: session.userId, headers };
}

export async function handleAppRequest(req: Request, _server: Server<unknown>): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === '/api/health') {
    return json({ ok: true, service: 'learner-core-v1' });
  }

  if (url.pathname === '/api/auth/session' && req.method === 'GET') {
    const { userId, headers } = withSession(req);
    return json({ userId }, { headers });
  }

  if (url.pathname === '/api/learner/dashboard' && req.method === 'GET') {
    const { userId, headers } = withSession(req);
    return json(service.getDashboard(userId), { headers });
  }

  if (url.pathname === '/api/learner/import-local-profile' && req.method === 'POST') {
    try {
      const { userId, headers } = withSession(req);
      const body = await readJson<{ profile: unknown }>(req);
      return json(service.importLocalProfile(userId, body.profile), { headers });
    } catch (error) {
      return errorResponse(error, 409);
    }
  }

  if (url.pathname === '/api/learner/events/game-completed' && req.method === 'POST') {
    try {
      const { userId, headers } = withSession(req);
      const body = await readJson<{ gameId: GameId; won: boolean }>(req);
      return json(service.recordGameCompleted(userId, body.gameId, body.won), { headers });
    } catch (error) {
      return errorResponse(error);
    }
  }

  if (url.pathname === '/api/learner/events/review-completed' && req.method === 'POST') {
    try {
      const { userId, headers } = withSession(req);
      const body = await readJson<{ gameId: GameId }>(req);
      return json(service.recordReviewCompleted(userId, body.gameId), { headers });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return json({ error: 'not_found', path: url.pathname }, { status: 404 });
}
