import type { Browser, Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { catalogs, type MessageKey } from '../src/i18n/catalogs';

/** Exercise Y through the same teacher and pupil entrypoints as classroom smoke. */
export async function checkYTournament(browser: Browser, app: string, server: string, adminKey: string): Promise<void> {
  await mkdir('artifacts/y-tournament', { recursive: true });
  for (const width of [1440, 1024, 390]) {
    const admin = await browser.newContext({ viewport: { width, height: 900 }, httpCredentials: { username: 'admin', password: adminKey } });
    const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width, height: 900 } })));
    const teacher = await admin.newPage();
    const observer = await admin.newPage();
    const pupils = await Promise.all(contexts.map(context => context.newPage()));
    const errors: string[] = [];
    const monitor = (page: Page) => page.on('pageerror', error => errors.push(error.message));
    for (const page of [teacher, observer, ...pupils]) monitor(page);
    teacher.on('dialog', dialog => { void dialog.accept().catch(error => {
      if (!String(error).includes('No dialog is showing')) errors.push(String(error));
    }); });
    try {
      await teacher.goto(`${server}/admin`);
      await teacher.getByRole('button', { name: '➕ Criar', exact: true }).click();
      const modal = teacher.locator('#createTournamentModal');
      await modal.locator('#gameSelect').selectOption('y');
      await modal.locator('#playerList').fill('Ana\nBeto');
      const created = teacher.waitForResponse(response => response.url().endsWith('/y/create-with-players'));
      await modal.getByRole('button', { name: 'Criar Torneio', exact: true }).click();
      const payload: unknown = await (await created).json();
      if (!payload || typeof payload !== 'object' || !('players' in payload) || !Array.isArray(payload.players)) throw new Error('Missing tournament participants');
      const players = payload.players.map((player: unknown) => {
        if (!player || typeof player !== 'object' || !('name' in player) || typeof player.name !== 'string'
          || !('reconnectionCode' in player) || typeof player.reconnectionCode !== 'string') throw new Error('Invalid tournament participant');
        return { name: player.name, reconnectionCode: player.reconnectionCode };
      });
      const participant = (index: number) => {
        const player = players[index];
        if (!player) throw new Error('Missing tournament participant');
        return player;
      };
      const connect = async (page: Page, index: number) => {
        await page.goto(`${app}/#/campeonato`);
        await page.locator('#tournament-game').selectOption('y');
        await page.locator('select').filter({ has: page.locator('option[value="custom"]') }).selectOption('custom');
        await page.getByPlaceholder('wss://torneio.exemplo.com ou ws://192.168.1.100:4000').fill(server);
        await page.getByPlaceholder('ABC234').fill(participant(index).reconnectionCode);
        await page.getByRole('button', { name: 'Reconectar', exact: true }).click();
        await page.getByRole('button', { name: '❌ Sair do Campeonato', exact: true }).waitFor();
      };
      for (const [index, page] of pupils.entries()) await connect(page, index);
      const start = await teacher.request.post(`${server}/api/tournaments/y/start`);
      if (!start.ok()) throw new Error('Teacher could not start Y tournament');
      for (const page of pupils) await page.getByRole('button', { name: '✅ Estou pronto!', exact: true }).click();
      for (const page of pupils) await page.locator('.y-board').waitFor();
      await observer.goto(`${server}/admin/spectator?gameId=y`);
      await observer.locator('.y-board').waitFor();
      const firstIndex = await pupils[0]!.getByRole('button', { name: /^A1:/ }).isEnabled() ? 0 : 1;
      const secondIndex = 1 - firstIndex;
      let first = pupils[firstIndex]!;
      let second = pupils[secondIndex]!;
      const firstName: string = participant(firstIndex).name;
      const secondName: string = participant(secondIndex).name;
      // A fresh context prevents a saved spectator language from hiding a broken handoff.
      for (const locale of ['en', 'ne', 'pt-PT'] as const) {
        const localizedAdmin = await browser.newContext({ viewport: { width, height: 900 },
          httpCredentials: { username: 'admin', password: adminKey } });
        try {
          const panel = await localizedAdmin.newPage();
          monitor(panel);
          await panel.goto(`${server}/admin?lang=${locale}`);
          await panel.locator('.active-game-item').filter({ hasText: firstName }).click();
          const spectator = panel.frameLocator('#game-viewer-iframe');
          const t = (key: MessageKey) => catalogs[locale][key];
          await spectator.getByRole('status').filter({
            hasText: t('Vez de {0} — {1}').replace('{0}', firstName).replace('{1}', t('Azul')),
          }).waitFor({ timeout: 5_000 });
          if (await spectator.locator('[data-language-selector]').inputValue() !== locale) {
            throw new Error(`Spectator did not inherit the admin language: ${locale}`);
          }
        } finally { await localizedAdmin.close(); }
      }
      const swapButton = (page: Page) => page.getByRole('button', { name: 'Trocar de cores', exact: true });
      if (await swapButton(first).count()) throw new Error('Swap offered before opening');
      await first.getByRole('button', { name: /^A1:/ }).focus();
      await first.keyboard.press('Enter');
      await swapButton(second).waitFor();
      if (await swapButton(first).isEnabled()) throw new Error('First participant can swap');
      const reconnect = async (page: Page, index: number) => {
        const before = await observer.locator('.y-tournament').innerText();
        const context = page.context();
        await page.close();
        const replacement = await context.newPage();
        monitor(replacement);
        await connect(replacement, index);
        await replacement.locator('.y-board').waitFor();
        if (await observer.locator('.y-tournament').innerText() !== before) throw new Error('Reconnect changed observed board');
        return replacement;
      };
      second = await reconnect(second, secondIndex);
      if (!await swapButton(second).isEnabled()) throw new Error('Reconnect lost swap opportunity');
      await swapButton(second).focus();
      await second.keyboard.press('Enter');
      await observer.getByText(`${secondName}: ● Azul`, { exact: true }).waitFor();
      first = await reconnect(first, firstIndex);
      for (const page of [first, second, observer]) {
        await page.getByText(`${firstName}: ◆ Vermelho`, { exact: true }).waitFor();
        await page.getByText(`${secondName}: ● Azul`, { exact: true }).waitFor();
        if (await swapButton(page).count()) throw new Error('Swap offered twice');
        if (await page.locator('.y-node[data-color="azul"]').count() !== 1) throw new Error('Swap moved the opening piece');
      }
      if (!await first.getByRole('button', { name: /^M1:/ }).isEnabled()
        || await second.getByRole('button', { name: /^M1:/ }).isEnabled()) throw new Error('Incorrect turn after swap');
      // The first participant to reconnect still sees the board while the other is offline.
      await first.close();
      await second.close();
      first = await contexts[firstIndex]!.newPage();
      monitor(first);
      await connect(first, firstIndex);
      await first.locator('.y-board').waitFor();
      await first.getByText(`${secondName}: ● Azul`, { exact: true }).waitFor();
      if (await first.locator('.y-node:enabled').count()) throw new Error('Paused Y board accepts moves');
      second = await contexts[secondIndex]!.newPage();
      monitor(second);
      await connect(second, secondIndex);
      await second.locator('.y-board').waitFor();
      await first.getByRole('button', { name: /^M1:/ }).waitFor({ state: 'visible' });
      for (const locale of ['pt-PT', 'en', 'ne'] as const) {
        const t = (key: MessageKey) => catalogs[locale][key];
        for (const page of [first, second, observer]) await page.locator('[data-language-selector]').selectOption(locale);
        for (const theme of ['escuro', 'claro']) {
          for (const page of [first, second, observer]) {
            await page.getByRole('button', { name: t(theme === 'escuro' ? 'Ativar modo noite' : 'Ativar modo dia'), exact: true }).click();
            await page.getByRole('region', { name: t('Tabuleiro de Y'), exact: true }).waitFor();
            await page.getByRole('status').filter({ hasText: t('Vez de {0} — {1}').replace('{0}', firstName).replace('{1}', t('Vermelho')) }).waitFor();
            await page.getByText(t('Após a troca, a peça inicial fica no lugar e pertence ao segundo jogador. O primeiro jogador continua com a outra cor.'), { exact: true }).waitFor();
            if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`Y overflow: ${width}/${locale}/${theme}`);
          }
          if (await observer.locator('.y-tournament button').count()) throw new Error('Spectator has game controls');
          const sizes = await first.locator('.y-node').evaluateAll(elements => elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
          if (sizes.some(size => size.width < 44 || size.height < 44)) throw new Error('Y touch targets are too small');
          await observer.getByText(t('Modo espectador - apenas a observar'), { exact: true }).waitFor();
        }
      }
      for (const page of [first, second, observer]) await page.locator('[data-language-selector]').selectOption('pt-PT');
      const path = ['B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8', 'A9'];
      const replies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];
      for (const [index, node] of path.entries()) {
        await first.getByRole('button', { name: new RegExp(`^${replies[index]}:`) }).click();
        await second.getByRole('button', { name: new RegExp(`^${node}:`) }).click();
        await observer.waitForFunction(count => document.querySelectorAll('.y-node[data-color="azul"]').length === count, index + 2);
      }
      await observer.getByRole('status').filter({ hasText: `Venceu ${secondName} com Azul!` }).waitFor();
      await first.getByText('Perdeste esta partida...', { exact: true }).waitFor();
      await second.getByText('Ganhaste esta partida!', { exact: true }).waitFor();
      await observer.screenshot({ path: `artifacts/y-tournament/spectator-${width}.png`, fullPage: true });
      for (const page of [first, second]) await page.getByRole('button', { name: '▶️ Próxima Partida', exact: true }).click();
      await first.getByText('Jogar como: ◆ Vermelho', { exact: true }).waitFor();
      await second.getByText('Jogar como: ● Azul', { exact: true }).waitFor();
      if (!await second.getByRole('button', { name: /^A1:/ }).isEnabled()) throw new Error('Next game did not alternate starting participant');
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`Y tournament: ${width}px, PT/EN/NE, both themes, teacher/participants/spectator/swap/reconnect/result/alternating roles passed`);
    } catch (error) {
      await observer.screenshot({ path: `/tmp/issue37-failure-${width}.png`, fullPage: true }).catch(() => {});
      throw error;
    } finally {
      await Promise.all([...contexts, admin].map(context => context.close()));
    }
  }
}


/** Two live modalities must remain selectable without interpreting one board as the other. */
export async function checkMixedTournamentSpectator(browser: Browser, server: string, adminKey: string): Promise<void> {
  const context = await browser.newContext({ httpCredentials: { username: 'admin', password: adminKey } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${server}/admin/spectator?gameId=y`);
    await page.locator('.y-board').waitFor();
    const games = page.locator('button').filter({ hasText: ' vs ' });
    await games.nth(1).waitFor();
    if (await games.count() !== 2) throw new Error('Spectator lost a live tournament');
    for (const index of [1, 0, 1, 0]) {
      await games.nth(index).click();
      await page.locator(index === 0 ? '.y-board' : '.faisca-board').waitFor();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Spectator: Y/Faísca coexistence and repeated selection passed');
  } finally { await context.close(); }
}
