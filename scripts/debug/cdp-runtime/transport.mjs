// Diagnostic only: internal Playwright imports match the repository's locked 1.57.0.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('playwright-core/package.json'));
const { ws: BundledWebSocket } = require(join(root, 'lib/utilsBundle.js'));
const { httpHappyEyeballsAgent } = require(join(root, 'lib/server/utils/happyEyeballs.js'));
const mode = process.argv[2];
const base = process.env.HUB_CDP_URL;
if (!base) throw new Error('Set HUB_CDP_URL to the Hub HTTP endpoint.');
const version = await (await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(3000) })).json();
const endpoint = version.webSocketDebuggerUrl;
const started = performance.now();
const events = [];
let resource;
let finished = false;
const deadline = setTimeout(() => finish(false, 'timeout'), 3000);
function finish(ok, reason) {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  console.log(JSON.stringify({ runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`, mode, ok, reason, events, elapsedMs: Math.round(performance.now() - started) }));
  resource?.on?.('error', () => {});
  if (resource?.destroy) resource.destroy();
  else if (resource?.terminate) resource.terminate();
  else resource?.close();
  process.exitCode = ok ? 0 : 1;
}

{
  const options = mode === 'bundled-agent' ? { agent: httpHappyEyeballsAgent } : {};
  resource = mode === 'native' ? new WebSocket(endpoint) : new BundledWebSocket(endpoint, [], options);
  resource.on?.('upgrade', response => events.push(`upgrade:${response.statusCode}`));
  resource.on?.('unexpected-response', (_request, response) => { events.push(`unexpected-response:${response.statusCode}`); response.resume(); });
  resource.addEventListener('open', () => { events.push('open'); resource.send(JSON.stringify({ id: 1, method: 'Browser.getVersion' })); });
  resource.addEventListener('message', event => { const data = JSON.parse(String(event.data)); if (data.id === 1) finish(Boolean(data.result?.product), 'Browser.getVersion'); });
  resource.addEventListener('error', () => finish(false, 'websocket error'));
}
