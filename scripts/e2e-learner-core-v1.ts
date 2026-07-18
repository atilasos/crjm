import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PORT = 3200 + (process.pid % 1000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = `/tmp/crjm-e2e-learner-core-${process.pid}.sqlite`;
const LEGACY_PROFILE_KEY = 'crjm.gamification.v1';
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

async function launchBrowser(): Promise<Browser> {
  const configuredChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
  if (configuredChannel) {
    return chromium.launch({ headless: true, channel: configuredChannel });
  }
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
      console.warn('[e2e:learner-core] Chromium Playwright ausente; a usar channel=chrome.');
      return chromium.launch({ headless: true, channel: 'chrome' });
    }
    throw error;
  }
}

const legacyProfile = {
  totalXp: 42,
  sessionXp: 0,
  streakDays: 3,
  lastActiveDate: '2026-04-06',
  achievements: {},
  gameProgress: {
    'gatos-caes': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    dominorio: { played: 2, wins: 1, reviews: 1, rules: 1, strategy: 1, mastery: 1 },
    quelhas: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    produto: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    'atari-go': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    nex: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
  },
  recentEvents: [
    { type: 'game_completed', gameId: 'dominorio', at: '2026-04-06T10:00:00.000Z', won: true },
    { type: 'review_completed', gameId: 'dominorio', at: '2026-04-06T10:10:00.000Z' },
  ],
};

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }

  throw new Error('learner-core test server did not become ready');
}

async function expectText(page: import('playwright').Page, text: string): Promise<void> {
  try {
    await page.waitForFunction(
      (expected) => document.querySelector('main')?.innerText.includes(expected) ?? false,
      text,
      { timeout: 30000 },
    );
  } catch (error) {
    const mainText = await page.locator('main').innerText().catch(() => '<main> indisponível');
    console.error(`Texto E2E em falta: ${JSON.stringify(text)}\n--- <main> ---\n${mainText}`);
    throw error;
  }
}

async function main() {
  await rm(DB_PATH, { force: true });

  const server: ChildProcessWithoutNullStreams = spawn('bun', ['src/index.ts'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      CRJM_LEARNER_DB_PATH: DB_PATH,
      CRJM_SESSION_SECRET: 'e2e-learner-core-secret',
    },
    stdio: 'pipe',
  });

  let shutdown = false;
  const stopServer = async () => {
    if (shutdown) return;
    shutdown = true;
    server.kill('SIGTERM');
    await rm(DB_PATH, { force: true });
  };

  server.on('exit', (code) => {
    if (!shutdown && code !== 0) {
      console.error(`learner-core e2e server exited early with code ${code}`);
    }
  });

  try {
    await waitForServer();

    const browser = await launchBrowser();
    const context = await browser.newContext({ locale: 'pt-PT', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    await page.addInitScript(
      (values: string[]) => {
        const [key, value] = values;
        if (!key || value === undefined) return;
        window.localStorage.setItem(key, value);
      },
      [LEGACY_PROFILE_KEY, JSON.stringify(legacyProfile)],
    );

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /ver perfil e progresso/i }).click();

    await expectText(page, '42 XP total');
    await expectText(page, '4/29');
    await expectText(page, '2 partidas');
    await expectText(page, '1 revisões');
    await expectText(page, 'Atividade Recente');
    await expectText(page, 'Partida jogada');
    await expectText(page, 'Revisão concluída');
    await expectText(page, '0/25');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /ver perfil e progresso/i }).click();
    await expectText(page, '42 XP total');
    await expectText(page, '4/29');

    const commandResult = await page.evaluate(async () => {
      const gameResponse = await fetch('/api/learner/events/game-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'dominorio', won: true }),
        credentials: 'include',
      });

      const reviewResponse = await fetch('/api/learner/events/review-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'dominorio' }),
        credentials: 'include',
      });

      return {
        game: await gameResponse.json(),
        review: await reviewResponse.json(),
      };
    });

    if (commandResult.game.dashboard.profile.totalXp !== 60) {
      throw new Error(`expected totalXp 60 after game command, got ${commandResult.game.dashboard.profile.totalXp}`);
    }
    if (commandResult.review.dashboard.profile.totalXp !== 70) {
      throw new Error(`expected totalXp 70 after review command, got ${commandResult.review.dashboard.profile.totalXp}`);
    }

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /ver perfil e progresso/i }).click();
    await expectText(page, '70 XP total');
    await expectText(page, '3 partidas');
    await expectText(page, '2 revisões');
    await expectText(page, '4/29');
    await expectText(page, 'Atividade Recente');

    const localValue = await page.evaluate((key) => window.localStorage.getItem(key), LEGACY_PROFILE_KEY);
    if (localValue !== null) {
      throw new Error('expected legacy local profile to be cleared after successful import');
    }

    await browser.close();
    console.log('Learner-core V1 e2e flow passed');
  } finally {
    await stopServer();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
