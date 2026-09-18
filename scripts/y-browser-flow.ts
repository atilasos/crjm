import type { Page } from 'playwright';
import type { Player } from '../src/types';
import { criarEstadoInicial, aplicarJogada } from '../src/games/y/logic';
import { computeY, type YLevel } from '../src/games/y/ai/engine';

/** Complete a real match through accessible controls, checking each observed
 * computer action and the final participant against the public rules. */
export async function playYAgainstComputer(page: Page, human: Player, level: YLevel): Promise<boolean> {
  await page.getByRole('button', { name: '🤖 vs Computador', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^N${level},`) }).click();
  await page.getByLabel('Jogar como:', { exact: true }).selectOption(human);
  let state = criarEstadoInicial();
  for (let turn = 0; turn < 94; turn++) {
    await page.waitForFunction(() => {
      const game = document.querySelector('.y-game');
      return game?.querySelector('[role="alert"]') || !game?.querySelector('[role="status"]')?.textContent?.includes('Computador');
    });
    if (await page.locator('.y-game [role="alert"]').count()) throw new Error('Y AI failed in browser');
    if (state.podeTrocar && (await page.locator('.y-identities').innerText()).includes('Jogador 1: Vermelho')) {
      state = aplicarJogada(state, { type: 'swap' });
    }
    const labels = await page.locator('.y-node:not([data-color="empty"])').evaluateAll(cells => cells.map(cell => cell.getAttribute('aria-label')!));
    for (const label of labels) {
      const [id, description] = label.split(': ');
      if (state.tabuleiro[id!]) continue;
      const color = description!.startsWith('Azul') ? 'azul' : 'vermelho';
      if (state.cores[state.jogadorAtual] !== color) throw new Error(`Wrong computer color: ${label}`);
      const next = aplicarJogada(state, { type: 'place', node: id! });
      if (next === state) throw new Error(`Illegal computer placement: ${label}`);
      state = next;
    }
    if (state.estado !== 'a-jogar') {
      const winner = state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2';
      const color = state.cores[winner] === 'azul' ? 'Azul' : 'Vermelho';
      await page.getByRole('status').filter({ hasText: `Venceu Jogador ${winner === 'jogador1' ? 1 : 2} com ${color}!` }).waitFor();
      if (await page.locator('.y-node:enabled').count()) throw new Error('Finished Y match accepts moves');
      return winner === human;
    }
    if (state.jogadorAtual !== human) throw new Error('Wrong Y turn in browser');
    // Exercise human swap as second participant; A1 makes N2 exercise AI swap.
    const move = state.podeTrocar ? { type: 'swap' as const } : state.colocacoes === 0
      ? { type: 'place' as const, node: 'A1' }
      : computeY({ version: '1.0', gameId: 'y', requestId: `human-${turn}`, mode: 'competitive', state, level: 2, seed: turn + 310 }).bestMove!;
    if (move.type === 'swap') await page.getByRole('button', { name: 'Trocar de cores', exact: true }).click();
    else await page.getByRole('button', { name: new RegExp(`^${move.node}:`) }).click();
    state = aplicarJogada(state, move);
  }
  throw new Error('Y match did not finish');
}

/** Observe the gradual help contract, including participant/colour after swap. */
export async function checkYTutor(page: Page, t: (text: string) => string = text => text): Promise<void> {
  const tutor = page.locator('[data-thinking-tutor]');
  await tutor.waitFor({ timeout: 5000 });
  for (const [level, label] of ['Pedir uma pista', 'Ajudar a comparar', 'Ver um exemplo de jogada'].entries()) {
    if (await tutor.getAttribute('data-hint-level') !== String(level)) throw new Error('Y: unexpected help stage');
    if (await page.locator('[data-tutor-solution]').count() || /\b[A-M][1-9][0-9]?\b/.test(await tutor.innerText())) throw new Error('Y: premature solution');
    await tutor.getByRole('button', { name: t(label), exact: true }).click();
    await page.waitForFunction(expected => document.querySelector('[data-thinking-tutor]')?.getAttribute('data-hint-level') === String(expected), level + 1);
  }
  const solution = page.locator('[data-tutor-solution]');
  await solution.getByText(t('Pista do computador: este exemplo não garante vitória.'), { exact: true }).waitFor();
  await solution.getByText(t('Consequência verificada pelas regras'), { exact: true }).waitFor();
}

/** Known path checked against the source drawing, independent of the engine. */
export async function playYLocalExample(page: Page, participant: Player, swap: boolean, t: (text: string) => string = text => text): Promise<void> {
  await page.getByRole('button', { name: t('Dois jogadores no mesmo dispositivo'), exact: true }).click();
  await page.getByLabel(t('O meu perfil corresponde a:')).selectOption(participant);
  const board = page.getByRole('group', { name: t('Intersecções de Y'), exact: true });
  const place = (node: string) => board.getByRole('button', { name: new RegExp(`^${node}:`) }).click();
  await place('A1');
  if (swap) await page.getByRole('button', { name: t('Trocar de cores'), exact: true }).click();
  const path = ['B1', 'C1', 'D3', 'E3', 'E4', 'E5', 'E6', 'E7', 'D8', 'C7', 'B8', 'A9'];
  const replies = ['M1', 'L1', 'K1', 'J1', 'I1', 'G1', 'E1', 'D1', 'I9', 'J7', 'K5', 'L3'];
  for (let i = 0; i < path.length; i++) { await place(replies[i]!); await place(path[i]!); }
}

export async function checkYReview(page: Page, participant: Player, swap: boolean, t: (text: string) => string = text => text): Promise<void> {
  const msg = (text: string, values: (string | number)[]) => t(text).replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)]));
  const blue = participant === (swap ? 'jogador2' : 'jogador1');
  const name = t(participant === 'jogador1' ? 'Jogador 1' : 'Jogador 2');
  const color = t(blue ? 'Azul' : 'Vermelho');
  const review = page.getByRole('region', { name: t('Revisão rápida pós-jogo'), exact: true });
  await review.getByText(msg('A tua decisão: turno {0}, {1}, com {2}.', [(blue ? 25 : 24) + Number(swap), name, color]), { exact: true }).waitFor();
  const played = review.getByRole('region', { name: t('Jogada realizada'), exact: true });
  await played.getByText(msg('{0} coloca {1} em {2}.', [name, color, blue ? 'A9' : 'L3']), { exact: true }).waitFor();
  await review.getByText(t('Explica que grupos e lados esta decisão ligou e o que ficou por ligar. Esta revisão é prática orientada.'), { exact: true }).waitFor();
  if (blue) {
    await played.getByText(msg('Grupo ligado à peça colocada: {0}.', ['A1, A9, B1, B8, C1, C7, D3, D8, E3, E4, E5, E6, E7']), { exact: true }).waitFor();
    await played.getByText(msg('Vitória demonstrada: {0}, com {1}, ligou os três lados num único grupo.', [name, color]), { exact: true }).waitFor();
  } else {
    await review.getByText(t('Esta ação não termina a partida. A recomendação não prova uma vitória futura.'), { exact: true }).first().waitFor();
    // The final Blue win must not be misattributed to the learner's preceding Red move.
    if ((await played.innerText()).includes(t('Vitória demonstrada: {0}, com {1}, ligou os três lados num único grupo.').split('{0}')[0]!)) throw new Error('Y: review credits the opponent’s win to the learner');
  }
  await review.getByText(t('Ver a posição antes da decisão'), { exact: true }).click();
  await review.getByRole('img', { name: new RegExp(`^${blue ? 'A9' : 'L3'}: ${t('Vazia')}`) }).waitFor();
  await review.getByRole('img', { name: new RegExp(`^A1: ${t('Azul')}`) }).waitFor();
  if (await page.locator('[data-thinking-tutor]').count()) throw new Error('Y: tutor remains after match');
  await review.getByText(t('Ver a posição antes da decisão'), { exact: true }).click();
  await review.getByRole('button', { name: t('Marcar revisão concluída (+10 XP)'), exact: true }).waitFor();
}

export async function checkYHintCancellation(page: Page): Promise<void> {
  const hintUrl = '**/api/learner/events/pattern-progress';
  const workerUrl = '**/ai/y/y.worker.js';
  const place = (node: string) => page.getByRole('group', { name: 'Intersecções de Y', exact: true }).getByRole('button', { name: new RegExp(`^${node}:`) }).click();
  for (const action of ['turn', 'restart', 'swap'] as const) {
    await page.getByRole('button', { name: 'Dois jogadores no mesmo dispositivo', exact: true }).click();
    await page.getByLabel('O meu perfil corresponde a:').selectOption(action === 'swap' ? 'jogador2' : 'jogador1');
    if (action === 'swap') await place('A1');
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
    if (await page.locator('[data-thinking-tutor]').getAttribute('data-hint-level') !== '0') throw new Error('Y: help revealed before saving');
    if (action === 'turn') { await place('A1'); await place('M1'); }
    else if (action === 'swap') { await page.getByRole('button', { name: 'Trocar de cores', exact: true }).click(); await place('M1'); }
    else await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
    const response = page.waitForResponse(hintUrl);
    release();
    await response;
    await page.waitForTimeout(100);
    await page.unroute(hintUrl);
    if (await page.locator('[data-thinking-tutor]').getAttribute('data-hint-level') !== '0') throw new Error('Y: delayed help crossed turn/restart/swap');
  }
  await page.route(workerUrl, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `const send = self.postMessage.bind(self); self.postMessage = data => setTimeout(() => send(data), 600);\n${await response.text()}` });
  });
  for (const action of ['turn', 'restart', 'swap', 'mode', 'participant', 'level'] as const) {
    await page.getByRole('button', { name: 'Dois jogadores no mesmo dispositivo', exact: true }).click();
    await page.getByLabel('O meu perfil corresponde a:').selectOption(action === 'swap' ? 'jogador2' : 'jogador1');
    if (action === 'level') await page.getByRole('button', { name: '🤖 vs Computador', exact: true }).click();
    if (action === 'swap') await place('A1');
    for (const label of ['Pedir uma pista', 'Ajudar a comparar', 'Ver um exemplo de jogada']) {
      await page.getByRole('button', { name: label, exact: true }).click();
    }
    await page.locator('[data-tutor-solution]').waitFor();
    if (action === 'turn') { await place('A1'); await place('M1'); }
    else if (action === 'swap') { await page.getByRole('button', { name: 'Trocar de cores', exact: true }).click(); await place('M1'); }
    else if (action === 'mode') await page.getByRole('button', { name: '🤖 vs Computador', exact: true }).click();
    else if (action === 'participant') await page.getByLabel('O meu perfil corresponde a:').selectOption('jogador2');
    else if (action === 'level') await page.getByRole('button', { name: /^N2,/ }).click();
    else await page.getByRole('button', { name: 'Nova partida', exact: true }).click();
    await page.waitForTimeout(800);
    if (await page.locator('[data-tutor-solution]').count()) throw new Error(`Y: delayed example crossed ${action}`);
  }
  await page.unroute(workerUrl);
}
