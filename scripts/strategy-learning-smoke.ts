/** Run only against an isolated local app, using a browser owned by Agent Browser Hub. */
import { chromium, type Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { getStrategyChallenge, STRATEGY_GAMES } from '../src/server/learner-core/strategy-challenges';
import { translate } from '../src/i18n/translate';

const base = process.env.STRATEGY_TEST_URL ?? 'http://127.0.0.1:3410';
const cdp = process.env.HUB_CDP_URL;
if (!cdp) throw new Error('Start an Agent Browser Hub session and provide HUB_CDP_URL.');
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Use an isolated localhost app.');
const browser = await chromium.connectOverCDP(cdp);
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const artifactDir = 'artifacts/strategy-learning';
await mkdir(artifactDir, { recursive: true });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function noAnswerMarks(page: Page, gameId: string) {
  const marked = await page.locator('.game-container').evaluate(board => {
    const rings = board.querySelectorAll('[class*="ring-amber-400"], [class*="ring-rose-400"]');
    const strokes = Array.from(board.querySelectorAll('polygon')).filter(node => ['#f59e0b', '#f43f5e'].includes(node.getAttribute('stroke') ?? ''));
    return rings.length + strokes.length;
  });
  assert(marked === 0, `${gameId}: answer marks leaked before the example`);
  assert(await page.locator('[data-tutor-solution]').count() === 0, `${gameId}: premature solution`);
}

try {
  for (const gameId of STRATEGY_GAMES) {
    await page.goto(`${base}/#/${gameId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^N1,/ }).first().click();
    const panel = page.locator('[data-thinking-tutor]');
    await panel.waitFor();
    assert(await panel.getAttribute('data-hint-level') === '0', `${gameId}: not H0`);
    await noAnswerMarks(page, gameId);
    await panel.getByRole('button', { name: 'Pedir uma pista', exact: true }).click();
    assert(await panel.getAttribute('data-hint-level') === '1', `${gameId}: not H1`);
    await noAnswerMarks(page, gameId);
    await panel.getByRole('button', { name: 'Ajudar a comparar', exact: true }).click();
    await noAnswerMarks(page, gameId);
    await panel.getByRole('button', { name: 'Ver um exemplo de jogada', exact: true }).click();
    await panel.locator('[data-tutor-solution]').waitFor();
    await panel.getByText('Leitura visual', { exact: true }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: /Novo Jogo/i }).click();
    await page.waitForFunction(() => document.querySelector('[data-thinking-tutor]')?.getAttribute('data-hint-level') === '0');
    await noAnswerMarks(page, gameId);
    console.log(`${gameId}: H0/H1/H2 hide the answer; H3 reveals on request; restart resets.`);
  }

  // Real move also resets the tutor, independent of the restart control.
  await page.goto(`${base}/#/gatos-caes`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^N1,/ }).first().click();
  for (const name of ['Pedir uma pista', 'Ajudar a comparar', 'Ver um exemplo de jogada']) {
    await page.locator('[data-thinking-tutor]').getByRole('button', { name, exact: true }).click();
  }
  await page.locator('.game-container .grid button:not([disabled])').first().click();
  await page.waitForFunction(() => document.querySelector('[data-thinking-tutor]')?.getAttribute('data-hint-level') === '0');
  await noAnswerMarks(page, 'gatos-caes next turn');

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${base}/#/puzzles`, { waitUntil: 'networkidle' });
    for (const [index, gameId] of STRATEGY_GAMES.entries()) {
      await page.locator('nav[aria-label]').filter({ has: page.getByRole('button', { name: 'Nex', exact: false }) }).getByRole('button').nth(index).click();
      const lab = page.locator('[data-strategy-practice]');
      await lab.locator('input[type=radio]').first().waitFor();
      const dims = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
      assert(dims.content <= dims.width + 1, `${gameId}: horizontal overflow at ${viewport.width}`);
      const bounds = await lab.boundingBox(), article = await lab.locator('article').boundingBox();
      assert(bounds && article && article.x + article.width <= bounds.x + bounds.width, `${gameId}: exercise text clipped inside the card`);
      if (gameId === 'gatos-caes' && viewport.width === 1440) {
        const solution = getStrategyChallenge(gameId, 0);
        await lab.getByRole('button', { name: 'Pedir uma pista' }).click();
        await lab.getByText(solution.hint, { exact: true }).waitFor();
        await page.reload({ waitUntil: 'networkidle' });
        await lab.getByText(solution.hint, { exact: true }).waitFor();
        await lab.locator(`input[name^=answer][value="${solution.answer}"]`).check();
        await lab.locator(`input[name^=prediction][value="${solution.prediction}"]`).check();
        await lab.getByRole('button', { name: 'Conferir a minha previsão' }).click();
        await lab.getByText('Boa leitura com prática.').waitFor();
        assert((await lab.locator('[data-strategy-progress]').textContent())?.includes('0/3'), 'Help counted as independent');
      }
      if (gameId === 'nex') await lab.screenshot({ path: `${artifactDir}/nex-${viewport.width}.png` });
    }
    console.log(`Laboratory: six games at ${viewport.width}px, no page overflow.`);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/#/perfil`, { waitUntil: 'networkidle' });
  await page.getByText('O que já consigo fazer sem ajuda', { exact: true }).waitFor();
  assert(await page.getByText('Mestria', { exact: true }).count() === 0, 'Review counters still labelled mastery');
  await page.screenshot({ path: `${artifactDir}/profile.png`, fullPage: true });

  // Check generated copy, not just statically visible JSX strings.
  const missing = new Set<string>();
  for (const gameId of STRATEGY_GAMES) for (let v = 0; v < 24; v++) {
    const s = getStrategyChallenge(gameId, v), c = s.challenge;
    const texts = [c.skill, c.prompt, ...c.facts, c.question, c.prediction, ...c.options.map(x => x.label), ...c.predictions.map(x => x.label), c.diagram?.caption ?? '', s.hint, s.explanation];
    for (const text of texts) if (/[a-záàãçé]/i.test(text) && !/^\([\d, ]+\)$/.test(text)) {
      for (const locale of ['en', 'ne'] as const) if (translate(text, locale) === text) missing.add(`${locale}: ${text}`);
    }
  }
  assert(missing.size === 0, `Untranslated generated copy:\n${[...missing].join('\n')}`);
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  console.log('PASS: hint exposure, saved attempts, profile, responsive layouts and generated translations.');
} finally {
  await context.close();
  await browser.close();
}
