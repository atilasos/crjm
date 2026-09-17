import type { Page } from 'playwright';
import { criarEstadoInicial, colocarPeca } from '../src/games/faisca/logic';
import { computeFaisca, type FaiscaLevel } from '../src/games/faisca/ai/engine';
import type { Direcao, Distancia, Jogada } from '../src/games/faisca/types';
import type { Player } from '../src/types';

export async function playFaiscaLocalExample(page: Page, t: (text: string) => string = text => text): Promise<void> {
  await page.getByRole('button', { name: t('Dois jogadores no mesmo dispositivo'), exact: true }).click();
  await page.getByRole('group', { name: t('Tabuleiro de Faísca') }).getByRole('button', { name: /^f3:/ }).click();
  // Official twenty-piece example, followed by b3 → a3 → a1: Red wins.
  const moves = [
    [3, 'Esquerda'], [2, 'Baixo'], [3, 'Direita'], [1, 'Cima'], [3, 'Esquerda'],
    [3, 'Cima'], [3, 'Direita'], [1, 'Baixo'], [3, 'Esquerda'], [2, 'Esquerda'],
    [2, 'Baixo'], [3, 'Cima'], [1, 'Direita'], [1, 'Baixo'], [2, 'Direita'],
    [3, 'Baixo'], [1, 'Direita'], [3, 'Esquerda'], [1, 'Cima'], [1, 'Cima'],
    [1, 'Esquerda'], [2, 'Baixo'],
  ] as const;
  for (const [distance, direction] of moves) {
    await page.getByRole('button', { name: t('Distância {0}').replace('{0}', String(distance)), exact: true }).click();
    await page.getByRole('group', { name: t('Direção da peça') }).getByRole('button', { name: new RegExp(t(direction)) }).click();
    await page.getByRole('button', { name: t('Confirmar jogada'), exact: true }).click();
  }
}

/** The tutor reveals moves only after three explicit requests. */
export async function checkFaiscaTutor(page: Page, t: (text: string) => string = text => text): Promise<void> {
  const tutor = page.locator('[data-thinking-tutor]');
  await tutor.waitFor({ timeout: 5000 });
  for (const [level, label] of ['Pedir uma pista', 'Ajudar a comparar', 'Ver um exemplo de jogada'].entries()) {
    if (await tutor.getAttribute('data-hint-level') !== String(level)) throw new Error('Unexpected tutor stage');
    if (await page.locator('[data-tutor-solution]').count()) throw new Error('Premature tutor solution');
    // Current mandatory square is public context; move coordinates belong only to the example.
    if (/[a-f][1-5]/.test(await tutor.innerText())) throw new Error('Tutor leaked a move before the example');
    await tutor.getByRole('button', { name: t(label), exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('[data-thinking-tutor]')?.getAttribute('data-hint-level') === String(expected), level + 1);
  }
  await page.locator('[data-tutor-solution]').getByText(t('Pista do computador: este exemplo não garante vitória.'), { exact: true }).waitFor();
  if (!/[a-f][1-5]/.test(await page.locator('[data-tutor-solution]').innerText())) throw new Error('Example has no move');
}

export async function checkFaiscaHintCancellation(page: Page): Promise<void> {
  const hintUrl = '**/api/learner/events/pattern-progress';
  const workerUrl = '**/ai/faisca/faisca.worker.js';
  const changeTurn = async () => {
    await page.getByRole('group', { name: 'Tabuleiro de Faísca' }).getByRole('button', { name: /^f3:/ }).click();
    await page.getByRole('button', { name: 'Distância 3', exact: true }).click();
    await page.getByRole('button', { name: 'Esquerda', exact: false }).click();
    await page.getByRole('button', { name: 'Confirmar jogada', exact: true }).click();
  };
  for (const action of ['turn', 'restart'] as const) {
    await page.getByRole('button', { name: 'Dois jogadores no mesmo dispositivo', exact: true }).click();
    let release!: () => void;
    let received!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const requested = new Promise<void>(resolve => { received = resolve; });
    await page.route(hintUrl, async route => {
      const response = await route.fetch();
      received();
      await blocked;
      await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Pedir uma pista', exact: true }).click();
    await requested;
    if (await page.locator('[data-thinking-tutor]').getAttribute('data-hint-level') !== '0') throw new Error('Hint revealed before durable acknowledgement');
    if (action === 'turn') await changeTurn();
    else await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
    const completed = page.waitForResponse(hintUrl);
    release();
    await completed;
    await page.getByText('A guardar a ajuda…', { exact: true }).waitFor({ state: 'hidden' });
    await page.waitForTimeout(100);
    await page.unroute(hintUrl);
    if (await page.locator('[data-thinking-tutor]').getAttribute('data-hint-level') !== '0') throw new Error('Delayed hint crossed a turn/restart');
  }
  await page.route(workerUrl, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `const send = self.postMessage.bind(self); self.postMessage = data => setTimeout(() => send(data), 600);\n${await response.text()}` });
  });
  for (const action of ['turn', 'restart'] as const) {
    await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
    for (const label of ['Pedir uma pista', 'Ajudar a comparar', 'Ver um exemplo de jogada']) {
      await page.getByRole('button', { name: label, exact: true }).click();
    }
    await page.locator('[data-tutor-solution]').waitFor();
    if (action === 'turn') await changeTurn();
    else await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
    await page.waitForTimeout(800);
    if (await page.locator('[data-tutor-solution]').count()) throw new Error('Delayed example crossed a turn/restart');
  }
  await page.unroute(workerUrl);
}

