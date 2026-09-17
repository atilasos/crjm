import { chromium, type Browser, type Locator, type Page } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import pt from '../src/i18n/pt-PT.json' with { type: 'json' };
import en from '../src/i18n/en.json' with { type: 'json' };
import ne from '../src/i18n/ne.json' with { type: 'json' };

const PORT = 4800 + (process.pid % 500);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TOURNAMENT_PORT = PORT + 10000;
const TOURNAMENT_URL = `http://127.0.0.1:${TOURNAMENT_PORT}`;
const ADMIN_KEY = 'archive-smoke-local-only';
const DB_PATH = `/tmp/crjm-classroom-ui-${process.pid}.sqlite`;
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

async function checkGameSelection(page: Page): Promise<void> {
  const titles = ['Gatos & Cães', 'Dominório', 'Quelhas', 'Produto', 'Atari Go', 'Nex'];
  const assertTitles = async (locator: Locator, label: string, expectedTitles = titles) => {
    await locator.first().waitFor({ state: 'attached' });
    const actual = (await locator.allTextContents()).map(text => text.trim());
    if (JSON.stringify(actual) !== JSON.stringify(expectedTitles)) throw new Error(`${label}: ${JSON.stringify(actual)}`);
  };
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await assertTitles(page.locator('button.game-card h2'), 'Seleção pública');
  const cycles = await page.locator('button.game-card ul').allTextContents();
  const expected = ['1.º Ciclo', '1.º Ciclo2.º Ciclo', '1.º Ciclo2.º Ciclo3.º Ciclo', '2.º Ciclo3.º CicloSecundário', '3.º CicloSecundário', 'Secundário'];
  if (JSON.stringify(cycles) !== JSON.stringify(expected)) throw new Error('Ciclos da seleção pública alterados.');
  await page.goto(`${BASE_URL}/?integracao=1`, { waitUntil: 'networkidle' });
  await page.getByRole('status').filter({ hasText: 'Pré-visualização de integração' }).waitFor();
  await assertTitles(page.locator('button.game-card h2'), 'Seleção em pré-visualização', ['Dominório', 'Quelhas', 'Produto', 'Atari Go', 'Faísca', 'Y']);
  await page.goto(`${BASE_URL}/#/campeonato`, { waitUntil: 'networkidle' });
  await assertTitles(page.locator('main select').first().locator('option'), 'Jogos do campeonato');
  await page.goto(`${BASE_URL}/#/puzzles`, { waitUntil: 'networkidle' });
  for (const title of titles) {
    await page.locator('[data-puzzle-lab] nav button').filter({ hasText: title }).click();
    await page.locator('[data-percurso]').filter({ hasText: title }).waitFor();
    await page.locator('[data-puzzle-option]').first().waitFor();
  }
  await page.goto(`${BASE_URL}/#/perfil`, { waitUntil: 'networkidle' });
  for (const title of titles) await page.getByText(title, { exact: true }).first().waitFor();
}

async function checkFaiscaCancellation(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/?integracao=1#/faisca`, { waitUntil: 'networkidle' });
  // Delay the real worker's response at the transport boundary, so controls
  // must remain usable while a search belongs to an obsolete match.
  const workerUrl = '**/ai/faisca/faisca.worker.js';
  await page.route(workerUrl, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `const send = self.postMessage.bind(self); self.postMessage = data => setTimeout(() => send(data), 600);\n${await response.text()}` });
  });
  for (const action of ['restart', 'leave'] as const) {
    await page.getByRole('button', { name: '🤖 vs Computador', exact: true }).click();
    await page.getByLabel('Jogar como:', { exact: true }).selectOption('jogador2');
    await page.getByRole('status').filter({ hasText: 'Computador' }).waitFor();
    if (!await page.getByRole('button', { name: 'Confirmar jogada', exact: true }).isDisabled()) throw new Error('Human can play during AI turn');
    if (action === 'restart') {
      await page.getByRole('button', { name: 'Nova partida', exact: true }).click({ timeout: 500 });
      await page.getByRole('button', { name: 'Dois jogadores no mesmo dispositivo', exact: true }).click({ timeout: 500 });
    } else {
      await page.getByRole('button', { name: 'Voltar à página inicial', exact: true }).click({ timeout: 500 });
      await page.locator('button.game-card').filter({ has: page.getByRole('heading', { name: 'Faísca', exact: true }) }).click();
    }
    await page.waitForTimeout(800); // Beyond the deliberately delayed old response.
    if (await page.locator('.faisca-cell[data-player]').count()) throw new Error('Obsolete AI response changed a new match');
    await page.getByRole('status').filter({ hasText: 'Vez de Azul' }).waitFor();
  }
  await page.unroute(workerUrl);
  await page.route(workerUrl, route => route.abort());
  await page.getByRole('button', { name: '🤖 vs Computador', exact: true }).click();
  await page.getByLabel('Jogar como:', { exact: true }).selectOption('jogador2');
  await page.getByRole('alert').filter({ hasText: 'Não foi possível calcular a jogada.' }).waitFor();
  await page.unroute(workerUrl);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.faisca-cell[data-player]').length === 1);
}

