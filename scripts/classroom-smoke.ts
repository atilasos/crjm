import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 4300 + (process.pid % 500);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = `/tmp/crjm-classroom-smoke-${process.pid}.sqlite`;
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKERS = [
  'gatos-caes/gatos-caes.worker.js',
  'dominorio/dominorio.worker.js',
  'quelhas/quelhas.worker.js',
  'produto/produto.worker.js',
  'atari-go/atari-go.worker.js',
  'nex/nex.worker.js',
];

async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('A app não ficou pronta em 15 segundos.');
}

async function expectOk(path: string): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}

async function main(): Promise<void> {
  await rm(DB_PATH, { force: true });
  const server: ChildProcessWithoutNullStreams = spawn('bun', ['src/index.ts'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      CRJM_LEARNER_DB_PATH: DB_PATH,
      CRJM_SESSION_SECRET: 'classroom-smoke-local-only-secret',
      NODE_ENV: 'production',
    },
    stdio: 'pipe',
  });

  try {
    await waitForHealth();
    const home = await expectOk('/');
    if (!(await home.text()).includes('root')) throw new Error('Homepage sem ponto de montagem React.');

    const dashboard = await expectOk('/api/learner/dashboard');
    const payload = await dashboard.json() as { profile?: { displayName?: string }; gameProgress?: unknown };
    if (!payload.profile || !payload.gameProgress) throw new Error('Dashboard anónimo incompleto.');
    if (!dashboard.headers.get('set-cookie')) throw new Error('Sessão anónima não criou cookie.');

    await expectOk('/runtime-config.js');
    for (const worker of WORKERS) await expectOk(`/ai/${worker}`);

    console.log(JSON.stringify({
      pass: true,
      baseUrl: BASE_URL,
      checks: {
        health: true,
        homepage: true,
        anonymousLearnerSession: true,
        runtimeConfig: true,
        workerAssets: WORKERS.length,
      },
    }, null, 2));
  } finally {
    server.kill('SIGTERM');
    await rm(DB_PATH, { force: true });
  }
}

void main().catch((error) => {
  console.error('[classroom-smoke]', error);
  process.exit(1);
});
