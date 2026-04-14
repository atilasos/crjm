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

  test('bootstraps a production session even without explicit CRJM_SESSION_SECRET', async () => {
    await withTempDb();
    delete process.env.CRJM_SESSION_SECRET;
    process.env.NODE_ENV = 'production';

    const server = {} as Parameters<typeof handleAppRequest>[1];

    const sessionResponse = await handleAppRequest(new Request('http://localhost/api/auth/session'), server);
    const cookie = sessionResponse.headers.get('set-cookie') ?? '';

    expect(sessionResponse.status).toBe(200);
    expect(cookie).toContain('crjm_session=');
    expect(cookie).toContain('Secure');

    const dashboardResponse = await handleAppRequest(
      new Request('http://localhost/api/learner/dashboard', { headers: { cookie } }),
      server,
    );
    const dashboard = await dashboardResponse.json();

    expect(dashboardResponse.status).toBe(200);
    expect(dashboard.profile.displayName).toBeTruthy();
  });
});
