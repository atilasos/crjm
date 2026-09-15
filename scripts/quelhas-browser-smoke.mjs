// Real application and workers, in a browser owned by Agent Browser Hub.
// HUB_CDP_URL=http://127.0.0.1:9330 node scripts/quelhas-browser-smoke.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.QUELHAS_TEST_URL ?? 'http://127.0.0.1:3410';
if (!process.env.HUB_CDP_URL) throw new Error('Start Agent Browser Hub and set HUB_CDP_URL.');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use an isolated local app.');
const browser = await chromium.connectOverCDP(process.env.HUB_CDP_URL);
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const failures = [], reports = [], serverSides = [];
const levels = process.env.QUELHAS_LEVELS?.split(',').map(Number) ?? [1, 2, 3, 4, 5, 6];
if (!levels.every(level => Number.isInteger(level) && level >= 1 && level <= 6)) throw new Error('Invalid levels');
await context.addInitScript(() => {
  const NativeWorker = window.Worker;
  window.__quelhasWorkers = [];
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options);
      this.record = { url: String(url), requests: [], replies: [], terminated: false };
      if (String(url).includes('quelhas.worker')) window.__quelhasWorkers.push(this.record);
      this.addEventListener('message', event => {
        if (event.data.type === 'result') this.record.replies.push(event.data);
      });
    }
    postMessage(request, options) { this.record.requests.push(request); super.postMessage(request, options); }
    terminate() { this.record.terminated = true; super.terminate(); }
  };
});
await context.route('**/api/ai/quelhas/**', async route => {
  if (route.request().url().endsWith('/move')) serverSides.push(route.request().postDataJSON().toPlay);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ move: -1 }) });
});
const page = await context.newPage();
page.on('pageerror', e => failures.push(e.message));
page.on('console', msg => { if (msg.type() === 'error' && /\[QuelhasGame\]/.test(msg.text())) failures.push(msg.text()); });
async function noLeak() {
  assert.equal(await page.locator('[data-tutor-solution]').count(), 0);
  assert.equal(await page.locator('.game-container [class*="ring-amber-400"], .game-container [class*="ring-rose-400"]').count(), 0);
}
try {
  for (const level of levels) {
    await page.goto(`${base}/?quelhas-smoke=${level}#/quelhas`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: new RegExp(`^N${level},`) }).click();
    await page.getByRole('button', { name: /Horizontal.*2.º/ }).click();
    await page.getByRole('button', { name: 'Manter como está', exact: true }).waitFor({ timeout: 12000 });
    const trace = await page.evaluate(() => window.__quelhasWorkers);
    assert(trace.length >= 2, 'Opponent and tutor must have their own workers');
    const opponent = trace[0];
    assert(opponent.replies.length > 0, `N${level}: no real opponent result`);
    const result = opponent.replies.at(-1);
    assert(['rust-wasm', 'ts-fallback', 'exact-endgame'].includes(result.engine));
    assert(result.bestMove && result.bestMove.orientacao === 'vertical');
    assert(result.elapsedMs <= [100, 250, 500, 1000, 2000, 2000][level - 1] + 100, `N${level}: budget`);
    reports.push({ level, engine: result.engine, depth: result.depthReached, elapsedMs: result.elapsedMs, move: result.bestMove });
    if (level === 6) {
      await page.getByRole('button', { name: 'Trocar papéis', exact: true }).click();
      await page.waitForFunction(previous => window.__quelhasWorkers[0].replies.length > previous, opponent.replies.length, { timeout: 12000 });
      const swapped = await page.evaluate(() => window.__quelhasWorkers[0].replies.at(-1));
      assert.equal(swapped.bestMove.orientacao, 'horizontal');
      assert.deepEqual(serverSides.slice(-2), [1, 2], 'Server must receive orientations after swap');
    } else {
      await page.getByRole('button', { name: 'Manter como está', exact: true }).click();
    }
    if (level === 5) {
      const panel = page.locator('[data-thinking-tutor]');
      await panel.waitFor();
      await noLeak();
      await panel.getByRole('button', { name: 'Pedir uma pista', exact: true }).click();
      await noLeak();
      await panel.getByRole('button', { name: 'Ajudar a comparar', exact: true }).click();
      await noLeak();
      await panel.getByRole('button', { name: 'Ver um exemplo de jogada', exact: true }).click();
      await panel.getByText(/^Após esta jogada: tu,/).waitFor({ timeout: 12000 });
      assert.equal(await panel.getByText('Alternativa/apoio', { exact: true }).count(), 0);
      await page.setViewportSize({ width: 390, height: 844 });
      const dims = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
      if (dims.content > dims.width + 1) console.log(JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({ tag: e.tagName, cls: e.className, text: e.textContent?.slice(0,100), right:e.getBoundingClientRect().right })).slice(-15)), null, 2));
      await mkdir('artifacts/quelhas-tempo', { recursive: true });
      await page.screenshot({ path: 'artifacts/quelhas-tempo/tutor-mobile.png', fullPage: true });
      assert(dims.content <= dims.width + 1, 'Mobile overflow');
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    console.log(`N${level}: ${result.engine}, ${result.elapsedMs.toFixed(0)} ms, length ${result.bestMove.comprimento}`);
  }
  assert.deepEqual(failures, []);
  await writeFile(process.env.QUELHAS_BROWSER_OUT ?? 'artifacts/quelhas-tempo/browser.json', JSON.stringify({ reports, serverSides, failures, hints: levels.includes(5) ? 'H0/H1/H2 hidden, H3 counts on request' : 'not run', mobile: levels.includes(5) ? '390px without overflow' : 'not run' }, null, 2) + '\n');
  console.log(`PASS: levels ${levels.join(', ')}; details in artifacts/quelhas-tempo/browser.json`);
} finally { await context.close(); await browser.close(); }
