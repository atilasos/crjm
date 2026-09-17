import type { Page } from 'playwright';
import { criarEstadoInicial, colocarPeca } from '../src/games/faisca/logic';
import { computeFaisca, type FaiscaLevel } from '../src/games/faisca/ai/engine';
import type { Direcao, Distancia, Jogada } from '../src/games/faisca/types';
import type { Player } from '../src/types';

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
