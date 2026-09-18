import { chromium } from 'playwright';

const endpoint = process.env.HUB_CDP_URL;
if (!endpoint) throw new Error('Start a Hub session and set HUB_CDP_URL.');
const started = performance.now();
try {
  const browser = await chromium.connectOverCDP(endpoint, { timeout: Number(process.env.CDP_TIMEOUT_MS || 3000) });
  console.log(JSON.stringify({ runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`, connected: true, elapsedMs: Math.round(performance.now() - started) }));
  await browser.close(); // Disconnect; lifecycle belongs to the Hub.
} catch (error) {
  console.log(JSON.stringify({ runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`, connected: false, elapsedMs: Math.round(performance.now() - started), error: error.message.replace(/\u001b\[[0-9;]*m/g, '').replace(/(?:https?|wss?):\/\/[^\s]+/g, '<HUB_ENDPOINT>') }));
  process.exitCode = 1;
}
