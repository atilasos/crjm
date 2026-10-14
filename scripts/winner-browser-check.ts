import type { Page } from 'playwright';

/** Check the shared announcement, then leave the finished board open for review. */
export async function checkWinnerAnnouncement(
  page: Page,
  message: string,
  t: (text: string) => string = text => text,
): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.getByText(message, { exact: true }).waitFor();
  const replay = dialog.getByRole('button', { name: t('Jogar Novamente'), exact: true });
  if (!await replay.evaluate(button => button === document.activeElement)) {
    throw new Error('Winner announcement did not focus the replay button');
  }
  await dialog.getByRole('button', { name: t('Fechar'), exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}
