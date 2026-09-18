// Run with `bun run test:cdp`, against a browser started by the Hub.
import { verifyPage } from './verify-page';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const endpoint = process.env.HUB_CDP_URL;
if (!endpoint) throw new Error('Set HUB_CDP_URL to a Hub-owned browser.');
// The real smoke scripts derive the project directory this way.
assert.equal(fileURLToPath(new URL('..', import.meta.url)), `${process.cwd()}/`);
const browser = await chromium.connectOverCDP(endpoint, { timeout: 3000 });
try {
  const context = await browser.newContext();
  try {
    await verifyPage(await context.newPage());
    console.log(JSON.stringify({ runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`, connected: true, typescriptBundle: true, projectRoot: true, newContext: true, domClick: true }));
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
