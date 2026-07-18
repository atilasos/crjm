import type { Server } from 'bun';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { GameId } from '../../ai-core/types';
import type { PatternEvidence } from '../../ai-core/learner-gamification';
import type { LearnerCommandResponse, LearnerDashboardPayload } from '../../types/learner-core';
import { getLearnerCoreConfig } from './config';
import { getLearnerCoreDb } from './db';
import { LearnerCoreService } from './service';

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

function getRuntime() {
  const config = getLearnerCoreConfig();
  return {
    config,
    service: new LearnerCoreService(getLearnerCoreDb(config)),
  };
}

function signSessionId(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}

function encodeSessionCookieValue(sessionId: string, secret: string): string {
  return `${sessionId}.${signSessionId(sessionId, secret)}`;
}

function decodeSessionCookieValue(rawValue: string | undefined, secret: string): string | null {
  if (!rawValue) return null;

  const separator = rawValue.lastIndexOf('.');
  if (separator <= 0 || separator === rawValue.length - 1) return null;

  const sessionId = rawValue.slice(0, separator);
  const signature = rawValue.slice(separator + 1);
  const expectedSignature = signSessionId(sessionId, secret);

  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (signatureBytes.byteLength !== expectedBytes.byteLength) return null;
  if (!timingSafeEqual(signatureBytes, expectedBytes)) return null;

  return sessionId;
}

function sessionCookie(sessionId: string, config: ReturnType<typeof getLearnerCoreConfig>): string {
  const value = encodeSessionCookieValue(sessionId, config.sessionSecret);
  const secure = config.sessionCookieSecure ? '; Secure' : '';
  return `${config.sessionCookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${config.sessionCookieMaxAgeSeconds}`;
}

async function readJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T;
}

function withSession(req: Request): { userId: string; headers: Headers } {
  const { config, service } = getRuntime();
  const cookies = parseCookies(req.headers.get('cookie'));
  const sessionId = decodeSessionCookieValue(cookies[config.sessionCookieName], config.sessionSecret);
  const session = service.ensureSession(sessionId);
  const headers = new Headers();
  headers.append('Set-Cookie', sessionCookie(session.sessionId, config));
  return { userId: session.userId, headers };
}

export async function handleAppRequest(req: Request, _server: Server<unknown>): Promise<Response> {
  const { service } = getRuntime();
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
      const body = await readJson<{ gameId: GameId; won: boolean; difficultyLevel?: number }>(req);
      return json(
        service.recordGameCompleted(userId, body.gameId, body.won, body.difficultyLevel),
        { headers },
      );
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

  if (url.pathname === '/api/learner/events/puzzle-solved' && req.method === 'POST') {
    try {
      const { userId, headers } = withSession(req);
      const body = await readJson<{ gameId: GameId; puzzleId?: string; usedHint?: boolean }>(req);
      return json(service.recordPuzzleSolved(userId, body.gameId, {
        puzzleId: body.puzzleId,
        usedHint: Boolean(body.usedHint),
      }), { headers });
    } catch (error) {
      return errorResponse(error);
    }
  }

  if (url.pathname === '/api/learner/events/pattern-progress' && req.method === 'POST') {
    try {
      const { userId, headers } = withSession(req);
      const body = await readJson<{
        gameId: GameId;
        patternId: string;
        evidence: PatternEvidence;
        contextId: string;
      }>(req);
      return json(service.recordPatternProgress(userId, body), { headers });
    } catch (error) {
      return errorResponse(error);
    }
  }

  if (url.pathname === '/api/learner/missions/claim' && req.method === 'POST') {
    try {
      const { userId, headers } = withSession(req);
      const body = await readJson<{ missionId: string }>(req);
      return json(service.claimMissionReward(userId, body.missionId), { headers });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return json({ error: 'not_found', path: url.pathname }, { status: 404 });
}