async function checkFaisca(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/faisca`, { waitUntil: 'networkidle' });
  if (await page.locator('.faisca').count()) throw new Error('Faísca foi publicada fora da integração.');
  for (const locale of ['pt-PT', 'en', 'ne'] as const) {
    const catalog = { 'pt-PT': pt, en, ne }[locale];
    const t = (text: keyof typeof pt) => catalog[text];
    const formatMessage = (text: keyof typeof pt, _locale: string, values: (string | number)[]) =>
      t(text).replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));
    for (const theme of ['claro', 'escuro']) {
      await page.goto(`${BASE_URL}/?integracao=1`, { waitUntil: 'networkidle' });
      await page.locator('[data-language-selector]').selectOption(locale);
      await page.evaluate(value => localStorage.setItem('crjm-tema', value), theme);
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('button.game-card').filter({ has: page.getByRole('heading', { name: t('Faísca'), exact: true }) }).click();
      await page.getByText(t('Faísca joga-se num tabuleiro de cinco linhas e seis colunas. Azul começa.'), { exact: true }).waitFor();
      const board = page.getByRole('group', { name: t('Tabuleiro de Faísca') });
      if (await board.getByRole('button').count() !== 30) throw new Error('Faísca: tabuleiro deve ter 30 casas.');
      await board.getByRole('button', { name: /^f3:/ }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: formatMessage('Distância {0}', locale, [3]), exact: true }).click();
      await page.getByRole('button', { name: t('Confirmar jogada'), exact: true }).click();
      await page.getByRole('alert').filter({ hasText: t('Jogada inválida. Escolhe uma peça disponível e um destino vazio dentro do tabuleiro.') }).waitFor();
      await page.getByRole('status').filter({ hasText: formatMessage('Vez de {0}', locale, [t('Azul')]) }).waitFor();
      await page.getByRole('button', { name: t('Esquerda'), exact: false }).click();
      await page.getByRole('button', { name: t('Confirmar jogada'), exact: true }).click();
      await page.getByText(formatMessage('Casa obrigatória: {0}', locale, ['c3']), { exact: true }).waitFor();
      await page.getByRole('status').filter({ hasText: formatMessage('Vez de {0}', locale, [t('Vermelho')]) }).waitFor();
      await board.getByRole('button', { name: formatMessage('{0}: {1}, distância {2}, {3}', locale, ['f3', t('Azul'), 3, t('Esquerda')]), exact: true }).waitFor();
      if (await page.getByRole('button', { name: /^N[1-6],/ }).count()) throw new Error('Faísca expõe dificuldades não implementadas.');
      await page.getByRole('button', { name: t('🤖 vs Computador'), exact: true }).click();
      const levels = page.getByRole('group', { name: t('Desafio da IA'), exact: true }).getByRole('button');
      if (await levels.count() !== 2) throw new Error(`Faísca ${locale}: deve apresentar os dois níveis avaliados.`);
      await levels.nth(1).click();
      await page.getByLabel(t('Jogar como:'), { exact: true }).selectOption('jogador2');
      await page.waitForFunction(() => document.querySelectorAll('.faisca-cell[data-player="jogador1"]').length === 1);
      await page.getByRole('status').filter({ hasText: formatMessage('Vez de {0}', locale, [t('Vermelho')]) }).waitFor();
      await page.getByText(t('Níveis avaliados em Faísca; não equivalem aos de outros jogos.'), { exact: true }).waitFor();
      await assertViewport(page, `Faísca ${locale} ${theme}`, '.faisca-board');
      for (const label of ['Confirmar jogada', 'Nova partida'] as const) {
        const bounds = await page.getByRole('button', { name: t(label), exact: true }).boundingBox();
        if (!bounds || bounds.height < 44 || bounds.width < 44) throw new Error(`Faísca: controlo ${label} demasiado pequeno.`);
      }
      if (process.env.FAISCA_SCREENSHOT_PATH && locale === 'pt-PT' && theme === 'escuro' && page.viewportSize()?.width === 390) {
        await page.screenshot({ path: process.env.FAISCA_SCREENSHOT_PATH, fullPage: true });
      }
    }
  }
  await page.locator('[data-language-selector]').selectOption('pt-PT');
}

async function checkY(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/y`, { waitUntil: 'networkidle' });
  if (await page.locator('.y-game').count()) throw new Error('Y foi publicado fora da integração.');
  for (const locale of ['pt-PT', 'en', 'ne'] as const) {
    const catalog = { 'pt-PT': pt, en, ne }[locale];
    const t = (text: keyof typeof pt) => catalog[text];
    const msg = (text: keyof typeof pt, values: string[]) => t(text).replace(/\{(\d+)\}/g, (_, i) => values[Number(i)]!);
    for (const theme of ['claro', 'escuro']) {
      await page.goto(`${BASE_URL}/?integracao=1`, { waitUntil: 'networkidle' });
      await page.locator('[data-language-selector]').selectOption(locale);
      await page.evaluate(value => localStorage.setItem('crjm-tema', value), theme);
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator('button.game-card').filter({ has: page.getByRole('heading', { name: 'Y', exact: true }) }).click();
      await page.getByText(t('Cada canto pertence aos dois lados adjacentes. Ligar um canto ao lado oposto pode vencer; grupos separados não se somam.'), { exact: true }).waitFor();
      const board = page.getByRole('group', { name: t('Intersecções de Y') });
      if (await board.getByRole('button').count() !== 93) throw new Error('Y: esperadas 93 intersecções.');
      await board.getByRole('button', { name: /^A1:/ }).focus();
      await page.keyboard.press('Enter');
      const profile = page.getByLabel(t('O meu perfil corresponde a:'));
      if (await profile.isEnabled()) throw new Error('Y: identidade alterável a meio da partida.');
      await page.getByRole('button', { name: t('Trocar de cores'), exact: true }).click();
      await page.getByRole('status').filter({ hasText: msg('Vez de {0} — {1}', [t('Jogador 1'), t('Vermelho')]) }).waitFor();
      const first = board.getByRole('button', { name: new RegExp(`^A1: ${t('Azul')};`) });
      if (await first.isEnabled()) throw new Error('Y: peça inicial desapareceu após troca.');
      if (await page.getByRole('button', { name: t('Trocar de cores'), exact: true }).count()) throw new Error('Y: troca oferecida duas vezes.');
      await board.getByRole('button', { name: /^M1:/ }).click();
      await page.getByRole('status').filter({ hasText: msg('Vez de {0} — {1}', [t('Jogador 2'), t('Azul')]) }).waitFor();
      if (await page.getByRole('button', { name: /^N[1-6],/ }).count()) throw new Error('Y: expõe IA não implementada.');
      await assertViewport(page, `Y ${locale} ${theme}`, '.y-board-viewport');
      const bounds = await first.boundingBox();
      if (!bounds || bounds.width < 44 || bounds.height < 44) throw new Error('Y: alvo tátil inferior a 44px.');
      if (process.env.Y_SCREENSHOT_PATH && locale === 'pt-PT' && theme === 'escuro' && page.viewportSize()?.width === 390) {
        await page.screenshot({ path: process.env.Y_SCREENSHOT_PATH, fullPage: true });
      }
    }
  }
  await page.locator('[data-language-selector]').selectOption('pt-PT');
  let played = 0;
  let wins = 0;
  for (const participant of ['jogador1', 'jogador2']) {
    for (const swap of [false, true]) {
      await page.goto(`${BASE_URL}/?integracao=1#/y`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
      await page.getByLabel('O meu perfil corresponde a:').selectOption(participant);
      const board = page.getByRole('group', { name: 'Intersecções de Y' });
      const place = (id: string) => board.getByRole('button', { name: new RegExp(`^${id}:`) }).click();
      await place('A1');
      if (swap) await page.getByRole('button', { name: 'Trocar de cores', exact: true }).click();
      const path = ['B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8', 'A9'];
      const replies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];
      for (let i = 0; i < path.length; i++) { await place(replies[i]!); await place(path[i]!); }
      await page.getByRole('status').filter({ hasText: `Venceu Jogador ${swap ? 2 : 1} com Azul!` }).waitFor();
      if (await board.locator('button:not(:disabled)').count()) throw new Error('Y: permite continuar após vitória.');
      played++;
      if (participant === (swap ? 'jogador2' : 'jogador1')) wins++;
      await page.getByRole('link', { name: /ver perfil e progresso/i }).click();
      const card = page.getByText('Y', { exact: true }).locator('../..');
      await card.getByText(`${played} partidas · 0 revisões`, { exact: true }).waitFor();
      await card.getByText(`Vitórias: ${wins}`, { exact: true }).waitFor();
      // Reload forces a fresh bootstrap of the persisted profile.
      await page.reload({ waitUntil: 'networkidle' });
      await card.getByText(`${played} partidas · 0 revisões`, { exact: true }).waitFor();
      await card.getByText(`Vitórias: ${wins}`, { exact: true }).waitFor();
    }
  }
}

