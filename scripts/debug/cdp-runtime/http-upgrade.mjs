// Smallest transport repro: no Playwright, ws package or application imports.
import http from 'node:http';

const base = process.env.HUB_CDP_URL;
if (!base) throw new Error('Set HUB_CDP_URL to the Hub HTTP endpoint.');
const version = await (await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(3000) })).json();
const endpoint = new URL(version.webSocketDebuggerUrl.replace(/^ws:/, 'http:'));
const started = performance.now();
const events = [];
const request = http.get(endpoint, { headers: {
  Connection: 'Upgrade', Upgrade: 'websocket',
  'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
} });
let finished = false;
const deadline = setTimeout(() => finish(false, 'timeout'), 3000);
function finish(ok, reason) {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  console.log(JSON.stringify({ runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`, mode: 'http-upgrade', ok, reason, events, elapsedMs: Math.round(performance.now() - started) }));
  request.destroy();
  process.exitCode = ok ? 0 : 1;
}
request.on('response', response => { events.push(`response:${response.statusCode}`); response.resume(); });
request.on('upgrade', (response, socket) => { events.push(`upgrade:${response.statusCode}`); socket.destroy(); finish(true, 'upgrade event'); });
request.on('error', error => finish(false, error.code || error.name));
