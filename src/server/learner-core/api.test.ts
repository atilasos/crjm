import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { handleAppRequest } from './http';

const cleanup: string[] = [];
const originalNodeEnv = process.env.NODE_ENV;

async function withTempDb() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'crjm-learner-http-'));
  cleanup.push(dir);
  process.env.CRJM_LEARNER_DB_PATH = path.join(dir, 'learner.sqlite');
  process.env.CRJM_SESSION_SECRET = 'test-session-secret';
}

afterEach(async () => {
  delete process.env.CRJM_LEARNER_DB_PATH;
  delete process.env.CRJM_SESSION_SECRET;
  delete process.env.CRJM_COOKIE_SECURE;
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('learner core HTTP routes', () => {
  test('bootstraps a session cookie and returns dashboard data', async () => {
    await withTempDb();
    const server = {} as Parameters<typeof handleAppRequest>[1];

    const sessionResponse = await handleAppRequest(new Request('http://localhost/api/auth/session'), server);
    const cookie = sessionResponse.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('crjm_session=');

    const dashboardResponse = await handleAppRequest(
      new Request('http://localhost/api/learner/dashboard', { headers: { cookie } }),
      server,
    );
    const dashboard = await dashboardResponse.json();

    expect(dashboard.profile.displayName).toBeTruthy();
    expect(dashboard.profile.locale).toBe('pt-PT');
    expect(dashboard.gameProgress.dominorio.played).toBe(0);
  });

  test('rejects tampered session cookies and issues a fresh signed session', async () => {
    await withTempDb();
    const server = {} as Parameters<typeof handleAppRequest>[1];

    const sessionResponse = await handleAppRequest(new Request('http://localhost/api/auth/session'), server);
    const cookie = sessionResponse.headers.get('set-cookie') ?? '';
    const tamperedCookie = cookie.replace(/crjm_session=[^;]+/, 'crjm_session=invalid.signature');

    const dashboardResponse = await handleAppRequest(
      new Request('http://localhost/api/learner/dashboard', { headers: { cookie: tamperedCookie } }),
      server,
    );

    expect(dashboardResponse.headers.get('set-cookie')).not.toBe(cookie);
    expect(dashboardResponse.headers.get('set-cookie')).toContain('crjm_session=');
  });

  test('bootstraps an HTTP classroom session in production without forcing Secure', async () => {
    await withTempDb();
    delete process.env.CRJM_SESSION_SECRET;
    process.env.NODE_ENV = 'production';

    const server = {} as Parameters<typeof handleAppRequest>[1];

    const sessionResponse = await handleAppRequest(new Request('http://localhost/api/auth/session'), server);
    const cookie = sessionResponse.headers.get('set-cookie') ?? '';

    expect(sessionResponse.status).toBe(200);
    expect(cookie).toContain('crjm_session=');
    expect(cookie).not.toContain('Secure');

    const dashboardResponse = await handleAppRequest(
      new Request('http://localhost/api/learner/dashboard', { headers: { cookie } }),
      server,
    );
    const dashboard = await dashboardResponse.json();

    expect(dashboardResponse.status).toBe(200);
    expect(dashboard.profile.displayName).toBeTruthy();
  });

  test('marks the session cookie Secure when HTTPS deployment opts in', async () => {
    await withTempDb();
    process.env.NODE_ENV = 'production';
    process.env.CRJM_COOKIE_SECURE = 'true';

    const response = await handleAppRequest(
      new Request('https://jogos.example/api/auth/session'),
      {} as Parameters<typeof handleAppRequest>[1],
    );

    expect(response.headers.get('set-cookie')).toContain('Secure');
  });

  test('accepts pedagogical gamification commands through the learner API', async () => {
    await withTempDb();
    const server = {} as Parameters<typeof handleAppRequest>[1];
    const sessionResponse = await handleAppRequest(new Request('http://localhost/api/auth/session'), server);
    const cookie = sessionResponse.headers.get('set-cookie') ?? '';
    const post = (path: string, body: unknown) => handleAppRequest(new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }), server);

    const puzzle = await post('/api/learner/events/puzzle-solved', { gameId: 'atari-go' });
    expect(puzzle.status).toBe(200);
    expect((await puzzle.json()).dashboard.achievements.first_puzzle).toBeDefined();

    const pattern = await post('/api/learner/events/pattern-progress', {
      gameId: 'produto',
      patternId: 'produto:equilibrio',
      evidence: 'used_alone',
      contextId: 'game-a',
    });
    expect(pattern.status).toBe(200);
    expect((await pattern.json()).dashboard.patterns['produto:equilibrio'].state).toBe('used_alone');

    await post('/api/learner/events/review-completed', { gameId: 'dominorio' });
    const mission = await post('/api/learner/missions/claim', { missionId: 'daily-review-1' });
    const duplicate = await post('/api/learner/missions/claim', { missionId: 'daily-review-1' });
    expect((await mission.json()).sessionXpDelta).toBe(8);
    expect((await duplicate.json()).sessionXpDelta).toBe(0);
  });
});
