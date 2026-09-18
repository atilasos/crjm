import type { Page } from 'playwright';
import { evaluateDesafioGoals, getTrainingPath } from '../src/ai-core/training-paths';

export async function checkFaiscaLaboratory(page: Page, baseUrl: string): Promise<void> {
  const before = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
  const open = async () => {
    await page.goto(`${baseUrl}/#/puzzles`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-puzzle-lab] nav button').filter({ hasText: 'Faísca' }).click();
    await page.locator('[data-strategy-practice] input').first().waitFor();
  };
  await open();
  const practice = page.locator('[data-strategy-practice]');
  const answer = async (choice: string) => {
    await practice.getByRole('button', { name: 'Conferir a minha previsão', exact: true }).waitFor();
    await practice.locator(`input[name^="answer-"][value="${choice}"]`).check();
    await practice.locator('input[name^="prediction-"][value="0"]').check();
    await practice.getByRole('button', { name: 'Conferir a minha previsão', exact: true }).click();
    await practice.getByRole('status').waitFor();
  };
  await practice.getByRole('button', { name: 'Pedir uma pista', exact: true }).click();
  await practice.getByText('A casa inicial é livre, mas a seta também tem de terminar dentro do tabuleiro.', { exact: true }).waitFor();
  const attemptName = await practice.locator('input[name^="answer-"]').first().getAttribute('name');
  await open();
  if (await practice.locator('input[name^="answer-"]').first().getAttribute('name') !== attemptName) throw new Error('Faísca: reload discarded the pending attempt');
  await practice.getByText('A casa inicial é livre, mas a seta também tem de terminar dentro do tabuleiro.', { exact: true }).waitFor();
  await answer('1');
  await practice.getByText('Boa leitura com prática.', { exact: true }).waitFor();
  await practice.getByRole('button', { name: 'Experimentar outra situação', exact: true }).click();
  await answer('0'); // a1 → b1 does not start on required c3.
  await practice.getByText('Vamos comparar com o que acontece.', { exact: true }).waitFor();
  await open();
  for (const choice of ['0', '2', '1']) {
    await answer(choice);
    await practice.getByText('Boa escolha e boa previsão, sem ajuda.', { exact: true }).waitFor();
    await practice.getByRole('button', { name: 'Experimentar outra situação', exact: true }).click();
  }
  await practice.locator('[data-strategy-progress="independent"]').waitFor();

  // Guided puzzles remain guided after a mistake, a hint and a reload.
  await page.locator('[data-puzzle-option="fora"]').click();
  await page.getByRole('button', { name: 'Confirmar resposta', exact: true }).click();
  await page.getByText('Ainda não — tenta outra vez', { exact: true }).waitFor();
  await page.locator('[data-puzzle-lab] article').getByRole('button', { name: 'Pedir uma pista', exact: true }).click();
  await open();
  for (const choice of ['destino', 'alvo', 'sim', 'nao', 'recusa', 'tu']) {
    await page.locator(`[data-puzzle-option="${choice}"]`).click();
    await page.getByRole('button', { name: 'Confirmar resposta', exact: true }).click();
    await page.getByRole('button', { name: 'Próximo exercício', exact: true }).click();
  }
  await page.getByText('Faísca: 6/6 resolvidos', { exact: true }).waitFor();
  const after = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
  const expectedXp = before.profile.totalXp + 36
    + (before.achievements.first_puzzle ? 0 : 10)
    + (before.achievements.after_hint_recovery ? 0 : 12)
    + (before.patterns['faisca:proxima-casa'] ? 0 : 3);
  if (after.profile.totalXp !== expectedXp) throw new Error('Faísca: puzzle XP was not recorded exactly once');
  if (after.patterns['faisca:proxima-casa'].state !== 'used_with_help' || after.patterns['faisca:proxima-casa'].soloContextIds.length) throw new Error('Faísca: guided puzzles became autonomous evidence');
  for (const game of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex', 'y']) {
    if (JSON.stringify(after.gameProgress[game]) !== JSON.stringify(before.gameProgress[game])) throw new Error(`Faísca laboratory changed ${game}`);
  }
  for (const step of getTrainingPath('faisca')!.steps) {
    const evaluation = evaluateDesafioGoals(step.desafioGoals, after.levelProgress.faisca)!;
    await page.locator('[data-percurso]').getByText(evaluation.progress.join(' · '), { exact: true }).waitFor();
    await page.locator('[data-percurso]').getByText(`${evaluation.done ? '✓ ' : ''}Desafio no tabuleiro: ${step.desafio}`, { exact: true }).waitFor();
  }
  await open();
  await page.getByText('Faísca: 6/6 resolvidos', { exact: true }).waitFor();
  await page.locator('[data-puzzle-option="destino"]').click();
  await page.getByRole('button', { name: 'Confirmar resposta', exact: true }).click();
  const repeated = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
  if (repeated.profile.totalXp !== after.profile.totalXp) throw new Error('Faísca: repeating a puzzle duplicated XP');
  await page.goto(`${baseUrl}/#/perfil`, { waitUntil: 'networkidle' });
  const summary = page.getByRole('heading', { name: 'O que já consigo fazer sem ajuda', exact: true }).locator('..');
  await summary.getByRole('heading', { name: 'Faísca', exact: true }).locator('..').locator('[data-strategy-progress="independent"]').waitFor();
}