/** Observe the real board and play only through accessible controls. */
export async function playFaiscaAgainstComputer(page: Page, human: Player, level: FaiscaLevel): Promise<boolean> {
  await page.getByRole('button', { name: '🤖 vs Computador', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^N${level},`) }).click();
  await page.getByLabel('Jogar como:', { exact: true }).selectOption(human);
  let state = criarEstadoInicial();
  const names: Record<Direcao, string> = { cima: 'Cima', direita: 'Direita', baixo: 'Baixo', esquerda: 'Esquerda' };
  for (let turn = 0; turn < 30; turn++) {
    await page.waitForFunction(() => {
      const game = document.querySelector('.faisca');
      return game?.querySelector('[role="alert"]') || !game?.querySelector('[role="status"]')?.textContent?.includes('Computador');
    });
    if (await page.locator('.faisca [role="alert"]').count()) throw new Error('Faísca AI failed in the browser');
    const labels = await page.locator('.faisca-cell[data-player]').evaluateAll(cells => cells.map(cell => cell.getAttribute('aria-label')!));
    for (const label of labels) {
      const match = /^([a-f])([1-5]): (Azul|Vermelho), distância ([123]), (Cima|Direita|Baixo|Esquerda)$/.exec(label);
      if (!match) throw new Error(`Unknown piece: ${label}`);
      const casa = { linha: 5 - Number(match[2]), coluna: match[1]!.charCodeAt(0) - 97 };
      if (state.tabuleiro[casa.linha]![casa.coluna]) continue;
      const move: Jogada = { casa, distancia: Number(match[4]) as Distancia,
        direcao: (Object.keys(names) as Direcao[]).find(key => names[key] === match[5])! };
      const next = colocarPeca(state, move);
      if (next === state) throw new Error(`Browser AI made an illegal move: ${label}`);
      state = next;
    }
    if (state.estado !== 'a-jogar') {
      const winner = state.estado === 'vitoria-jogador1' ? 'Azul' : 'Vermelho';
      await page.getByRole('status').filter({ hasText: `Venceu ${winner}!` }).waitFor();
      if (!await page.getByRole('button', { name: 'Confirmar jogada', exact: true }).isDisabled()) throw new Error('Finished match accepts moves');
      return state.estado === `vitoria-${human}`;
    }
    if (state.jogadorAtual !== human) throw new Error('Wrong turn in browser');
    const response = computeFaisca({ version: '1.0', gameId: 'faisca', requestId: `human-${turn}`, mode: 'competitive', state, level: 2, timeBudgetMs: 20, seed: turn + 300 });
    const move = response.bestMove!;
    if (!state.casaObrigatoria) {
      const coordinate = `${String.fromCharCode(97 + move.casa.coluna)}${5 - move.casa.linha}`;
      await page.getByRole('group', { name: 'Tabuleiro de Faísca' }).getByRole('button', { name: new RegExp(`^${coordinate}:`) }).click();
    }
    await page.getByRole('button', { name: `Distância ${move.distancia}`, exact: true }).click();
    await page.getByRole('group', { name: 'Direção da peça' }).getByRole('button', { name: new RegExp(names[move.direcao]) }).click();
    await page.getByRole('button', { name: 'Confirmar jogada', exact: true }).click();
    state = colocarPeca(state, move);
  }
  throw new Error('Faísca match did not finish');
}
