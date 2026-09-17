import type { Page } from 'playwright';
import { evaluateDesafioGoals, getTrainingPath } from '../src/ai-core/training-paths';

export async function checkYLaboratory(page: Page, baseUrl: string): Promise<void> {
  const before = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
  const open = async () => {
    await page.goto(`${baseUrl}/?integracao=1#/puzzles`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-puzzle-lab] nav button').filter({ hasText: /Y/ }).last().click();
    await page.locator('[data-strategy-practice] input').first().waitFor();
  };
  await open();
  const practice = page.locator('[data-strategy-practice]');
  const answer = async (choice: string, prediction: string) => {
    await practice.getByRole('button', { name: 'Conferir a minha previsão', exact: true }).waitFor();
    await practice.locator(`input[name^="answer-"][value="${choice}"]`).check();
    await practice.locator(`input[name^="prediction-"][value="${prediction}"]`).check();
    await practice.getByRole('button', { name: 'Conferir a minha previsão', exact: true }).click();
    await practice.getByRole('status').waitFor();
  };
  await practice.getByRole('button', { name: 'Pedir uma pista', exact: true }).click();
  await practice.getByText('Segue os traços entre as intersecções. Estar perto não basta.', { exact: true }).waitFor();
  const attemptName = await practice.locator('input[name^="answer-"]').first().getAttribute('name');
  await open();
  if (await practice.locator('input[name^="answer-"]').first().getAttribute('name') !== attemptName) throw new Error('Y: reload discarded the pending attempt');
  await practice.getByText('Segue os traços entre as intersecções. Estar perto não basta.', { exact: true }).waitFor();
  await answer('0', '1');
  await practice.getByText('Boa leitura com prática.', { exact: true }).waitFor();
  await practice.getByRole('button', { name: 'Experimentar outra situação', exact: true }).click();
  await answer('1', '1'); // A1 touches top and left, not top and right.
  await practice.getByText('Vamos comparar com o que acontece.', { exact: true }).waitFor();
  await open();
  for (const [choice, prediction] of [['0', '2'], ['1', '2'], ['1', '0']]) {
    await answer(choice!, prediction!);
    await practice.getByText('Boa escolha e boa previsão, sem ajuda.', { exact: true }).waitFor();
    await practice.getByRole('button', { name: 'Experimentar outra situação', exact: true }).click();
  }
  await practice.locator('[data-strategy-progress="independent"]').waitFor();

  // Guided puzzles remain guided after a mistake, a hint and a reload.
  await page.locator('[data-puzzle-option="1"]').click();
  await page.getByRole('button', { name: 'Confirmar resposta', exact: true }).click();
  await page.getByText('Ainda não — tenta outra vez', { exact: true }).waitFor();
  await page.locator('[data-puzzle-lab] article').getByRole('button', { name: 'Pedir uma pista', exact: true }).click();
  await open();
  for (const choice of ['0', '0', '0', '0', '0', '0']) {
    await page.locator(`[data-puzzle-option="${choice}"]`).click();
    await page.getByRole('button', { name: 'Confirmar resposta', exact: true }).click();
    await page.getByRole('button', { name: 'Próximo exercício', exact: true }).click();
  }
  await page.getByText('Y: 6/6 resolvidos', { exact: true }).waitFor();
  const after = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
  const expectedXp = before.profile.totalXp + 36
    + (before.achievements.first_puzzle ? 0 : 10)
    + (before.achievements.after_hint_recovery ? 0 : 12)
    + (before.patterns['y:tres-lados'] ? 0 : 3);
  if (after.profile.totalXp !== expectedXp) throw new Error('Y: puzzle XP was not recorded exactly once');
  if (after.patterns['y:tres-lados'].state !== 'used_with_help' || after.patterns['y:tres-lados'].soloContextIds.length) throw new Error('Y: guided puzzles became autonomous evidence');
  for (const game of ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex', 'faisca']) {
    if (JSON.stringify(after.gameProgress[game]) !== JSON.stringify(before.gameProgress[game])) throw new Error(`Y laboratory changed ${game}`);
  }
  for (const step of getTrainingPath('y')!.steps) {
    const evaluation = evaluateDesafioGoals(step.desafioGoals, after.levelProgress.y)!;
    await page.locator('[data-percurso]').getByText(evaluation.progress.join(' · '), { exact: true }).waitFor();
    await page.locator('[data-percurso]').getByText(`${evaluation.done ? '✓ ' : ''}Desafio no tabuleiro: ${step.desafio}`, { exact: true }).waitFor();
  }
  await open();
  await page.getByText('Y: 6/6 resolvidos', { exact: true }).waitFor();
  await page.locator('[data-puzzle-option="0"]').click();
  await page.getByRole('button', { name: 'Confirmar resposta', exact: true }).click();
  const repeated = await page.evaluate(async () => (await fetch('/api/learner/dashboard')).json());
  if (repeated.profile.totalXp !== after.profile.totalXp) throw new Error('Y: repeating a puzzle duplicated XP');
  await page.goto(`${baseUrl}/?integracao=1#/perfil`, { waitUntil: 'networkidle' });
  const summary = page.getByRole('heading', { name: 'O que já consigo fazer sem ajuda', exact: true }).locator('..');
  await summary.getByRole('heading', { name: 'Y', exact: true }).locator('..').locator('[data-strategy-progress="independent"]').waitFor();
}
