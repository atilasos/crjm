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
  if (process.env.HUB_CDP_URL) return chromium.connectOverCDP(process.env.HUB_CDP_URL);
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
    'gatos-caes': { played: 4, wins: 2, reviews: 1, rules: 2, strategy: 1, mastery: 1 },
    dominorio: { played: 2, wins: 1, reviews: 1, rules: 1, strategy: 1, mastery: 1 },
    quelhas: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    produto: { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    'atari-go': { played: 0, wins: 0, reviews: 0, rules: 0, strategy: 0, mastery: 0 },
    nex: { played: 3, wins: 1, reviews: 1, rules: 2, strategy: 1, mastery: 1 },
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
    await expectText(page, '6/29');
    await expectText(page, '2 partidas');
    await expectText(page, '1 revisões');
    await expectText(page, 'Atividade Recente');
    await expectText(page, 'Partida jogada');
    await expectText(page, 'Revisão concluída');
    await expectText(page, '0/25');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /ver perfil e progresso/i }).click();
    await expectText(page, '42 XP total');
    await expectText(page, '6/29');

    const commandResult = await page.evaluate(async () => {
      const gameResponse = await fetch('/api/learner/events/game-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: 'dominorio', won: true, difficultyLevel: 2 }),
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
    const levelSnapshot = commandResult.game.dashboard.levelProgress?.dominorio?.[2];
    if (!levelSnapshot || levelSnapshot.wins !== 1 || levelSnapshot.played !== 1 || levelSnapshot.bestWinStreak !== 1) {
      throw new Error(`expected level progress N2 {played:1, wins:1}, got ${JSON.stringify(levelSnapshot)}`);
    }

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /ver perfil e progresso/i }).click();
    await expectText(page, '70 XP total');
    await expectText(page, '3 partidas');
    await expectText(page, '2 revisões');
    await expectText(page, '5/29');
    await expectText(page, 'Atividade Recente');

    const localValue = await page.evaluate((key) => window.localStorage.getItem(key), LEGACY_PROFILE_KEY);
    if (localValue !== null) {
      throw new Error('expected legacy local profile to be cleared after successful import');
    }

    const archivedProgress = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    for (const gameId of ['gatos-caes', 'nex'] as const) {
      if (JSON.stringify(archivedProgress.gameProgress[gameId]) !== JSON.stringify(legacyProfile.gameProgress[gameId])) {
        throw new Error(`O progresso legado de ${gameId} não foi preservado.`);
      }
    }
    await page.goto(`${BASE_URL}/?integracao=1#/faisca`, { waitUntil: 'networkidle' });
    const board = page.getByRole('group', { name: 'Tabuleiro de Faísca' });
    await board.getByRole('button', { name: /^f3:/ }).click();
    // Official twenty-piece example, followed by b3 → a3 → a1: Red wins.
    const moves = [
      [3, 'Esquerda'], [2, 'Baixo'], [3, 'Direita'], [1, 'Cima'], [3, 'Esquerda'],
      [3, 'Cima'], [3, 'Direita'], [1, 'Baixo'], [3, 'Esquerda'], [2, 'Esquerda'],
      [2, 'Baixo'], [3, 'Cima'], [1, 'Direita'], [1, 'Baixo'], [2, 'Direita'],
      [3, 'Baixo'], [1, 'Direita'], [3, 'Esquerda'], [1, 'Cima'], [1, 'Cima'],
      [1, 'Esquerda'], [2, 'Baixo'],
    ] as const;
    for (const [distance, direction] of moves) {
      await page.getByRole('button', { name: `Distância ${distance}`, exact: true }).click();
      await page.getByRole('group', { name: 'Direção da peça' }).getByRole('button', { name: new RegExp(direction) }).click();
      await page.getByRole('button', { name: 'Confirmar jogada', exact: true }).click();
    }
    await page.getByRole('status').filter({ hasText: 'Venceu Vermelho!' }).waitFor();
    if (!await page.getByRole('button', { name: 'Confirmar jogada', exact: true }).isDisabled()) throw new Error('Partida terminada ainda permite jogar.');
    await page.waitForFunction(async () => {
      const dashboard = await (await fetch('/api/learner/dashboard')).json();
      return dashboard.gameProgress.faisca.played === 1;
    });
    const afterFaisca = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (afterFaisca.profile.totalXp !== 80 || afterFaisca.gameProgress.faisca.wins !== 0) throw new Error('Resultado local de Faísca não respeita a prática existente.');
    for (const gameId of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex']) {
      if (JSON.stringify(afterFaisca.gameProgress[gameId]) !== JSON.stringify(archivedProgress.gameProgress[gameId])) throw new Error(`Faísca alterou ${gameId}.`);
    }
    await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Vez de Azul' }).waitFor();
    await page.goto(`${BASE_URL}/?integracao=1#/y`, { waitUntil: 'networkidle' });
    await page.getByLabel('O meu perfil corresponde a:').selectOption('jogador2');
    const yBoard = page.getByRole('group', { name: 'Intersecções de Y' });
    const placeY = (id: string) => yBoard.getByRole('button', { name: new RegExp(`^${id}:`) }).click();
    await placeY('A1');
    await page.getByRole('button', { name: 'Trocar de cores', exact: true }).click();
    const path = ['B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8', 'A9'];
    const replies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];
    for (let i = 0; i < path.length; i++) { await placeY(replies[i]!); await placeY(path[i]!); }
    await page.getByRole('status').filter({ hasText: 'Venceu Jogador 2 com Azul!' }).waitFor();
    await page.waitForFunction(async () => {
      const dashboard = await (await fetch('/api/learner/dashboard')).json();
      return dashboard.gameProgress.y.played === 1;
    });
    const afterY = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (afterY.profile.totalXp !== 98 || afterY.gameProgress.y.wins !== 1) throw new Error('Y não atribuiu a vitória ao participante do perfil após troca.');
    for (const gameId of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex', 'faisca']) {
      if (JSON.stringify(afterY.gameProgress[gameId]) !== JSON.stringify(afterFaisca.gameProgress[gameId])) throw new Error(`Y alterou ${gameId}.`);
    }
    const storageState = await context.storageState();
    await context.close();
    const resumed = await browser.newContext({ storageState });
    const resumedPage = await resumed.newPage();
    await resumedPage.goto(`${BASE_URL}/?integracao=1#/perfil`, { waitUntil: 'networkidle' });
    await expectText(resumedPage, 'Faísca');
    await expectText(resumedPage, '98 XP total');
    const yCard = resumedPage.getByText('Y', { exact: true }).locator('../..');
    await yCard.getByText('1 partidas · 0 revisões', { exact: true }).waitFor();
    await yCard.getByText('Vitórias: 1', { exact: true }).waitFor();
    const repeated = await resumedPage.evaluate(async legacy => {
      const response = await fetch('/api/learner/import-local-profile', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: legacy }),
      });
      return { status: response.status, body: await response.json() };
    }, legacyProfile);
    if (repeated.status !== 200) throw new Error(`Importação repetida: HTTP ${repeated.status}`);
    const resumedProfile = await resumedPage.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
    if (JSON.stringify(resumedProfile) !== JSON.stringify(afterY)) throw new Error('Nova sessão ou importação repetida alterou o perfil.');
    await resumed.close();
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
