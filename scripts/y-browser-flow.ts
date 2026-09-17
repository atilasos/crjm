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