async function checkArchive(page: Page): Promise<void> {
  for (const [locale, archive, back, current] of [
    ['pt-PT', 'Arquivo', 'Voltar ao Arquivo', 'Seleção atual'],
    ['en', 'Archive', 'Back to Archive', 'Current selection'],
    ['ne', 'अभिलेख', 'अभिलेखमा फर्कनुहोस्', 'हालको छनोट'],
  ]) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.locator('[data-language-selector]').selectOption(locale!);
    await page.getByRole('button', { name: archive, exact: true }).click();
    await page.waitForURL('**/#/arquivo');
    const titles = await page.locator('button.game-card h2').allTextContents();
    if (titles.length !== 2 || !titles.includes('Nex')) throw new Error('Arquivo: esperados dois jogos.');
    for (const theme of ['claro', 'escuro']) {
      await page.evaluate(value => {
        localStorage.setItem('crjm-tema', value);
      }, theme);
      await page.reload({ waitUntil: 'networkidle' });
      await assertViewport(page, `Arquivo ${locale} ${theme}`, 'main');
      for (const slug of ['gatos-caes', 'nex']) {
        // Old bookmarks retain their exact route and return to the archive.
        await page.goto(`${BASE_URL}/#/${slug}`, { waitUntil: 'networkidle' });
        await page.getByText(archive!, { exact: true }).waitFor();
        await assertViewport(page, `${slug} ${locale} ${theme}`);
        await page.getByRole('button', { name: back, exact: true }).click();
        await page.waitForURL('**/#/arquivo');
        if (await page.locator('button.game-card').count() !== 2) throw new Error('Regresso fora do Arquivo.');
      }
    }
    await page.goto(`${BASE_URL}/#/puzzles`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: archive, exact: true }).click();
    await page.waitForURL('**/#/puzzles/arquivo');
    const games = page.locator('[data-puzzle-lab] nav button');
    if (await games.count() !== 2) throw new Error('Laboratório: seleção do Arquivo incorreta.');
    for (let i = 0; i < 2; i++) {
      await games.nth(i).click();
      await page.locator('[data-percurso]').waitFor();
      await page.locator('[data-puzzle-option]').first().waitFor();
    }
    await assertViewport(page, `Laboratório Arquivo ${locale}`, '[data-puzzle-lab]');
    await page.reload({ waitUntil: 'networkidle' });
    if (await games.count() !== 2) throw new Error('Recarregar perdeu o contexto de Arquivo.');
    await page.getByRole('button', { name: back, exact: true }).click();
    await page.waitForURL('**/#/arquivo');
    await page.getByRole('button', { name: current, exact: true }).click();
    await page.goBack();
    await page.waitForURL('**/#/arquivo');
    await page.goto(`${BASE_URL}/#/campeonato`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: archive, exact: true }).click();
    const options = page.locator('#tournament-game option');
    if (await options.count() !== 2) throw new Error('Torneios: seleção do Arquivo incorreta.');
    await page.locator('#tournament-game').selectOption('nex');
    await page.getByRole('button', { name: current, exact: true }).click();
    if (await options.count() !== 6) throw new Error('Seleção pública foi ativada prematuramente.');
    await assertViewport(page, `Torneios Arquivo ${locale}`, 'main');
  }
  await page.locator('[data-language-selector]').selectOption('pt-PT');
  await page.goto(`${BASE_URL}/?integracao=1#/campeonato`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Arquivo', exact: true }).click();
  await page.locator('#tournament-game').selectOption('nex');
  await page.getByPlaceholder('Ex: João Silva').fill('Aluno Arquivo');
  await page.getByRole('button', { name: 'Modo de ligação', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar Treino', exact: false }).click();
  await page.getByRole('button', { name: '❌ Sair do Campeonato', exact: true }).click();
  if (await page.getByRole('button', { name: 'Arquivo', exact: true }).getAttribute('aria-pressed') !== 'true'
      || await page.locator('#tournament-game').inputValue() !== 'nex') {
    throw new Error('Sair do torneio perdeu a seleção Arquivo/Nex.');
  }
}

async function checkArchiveAdministration(browser: Browser): Promise<void> {
  const context = await browser.newContext({ httpCredentials: { username: 'admin', password: ADMIN_KEY } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => {
    void dialog.accept().catch(error => {
      if (!String(error).includes('No dialog is showing')) errors.push(String(error));
    });
  });
  try {
    for (const gameId of ['gatos-caes', 'nex']) {
      await page.goto(`${TOURNAMENT_URL}/admin?integracao=1`);
      await page.getByRole('button', { name: '➕ Criar', exact: true }).click();
      const modal = page.locator('#createTournamentModal');
      await modal.getByRole('button', { name: 'Arquivo', exact: true }).click();
      const options = await modal.locator('#gameSelect option').evaluateAll(elements => elements.map(element => (element as HTMLOptionElement).value));
      if (JSON.stringify(options) !== JSON.stringify(['gatos-caes', 'nex'])) throw new Error('Administração: Arquivo incorreto.');
      await modal.locator('#gameSelect').selectOption(gameId);
      await modal.locator('#playerList').fill('Aluno A;4A\nAluno B;4A');
      const created = page.waitForResponse(response => response.url().endsWith(`/api/tournaments/${gameId}/create-with-players`) && response.request().method() === 'POST');
      await modal.getByRole('button', { name: 'Criar Torneio', exact: true }).click();
      const payload = await (await created).json();
      if (!payload.success || payload.gameId !== gameId || payload.players.length !== 2) throw new Error('Criação do torneio do Arquivo falhou.');
      await page.locator('#tournaments .tournament-name').filter({ hasText: gameId === 'nex' ? 'Nex' : 'Gatos & Cães' }).waitFor();

      // Rejoin through the same public protocol used by pupils with entry codes.
      const sockets: WebSocket[] = [];
      let started = 0;
      let matchId = '';
      try {
        await Promise.all(payload.players.map((player: { reconnectionCode: string }) => new Promise<void>((resolve, reject) => {
          const socket = new WebSocket(`${TOURNAMENT_URL.replace('http:', 'ws:')}/ws`);
          sockets.push(socket);
          const timeout = setTimeout(() => reject(new Error('Aluno não conseguiu entrar no torneio.')), 10_000);
          socket.onopen = () => socket.send(JSON.stringify({ type: 'rejoin_tournament', reconnectionCode: player.reconnectionCode }));
          socket.onmessage = event => {
            const message = JSON.parse(String(event.data));
            if (message.type === 'welcome') { clearTimeout(timeout); resolve(); }
            if (message.type === 'match_assigned') {
              socket.send(JSON.stringify({ type: 'ready_for_match', matchId: message.match.id }));
            }
            if (message.type === 'game_start') { started += 1; matchId = message.matchId; }
          };
        })));
        const response = await page.request.post(`${TOURNAMENT_URL}/api/tournaments/${gameId}/start`);
        if (!response.ok()) throw new Error('Torneio do Arquivo não arrancou.');
        for (let attempt = 0; attempt < 50 && started < 2; attempt++) await delay(100);
        if (started < 2) throw new Error('Os dois alunos não receberam o tabuleiro inicial.');
        await page.goto(`${TOURNAMENT_URL}/admin/spectator?gameId=${gameId}&matchId=${matchId}`);
        await page.getByRole('heading', { name: /Aluno [AB] vs Aluno [AB]/ }).waitFor();
        await page.locator(gameId === 'nex' ? 'svg polygon' : '.grid button').first().waitFor();
      } finally {
        for (const socket of sockets) socket.close();
      }
    }
    for (const [locale, archive] of [['en', 'Archive'], ['ne', 'अभिलेख']]) {
      await page.goto(`${TOURNAMENT_URL}/admin?integracao=1&lang=${locale}`);
      await page.getByRole('button', { name: archive, exact: true }).first().click();
      await page.locator('#tournaments .tournament-name').filter({ hasText: 'Nex' }).waitFor();
    }
    if (errors.length) throw new Error(`Administração/espectador: ${errors.join('; ')}`);
  } finally {
    await context.close();
  }
}

async function runGame(page: Page, title: string, play: (page: Page) => Promise<void>): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.locator('button.game-card').filter({ hasText: title }).click();
  await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
  await chooseN1(page);
  await assertViewport(page, title);
  await play(page);
  await page.getByRole('button', { name: ['Gatos & Cães', 'Nex'].includes(title) ? 'Voltar ao Arquivo' : 'Voltar à página inicial' }).click();
  await page.getByRole('heading', { name: 'Treino para o CRJM' }).waitFor();
}

async function runPuzzleLaboratory(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Resolver exercícios' }).click();
  await page.getByRole('heading', { name: 'Laboratório de Estratégias', exact: true }).first().waitFor();
  await page.locator('[data-puzzle-option="centro"]').click();
  await page.getByRole('button', { name: 'Confirmar resposta' }).click();
  await page.getByText(/Boa leitura|Já dominaste esta ideia/, { exact: false }).waitFor();
  await page.getByText('1/7 resolvidos', { exact: false }).waitFor({ timeout: 10_000 });
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

  const tournamentServer = spawn('bun', ['src/server/tournament-server.ts'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(TOURNAMENT_PORT), ADMIN_KEY, CLASS_STORE_PATH: `/tmp/crjm-archive-classes-${process.pid}.json` },
    stdio: 'ignore',
  });
  try {
    await waitForServer();
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await fetch(`${TOURNAMENT_URL}/health`)).ok) break; } catch {}
      if (attempt === 59) throw new Error('Servidor de torneios indisponível.');
      await delay(250);
    }
    const browser = await launchBrowser();
    const checks: Array<{ viewport: string; game: string }> = [];

    try {
      await checkArchiveAdministration(browser);
      checks.push({ viewport: 'desktop', game: 'Arquivo: criação/administração, participantes e espectador reais' });
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

        await checkArchive(page);
        checks.push({ viewport: viewport.name, game: 'Arquivo: navegação, Laboratório e torneios × PT/EN/NE × claro/escuro' });
        await checkGameSelection(page);
        checks.push({ viewport: viewport.name, game: 'Seleção, ciclos, perfil e pré-visualização' });
        await checkFaisca(page);
        await checkFaiscaCancellation(page);
        checks.push({ viewport: viewport.name, game: 'Faísca: regras, abertura, recusa inválida e teclado × PT/EN/NE × claro/escuro' });
        await checkY(page);
        checks.push({ viewport: viewport.name, game: 'Y: regras, troca, teclado e 4 partidas com perfil persistido × PT/EN/NE × claro/escuro' });
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
    tournamentServer.kill('SIGTERM');
    await rm(`/tmp/crjm-archive-classes-${process.pid}.json`, { force: true });
    await rm(DB_PATH, { force: true });
  }
}

void main().catch((error) => {
  console.error('[classroom-ui-smoke]', error);
  process.exit(1);
});
