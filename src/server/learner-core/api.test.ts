import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { handleAppRequest } from './http';

const cleanup: string[] = [];

async function withTempDb() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'crjm-learner-http-'));
  cleanup.push(dir);
  process.env.CRJM_LEARNER_DB_PATH = path.join(dir, 'learner.sqlite');
}

afterEach(async () => {
  delete process.env.CRJM_LEARNER_DB_PATH;
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
});
