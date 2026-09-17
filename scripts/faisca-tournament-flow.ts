import type { Browser, Page } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { catalogs, type MessageKey } from '../src/i18n/catalogs';

/** Teacher, two real pupil clients and a read-only spectator, using the existing classroom servers. */
export async function checkFaiscaTournament(browser: Browser, app: string, server: string, adminKey: string): Promise<void> {
  await mkdir('artifacts/faisca-tournament', { recursive: true });
  for (const width of [1440, 1024, 390]) {
    const admin = await browser.newContext({ viewport: { width, height: 900 }, httpCredentials: { username: 'admin', password: adminKey } });
    const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width, height: 900 } })));
    const teacher = await admin.newPage();
    const observer = await admin.newPage();
    const pupils = await Promise.all(contexts.map(context => context.newPage()));
    const errors: string[] = [];
    for (const page of [teacher, observer, ...pupils]) page.on('pageerror', error => errors.push(error.message));
    teacher.on('dialog', dialog => { void dialog.accept().catch(error => {
      if (!String(error).includes('No dialog is showing')) errors.push(String(error));
    }); });
    const setServer = async (page: Page) => {
      await page.goto(`${app}/#/campeonato`);
      await page.locator('#tournament-game').selectOption('faisca');
      await page.locator('select').filter({ has: page.locator('option[value="custom"]') }).selectOption('custom');
      await page.getByPlaceholder('wss://torneio.exemplo.com ou ws://192.168.1.100:4000').fill(server);
    };
    try {
      await teacher.goto(`${server}/admin`);
      await teacher.getByRole('button', { name: '➕ Criar', exact: true }).click();
      const modal = teacher.locator('#createTournamentModal');
      await modal.locator('#gameSelect').selectOption('faisca');
      await modal.locator('#playerList').fill('Ana\nBeto');
      const created = teacher.waitForResponse(response => response.url().endsWith('/faisca/create-with-players'));
      await modal.getByRole('button', { name: 'Criar Torneio', exact: true }).click();
      const payload = await (await created).json();
      for (const [index, page] of pupils.entries()) {
        await setServer(page);
        await page.getByPlaceholder('ABC234').fill(payload.players[index].reconnectionCode);
        await page.getByRole('button', { name: 'Reconectar', exact: true }).click();
        await page.getByRole('button', { name: '❌ Sair do Campeonato', exact: true }).waitFor();
      }
      const card = teacher.locator('#tournaments .tournament-card').filter({ hasText: 'Faísca' });
      await card.getByRole('button', { name: /Iniciar/ }).waitFor();
      // Start through the existing public administration API.
      const start = await teacher.request.post(`${server}/api/tournaments/faisca/start`);
      if (!start.ok()) throw new Error('Teacher could not start Faísca tournament');
      for (const page of pupils) await page.getByRole('button', { name: '✅ Estou pronto!', exact: true }).click();
      for (const page of pupils) await page.locator('.faisca-board').waitFor();
      await observer.goto(`${server}/admin/spectator?gameId=faisca`);
      await observer.locator('.faisca-board').waitFor();
      const blue = await pupils[0]!.locator('.faisca').getByText('Jogar como: Azul', { exact: true }).count() ? pupils[0]! : pupils[1]!;
      let red = blue === pupils[0] ? pupils[1]! : pupils[0]!;
      for (const locale of ['pt-PT', 'en', 'ne'] as const) {
        const t = (key: MessageKey) => catalogs[locale][key];
        for (const page of [blue, red, observer]) await page.locator('[data-language-selector]').selectOption(locale);
        for (const theme of ['escuro', 'claro']) {
          for (const page of [blue, red, observer]) {
            await page.getByRole('button', { name: t(theme === 'escuro' ? 'Ativar modo noite' : 'Ativar modo dia'), exact: true }).click();
            await page.getByRole('group', { name: t('Tabuleiro de Faísca'), exact: true }).waitFor();
            await page.getByRole('status').filter({ hasText: t('Vez de {0}').replace('{0}', t('Azul')) }).waitFor();
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            if (overflow) throw new Error(`Tournament overflow: ${width}/${locale}/${theme}`);
          }
          await observer.getByText(t('Modo espectador - apenas a observar'), { exact: true }).waitFor();
          if (await observer.locator('.faisca button:enabled').count()) throw new Error('Spectator can act');
          const controls = await blue.locator('.faisca-control').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
          if (controls.some(height => height < 44)) throw new Error('Small tournament controls');
        }
      }
      for (const page of [blue, red, observer]) await page.locator('[data-language-selector]').selectOption('pt-PT');
      await blue.getByRole('button', { name: /^f3:/ }).focus();
      await blue.keyboard.press('Enter');
      const moves = [[3,'Esquerda'],[2,'Baixo'],[3,'Direita'],[1,'Cima'],[3,'Esquerda'],[3,'Cima'],[3,'Direita'],[1,'Baixo'],[3,'Esquerda'],[2,'Esquerda'],[2,'Baixo'],[3,'Cima'],[1,'Direita'],[1,'Baixo'],[2,'Direita'],[3,'Baixo'],[1,'Direita'],[3,'Esquerda'],[1,'Cima'],[1,'Cima'],[1,'Esquerda'],[2,'Baixo']] as const;
      for (const [turn, [distance, direction]] of moves.entries()) {
        const page = turn % 2 === 0 ? blue : red;
        await page.getByRole('button', { name: `Distância ${distance}`, exact: true }).click();
        await page.getByRole('group', { name: 'Direção da peça', exact: true }).getByRole('button', { name: new RegExp(direction) }).click();
        await page.getByRole('button', { name: 'Confirmar jogada', exact: true }).click();
        await observer.waitForFunction(count => document.querySelectorAll('.faisca-cell[data-player]').length === count, turn + 1);
        if (turn === 0) {
          const before = await observer.locator('.faisca').innerText();
          const context = red.context();
          await red.close();
          red = await context.newPage();
          await setServer(red);
          const index = red.context() === contexts[0] ? 0 : 1;
          await red.getByPlaceholder('ABC234').fill(payload.players[index].reconnectionCode);
          await red.getByRole('button', { name: 'Reconectar', exact: true }).click();
          await red.getByText('Casa obrigatória: c3', { exact: true }).waitFor();
          if (!(await red.locator('.faisca').innerText()).includes('Vez de Vermelho')) throw new Error('Reconnect lost turn');
          if (!(await observer.locator('.faisca').innerText()).includes(before)) throw new Error('Disconnect changed board');
        }
      }
      await observer.getByRole('status').filter({ hasText: 'Venceu Vermelho!' }).waitFor();
      for (const page of [blue, red]) await page.getByRole('button', { name: '▶️ Próxima Partida', exact: true }).waitFor();
      await observer.screenshot({ path: `artifacts/faisca-tournament/spectator-${width}.png`, fullPage: true });
      for (const page of [blue, red]) await page.getByRole('button', { name: '▶️ Próxima Partida', exact: true }).click();
      await blue.getByText('Jogar como: Vermelho', { exact: true }).waitFor();
      await red.getByText('Jogar como: Azul', { exact: true }).waitFor();
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`Faísca tournament: ${width}px, PT/EN/NE, both themes, teacher/participants/spectator/reconnect/result/alternating roles passed`);
    } finally {
      await Promise.all([...contexts, admin].map(context => context.close()));
    }
  }
}
