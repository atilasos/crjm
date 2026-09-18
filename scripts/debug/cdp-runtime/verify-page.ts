import assert from 'node:assert/strict';
import type { Page } from 'playwright';

export async function verifyPage(page: Page): Promise<void> {
  await page.setContent('<button onclick="this.textContent=\'OK\'">Test CDP</button>');
  await page.getByRole('button', { name: 'Test CDP' }).click();
  assert.equal(await page.getByRole('button').textContent(), 'OK');
}
