/** Run with node (native TS support), using an Agent Browser Hub session's CDP URL. */
import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const cdp = process.env.HUB_CDP_URL;
if (!cdp) throw new Error('Set HUB_CDP_URL to the CDP URL of your Agent Browser Hub session.');
const directory = await mkdtemp(join(tmpdir(), 'crjm-i18n-'));
const port = 5200 + process.pid % 300;
const tournamentPort = port + 400;
const base = `http://127.0.0.1:${port}`;
const tournament = `http://127.0.0.1:${tournamentPort}`;
const classFile = join(directory, 'classes.json');
const code = 'ABC234';
await writeFile(classFile, JSON.stringify({ classes: [{ id: 'test-class', name: '4.º A', createdAt: new Date().toISOString(), students: [{ id: 'test-pupil', name: 'Mestre', code }] }] }));
const app = spawn('bun', ['src/index.ts'], { env: { ...process.env, PORT: String(port), CRJM_LEARNER_DB_PATH: join(directory, 'learner.sqlite'), NODE_ENV: 'production' }, stdio: 'ignore' });
const server = spawn('bun', ['src/server/tournament-server.ts'], { env: { ...process.env, PORT: String(tournamentPort), CLASS_STORE_PATH: classFile, ADMIN_KEY: 'local-i18n-test-only' }, stdio: 'ignore' });
const browser = await chromium.connectOverCDP(cdp);
const reports: string[] = [];
const errors: string[] = [];
async function ready(url: string) {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Test server did not start: ${url}`);
}
async function language(page: Page, locale: 'pt-PT' | 'en' | 'ne') {
  await page.locator('[data-language-selector]').selectOption(locale);
  await page.waitForFunction(expected => document.documentElement.lang === expected, locale);
}
async function noOverflow(page: Page) {
  const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(size.page <= size.viewport + 1, `Horizontal overflow: ${JSON.stringify(size)}`);
}
async function boardState(page: Page) {
  return page.locator('.game-container').evaluate(element => ({
    disabled: Array.from(element.querySelectorAll('button')).map(button => button.disabled),
    circles: Array.from(element.querySelectorAll('circle')).map(circle => [circle.getAttribute('cx'), circle.getAttribute('cy'), circle.getAttribute('fill')]),
    polygons: Array.from(element.querySelectorAll('polygon')).map(polygon => polygon.getAttribute('fill')),
    pieces: Array.from(element.querySelectorAll('.grid button')).map(button => button.innerHTML),
  }));
}
async function play(page: Page, game: string) {
  const squares = page.locator('.game-container .grid button');
  if (game === 'gatos-caes' || game === 'atari-go') await page.locator('.game-container .grid button:not([disabled])').first().click();
  if (game === 'dominorio') await squares.first().click();
  if (game === 'quelhas') { await squares.nth(0).click(); await squares.nth(10).click(); }
  if (game === 'produto') await page.locator('.game-container svg g').first().click();
  if (game === 'nex') {
    await page.getByRole('button', { name: 'Placement', exact: true }).click();
    const cells = page.locator('.game-container svg g > polygon:first-child');
    await cells.nth(0).click();
    await page.getByRole('button', { name: 'Neutral', exact: true }).click();
    await cells.nth(1).click();
  }
}
async function login(page: Page) {
  await page.goto(`${base}/#/entrar`);
  const form = page.locator('form');
  await form.locator('input').nth(0).fill(tournament.replace('http:', 'ws:'));
  await form.locator('input').nth(1).fill(code);
  await form.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('heading', { name: /Mestre/ }).waitFor();
}
try {
  await ready(`${base}/api/health`); await ready(`${tournament}/health`);
  for (const width of [1440, 1024, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-GB' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    assert.equal(await page.locator('html').getAttribute('lang'), 'pt-PT');
    await language(page, 'en');
    await page.getByRole('heading', { name: 'CRJM practice' }).waitFor();
    await noOverflow(page);
    await page.reload();
    await page.getByRole('heading', { name: 'CRJM practice' }).waitFor();
    for (const game of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex']) {
      await page.goto(`${base}/#/${game}`);
      await page.getByRole('button', { name: /vs Computer/ }).click();
      await page.getByRole('button', { name: /2 players/ }).waitFor();
      await play(page, game);
      const before = await boardState(page);
      await language(page, 'ne');
      assert.deepEqual(await boardState(page), before, `${game}: switching to NE changed the board`);
      assert.ok((await page.locator('.rules-panel').innerText()).includes('नियम:'), `${game}: Nepali rules missing`);
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.fonts.check('16px "Noto Sans Devanagari"', 'नेपाली')));
      await noOverflow(page);
      await mkdir('artifacts/i18n', { recursive: true });
      await writeFile(`artifacts/i18n/${game}-ne-${width}.txt`, await page.locator('body').innerText());
      if (width === 390 && game === 'produto') await page.screenshot({ path: 'artifacts/i18n/produto-ne-mobile.png', fullPage: true });
      await language(page, 'pt-PT');
      assert.deepEqual(await boardState(page), before, `${game}: switching to PT changed the board`);
      await language(page, 'en');
      assert.deepEqual(await boardState(page), before, `${game}: switching to EN changed the board`);
      await noOverflow(page);
      const rules = await page.locator('.rules-panel').innerText();
      assert.ok(rules.includes('Rules for'), `${game}: English rules missing`);
      if(game === 'quelhas') assert.ok(rules.includes('last move loses'));
      if(game === 'atari-go') assert.ok(rules.includes('capture WINS'));
      await mkdir('artifacts/i18n', { recursive: true });
      await writeFile(`artifacts/i18n/${game}-${width}.txt`, await page.locator('body').innerText());
      reports.push(`${width}px ${game}: state preserved in PT/EN/NE; English and Nepali rules visible`);
    }
    // Keep a puzzle answer selected and a hint visible across both language changes.
    await page.goto(`${base}/#/puzzles`);
    await page.locator('[data-puzzle-option="centro"]').click();
    await page.getByRole('button', { name: 'Ask for a hint' }).click();
    await language(page, 'pt-PT');
    await page.getByRole('button', { name: 'Confirmar resposta' }).click();
    await page.getByText(/Boa leitura|Já dominaste esta ideia/).first().waitFor();
    await language(page, 'en');
    await page.getByText(/Well read|You have mastered this idea/).first().waitFor();
    await page.getByText('The first piece cannot start near the edge.', { exact: true }).waitFor();
    await noOverflow(page);
    if(width === 390) {
      await mkdir('artifacts/i18n', { recursive: true });
      await page.screenshot({ path: 'artifacts/i18n/lab-en-mobile.png', fullPage: true });
    }
    await language(page, 'ne');
    await page.getByText('पहिलो गोटी किनारामा राख्न मिल्दैन।', { exact: true }).waitFor();
    await page.getByText(/राम्रोसँग बुझ्यौ|यो विचारमा दक्षता हासिल गरिसक्यौ/).first().waitFor();
    await noOverflow(page);
    if (width === 390) await page.screenshot({ path: 'artifacts/i18n/lab-ne-mobile.png', fullPage: true });
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('lang'), 'ne');
    await language(page, 'en');
    // A real tutor response, already displayed, changes language without a new move.
    await page.goto(`${base}/#/gatos-caes`);
    await page.getByRole('button', { name: /^L1,/ }).click();
    await page.getByText('Prefer a safe centre square that keeps several legal options for the next cycle.', { exact: false }).waitFor();
    const tutorBoard = await boardState(page);
    await language(page, 'pt-PT');
    await page.getByText('Privilegia uma casa central segura que te mantenha várias saídas legais para o ciclo seguinte.', { exact: false }).waitFor();
    await language(page, 'en');
    await page.getByText('Prefer a safe centre square that keeps several legal options for the next cycle.', { exact: false }).waitFor();
    await language(page, 'ne');
    await page.getByText('अर्को पालोका लागि धेरै मान्य विकल्प जोगाउने बीचको सुरक्षित कोठा रोज।', { exact: false }).waitFor();
    assert.deepEqual(await boardState(page), tutorBoard);
    await noOverflow(page);
    reports.push(`${width}px puzzles: answer, hint and feedback preserved`);
    await context.close();
  }
  // Real account API: the login code authorizes only the pupil's language setting.
  const invalid = await fetch(`${tournament}/api/student/locale`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, locale: 'fr' }) });
  assert.equal(invalid.status, 400);
  const anonymous = await browser.newContext();
  const first = await anonymous.newPage();
  await login(first);
  const saved = first.waitForResponse(response => response.url().endsWith('/api/student/locale') && response.ok());
  await language(first, 'en'); await saved;
  assert.ok((await first.getByRole('heading', { name: /signed in as/ }).innerText()).includes('Mestre'));
  await first.route('**/api/student/locale', route => route.abort());
  await language(first, 'pt-PT');
  await first.getByRole('status').filter({ hasText: 'Não foi possível atualizar o perfil.' }).waitFor();
  await first.unroute('**/api/student/locale');
  const retry = first.waitForResponse(response => response.url().endsWith('/api/student/locale') && response.ok());
  await first.getByRole('button', { name: 'Tentar novamente' }).click();
  await retry;
  const saveEnglish = first.waitForResponse(response => response.url().endsWith('/api/student/locale') && response.ok());
  await language(first, 'ne'); await saveEnglish;
  reports.push('Offline profile save leaves the selected language usable; explicit retry succeeds');
  await anonymous.close();
  const secondDevice = await browser.newContext({ locale: 'en-GB' });
  const second = await secondDevice.newPage();
  await login(second);
  await second.getByRole('heading', { name: /प्रवेश गरेको नाम:.*Mestre/ }).waitFor();
  assert.equal(await second.locator('html').getAttribute('lang'), 'ne');
  await language(second, 'en');
  // A live WebSocket stays open and earlier server messages are retranslated.
  let connections = 0;
  let disconnections = 0;
  second.on('websocket', socket => {
    if (!socket.url().includes(String(tournamentPort))) return;
    connections += 1;
    socket.on('close', () => { disconnections += 1; });
  });
  await second.goto(`${base}/#/campeonato`);
  await second.getByRole('button', { name: /Enter the championship/ }).click();
  await second.getByText('Welcome to the', { exact: false }).waitFor();
  const codeBefore = await second.locator('.font-mono').allTextContents();
  await language(second, 'pt-PT');
  await second.getByText('Bem-vindo ao campeonato de', { exact: false }).waitFor();
  await language(second, 'en');
  await second.getByText('Welcome to the', { exact: false }).waitFor();
  await language(second, 'ne');
  await second.getByText('प्रतियोगितामा स्वागत छ!', { exact: false }).waitFor();
  await language(second, 'en');
  assert.equal(connections, 1);
  assert.equal(disconnections, 0);
  assert.deepEqual(await second.locator('.font-mono').allTextContents(), codeBefore);
  reports.push('Live championship WebSocket and reconnection code preserved; existing messages retranslated');
  await second.getByRole('button', { name: /Leave championship/ }).click();
  await second.goto(`${base}/#/entrar`);
  await second.getByRole('button', { name: 'Sign out', exact: true }).click();
  await second.getByRole('button', { name: 'Entrar', exact: true }).waitFor();
  assert.equal(await second.locator('html').getAttribute('lang'), 'pt-PT');
  await secondDevice.close();
  reports.push('Pupil language recovered on a second device; name unchanged; sign-out restores guest default');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, checks: reports }, null, 2));
} finally {
  await browser.close();
  app.kill(); server.kill();
  await rm(directory, { recursive: true, force: true });
}
