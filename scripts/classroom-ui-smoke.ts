import { chromium, type Browser, type Locator, type Page } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const PORT = 4800 + (process.pid % 500);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = `/tmp/crjm-classroom-ui-${process.pid}.sqlite`;
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
      console.warn('[classroom-ui-smoke] Chromium Playwright ausente; a usar channel=chrome.');
      return chromium.launch({ headless: true, channel: 'chrome' });
    }
    throw error;
  }
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const GAMES = [
  { title: 'Gatos & Cães', play: playGatosCaes },
  { title: 'Dominório', play: playDominorio },
  { title: 'Quelhas', play: playQuelhas },
  { title: 'Produto', play: playProduto },
  { title: 'Atari Go', play: playAtariGo },
  { title: 'Nex', play: playNex },
] as const;

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('A app não ficou pronta em 15 segundos.');
}

async function chooseN1(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /^N1,/ }).first();
  await button.waitFor({ state: 'visible' });
  await button.click();
  if ((await button.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('O seletor de dificuldade não confirmou N1.');
  }
}

async function expectCountAtLeast(locator: Locator, minimum: number, label: string): Promise<void> {
  await locator.first().waitFor({ state: 'attached', timeout: 5_000 });
  const count = await locator.count();
  if (count < minimum) throw new Error(`${label}: esperado >= ${minimum}, obtido ${count}.`);
}

async function playGatosCaes(page: Page): Promise<void> {
  const cells = page.locator('.game-container .grid button');
  await page.locator('.game-container .grid button:not([disabled])').first().click();
  await expectCountAtLeast(cells.locator('span'), 1, 'Gatos & Cães não mostrou a peça');
}

async function playDominorio(page: Page): Promise<void> {
  const cells = page.locator('.game-container .grid button');
  await cells.first().click();
  await expectCountAtLeast(cells.locator(':scope > div'), 2, 'Dominório não ocupou duas casas');
}

async function playQuelhas(page: Page): Promise<void> {
  const cells = page.locator('.game-container .grid button');
  await cells.nth(0).click();
  await cells.nth(10).click();
  await page.waitForFunction(() =>
    document.querySelectorAll('.game-container .grid button:disabled').length >= 2,
  );
}

async function playProduto(page: Page): Promise<void> {
  const cells = page.locator('.game-container svg g');
  await cells.first().click();
  await expectCountAtLeast(page.locator('.game-container svg circle'), 1, 'Produto não mostrou a primeira peça');
}

async function playAtariGo(page: Page): Promise<void> {
  const cells = page.locator('.game-container .grid button');
  await page.locator('.game-container .grid button:not([disabled])').first().click();
  await expectCountAtLeast(cells.locator('.z-20'), 1, 'Atari Go não mostrou a pedra');
}

async function playNex(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Colocação', exact: true }).click();
  const cells = page.locator('.game-container svg g > polygon:first-child');
  await cells.first().click();
  await page.getByRole('button', { name: 'Neutra', exact: true }).click();
  await cells.nth(1).click();
  await page.waitForFunction(() => {
    const occupied = [...document.querySelectorAll<SVGPolygonElement>('.game-container svg g > polygon:first-child')]
      .filter((polygon) => polygon.getAttribute('fill') !== '#fef3c7');
    return occupied.length >= 2;
  });
}

async function assertViewport(page: Page, game: string, selector = '.game-container'): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  if (dimensions.page > dimensions.viewport + 1) {
    throw new Error(`${game}: overflow horizontal ${dimensions.page}px > ${dimensions.viewport}px.`);
  }

  const board = await page.locator(selector).first().boundingBox();
  if (!board || board.width < 250) throw new Error(`${game}: tabuleiro ausente ou demasiado estreito.`);
  if (board.x < -1 || board.x + board.width > dimensions.viewport + 1) {
    throw new Error(`${game}: tabuleiro fora do viewport.`);
  }
}

async function runGame(page: Page, title: string, play: (page: Page) => Promise<void>): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.locator('button.game-card').filter({ hasText: title }).click();
  await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
  await chooseN1(page);
  await assertViewport(page, title);
  await play(page);
  await page.getByRole('button', { name: 'Voltar à página inicial' }).click();
  await page.getByRole('heading', { name: 'Treino para o CRJM' }).waitFor();
}

async function runPuzzleLaboratory(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Resolver puzzles' }).click();
  await page.getByRole('heading', { name: 'Laboratório de Estratégias', exact: true }).first().waitFor();
  await page.locator('[data-puzzle-option="centro"]').click();
  await page.getByRole('button', { name: 'Confirmar resposta' }).click();
  await page.getByText(/Boa leitura|Já dominaste esta ideia/, { exact: false }).waitFor();
  await page.getByText('1/6 resolvidos', { exact: false }).waitFor({ timeout: 10_000 });
  await page.locator('[data-percurso]').waitFor({ state: 'visible' });
  await page.getByText('Percurso para o campeonato', { exact: false }).first().waitFor();
  await assertViewport(page, 'Laboratório de Estratégias', '[data-puzzle-lab]');
  await page.getByRole('button', { name: 'Voltar à página inicial' }).click();
  await page.getByRole('heading', { name: 'Treino para o CRJM' }).waitFor();
}

async function main(): Promise<void> {
  await rm(DB_PATH, { force: true });
  const server: ChildProcessWithoutNullStreams = spawn('bun', ['src/index.ts'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      CRJM_LEARNER_DB_PATH: DB_PATH,
      CRJM_SESSION_SECRET: 'classroom-ui-local-only-secret',
      NODE_ENV: 'production',
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer();
    const browser = await launchBrowser();
    const checks: Array<{ viewport: string; game: string }> = [];

    try {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          locale: 'pt-PT',
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });

        for (const game of GAMES) {
          await runGame(page, game.title, game.play);
          checks.push({ viewport: viewport.name, game: game.title });
        }
        await runPuzzleLaboratory(page);
        checks.push({ viewport: viewport.name, game: 'Laboratório de Estratégias' });
        if (errors.length > 0) throw new Error(`${viewport.name}: erros no browser:\n${errors.join('\n')}`);
        await context.close();
      }
    } finally {
      await browser.close();
    }

    console.log(JSON.stringify({ pass: true, baseUrl: BASE_URL, checks }, null, 2));
  } finally {
    server.kill('SIGTERM');
    await rm(DB_PATH, { force: true });
  }
}

void main().catch((error) => {
  console.error('[classroom-ui-smoke]', error);
  process.exit(1);
});
