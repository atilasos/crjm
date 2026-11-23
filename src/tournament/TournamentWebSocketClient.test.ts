import { expect, test } from 'bun:test';
import { TournamentWebSocketClient } from './TournamentWebSocketClient';
import type { TournamentStateUpdateMessage } from './protocol';
import { tournamentStateFromUpdate } from './protocol';

test('flat tournament updates replace the cached state before notifying subscribers', async () => {
  const update: TournamentStateUpdateMessage = {
    type: 'tournament_state_update', tournamentId: 'updated', gameId: 'nex',
    phase: 'running', players: [], winnersMatches: [], losersMatches: [],
    grandFinal: null, grandFinalReset: null, championId: null, championName: null,
  };
  const server = Bun.serve({
    port: 0,
    fetch(req, server) {
      if (server.upgrade(req)) return;
      return new Response('Expected websocket', { status: 400 });
    },
    websocket: {
      message(ws) { ws.send(JSON.stringify(update)); },
    },
  });
  const client = new TournamentWebSocketClient();
  const received = Promise.withResolvers<void>();
  client.setEventHandlers({
    onMessage(message) {
      if (message.type !== 'tournament_state_update') return;
      try {
        expect(client.tournamentState).toEqual(tournamentStateFromUpdate(update));
        received.resolve();
      } catch (error) { received.reject(error); }
    },
  });
  try {
    await client.connect(`http://127.0.0.1:${server.port}`);
    client.send({ type: 'leave_tournament' });
    await received.promise;
  } finally {
    client.disconnect();
    server.stop(true);
  }
});

import { makeSessionId, recoveryTiming } from './TournamentWebSocketClient';
import type { ClientMessage, ServerMessage, TournamentState } from './protocol';

const emptyState: TournamentState = {
  tournamentId: 't', gameId: 'faisca', phase: 'running', players: [], winnersMatches: [], losersMatches: [],
  grandFinal: null, grandFinalReset: null, championId: null, championName: null,
};
const welcome = (code: string): ServerMessage => ({
  type: 'welcome', playerId: 'p1', playerName: 'Ana', tournamentId: 't', tournamentState: emptyState, reconnectionCode: code,
});

/** Servidor falso: cada ligação recebe o índice e as mensagens do cliente; `script` decide a resposta. */
function fakeServer(script: (connection: number, message: ClientMessage, ws: import('bun').ServerWebSocket<{ n: number }>) => void) {
  let connections = 0;
  const server = Bun.serve<{ n: number }, never>({
    port: 0,
    fetch(req, srv) { if (srv.upgrade(req, { data: { n: ++connections } })) return; return new Response('ws', { status: 400 }); },
    websocket: { message(ws, raw) { script(ws.data.n, JSON.parse(String(raw)), ws); } },
  });
  return { server, url: `http://127.0.0.1:${server.port}`, connections: () => connections };
}

function fastRecovery() {
  const saved = { ...recoveryTiming };
  recoveryTiming.baseDelayMs = 50;
  recoveryTiming.maxDelayMs = 100;
  recoveryTiming.attemptTimeoutMs = 400;
  return () => Object.assign(recoveryTiming, saved);
}

test('identificador de sessão funciona sem crypto.randomUUID (site por HTTP na rede local)', () => {
  // Contexto não seguro: randomUUID não existe, getRandomValues existe.
  const insecure = { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) } as Partial<Crypto>;
  const a = makeSessionId(insecure);
  const b = makeSessionId(insecure);
  expect(a).toMatch(/^[0-9a-f]{32}$/);
  expect(a).not.toBe(b);
  // randomUUID presente mas a lançar (alguns browsers fora de HTTPS).
  const throwing = { ...insecure, randomUUID: () => { throw new Error('insecure'); } } as unknown as Partial<Crypto>;
  expect(makeSessionId(throwing)).toMatch(/^[0-9a-f]{32}$/);
  // Sem Web Crypto.
  expect(makeSessionId({}).length).toBeGreaterThan(8);
});

test('eliminado durante a recuperação: a mensagem chega antes do «desligado» e não há mais tentativas', async () => {
  const restore = fastRecovery();
  const fake = fakeServer((n, message, ws) => {
    if (message.type !== 'rejoin_tournament') return;
    if (n === 1) { ws.send(JSON.stringify(welcome(message.reconnectionCode))); setTimeout(() => ws.close(1011), 20); }
    else ws.send(JSON.stringify({ type: 'error', code: 'PLAYER_ELIMINATED', message: 'Este jogador foi eliminado do torneio.' }));
  });
  const client = new TournamentWebSocketClient();
  const events: string[] = [];
  client.setEventHandlers({
    onMessage: m => events.push(m.type === 'error' ? `error:${m.code}` : m.type),
    onConnectionStatusChange: (status, reason) => { if (status === 'disconnected') events.push(`disconnected:${reason}`); },
  });
  try {
    await client.rejoin(fake.url, 'abc234');
    for (let i = 0; i < 100 && !events.some(e => e.startsWith('disconnected')); i++) await Bun.sleep(20);
    const errorAt = events.indexOf('error:PLAYER_ELIMINATED');
    const disconnectedAt = events.findIndex(e => e.startsWith('disconnected'));
    expect(errorAt).toBeGreaterThanOrEqual(0);
    expect(errorAt).toBeLessThan(disconnectedAt);
    expect(events[disconnectedAt]).toBe('disconnected:Este jogador foi eliminado do torneio.');
    await Bun.sleep(400);
    expect(fake.connections()).toBe(2);
  } finally {
    client.disconnect();
    fake.server.stop(true);
    restore();
  }
});

test('tentativa pendurada é abandonada; queda antes do welcome usa o código pedido', async () => {
  const restore = fastRecovery();
  // 1: recebe o código e cai sem welcome; 2: aceita o socket e nunca responde; 3: welcome.
  const fake = fakeServer((n, message, ws) => {
    if (message.type !== 'rejoin_tournament') return;
    if (n === 1) setTimeout(() => ws.close(1011), 20);
    if (n === 3) {
      expect(message.auto).toBe(true);
      ws.send(JSON.stringify(welcome(message.reconnectionCode)));
    }
  });
  const client = new TournamentWebSocketClient();
  const welcomes: string[] = [];
  client.setEventHandlers({ onMessage: m => { if (m.type === 'welcome') welcomes.push(m.reconnectionCode); } });
  try {
    await client.rejoin(fake.url, 'abc234');
    for (let i = 0; i < 150 && welcomes.length === 0; i++) await Bun.sleep(20);
    expect(welcomes).toEqual(['ABC234']);
    expect(fake.connections()).toBe(3);
  } finally {
    client.disconnect();
    fake.server.stop(true);
    restore();
  }
});

test('reentrada manual recusada (código errado ou eliminado) fecha sem tentar de novo', async () => {
  const restore = fastRecovery();
  for (const code of ['INVALID_CODE', 'PLAYER_ELIMINATED'] as const) {
    const fake = fakeServer((_n, message, ws) => {
      if (message.type === 'rejoin_tournament') ws.send(JSON.stringify({ type: 'error', code, message: `recusado: ${code}` }));
    });
    const client = new TournamentWebSocketClient();
    const statuses: string[] = [];
    const errors: string[] = [];
    client.setEventHandlers({
      onMessage: m => { if (m.type === 'error') errors.push(m.code); },
      onConnectionStatusChange: (status, reason) => statuses.push(`${status}:${reason ?? ''}`),
    });
    try {
      await client.rejoin(fake.url, 'abc234');
      for (let i = 0; i < 100 && !statuses.some(s => s.startsWith('disconnected')); i++) await Bun.sleep(20);
      expect(errors).toEqual([code]);
      expect(statuses.at(-1)).toBe(`disconnected:recusado: ${code}`);
      // Nunca anunciou «ligado» sem welcome, e não voltou a tentar.
      expect(statuses.some(s => s.startsWith('connected'))).toBe(false);
      await Bun.sleep(500);
      expect(fake.connections()).toBe(1);
      expect(client.status).toBe('disconnected');
    } finally {
      client.disconnect();
      fake.server.stop(true);
    }
  }
  restore();
});

test('reentrada manual sem resposta passa a recuperação automática com o mesmo código', async () => {
  const restore = fastRecovery();
  const fake = fakeServer((n, message, ws) => {
    if (message.type !== 'rejoin_tournament') return;
    if (n >= 2) ws.send(JSON.stringify(welcome(message.reconnectionCode)));
    // n === 1: aceita o socket e nunca responde
  });
  const client = new TournamentWebSocketClient();
  const welcomes: string[] = [];
  client.setEventHandlers({ onMessage: m => { if (m.type === 'welcome') welcomes.push(m.reconnectionCode); } });
  try {
    await client.rejoin(fake.url, 'xyz789');
    for (let i = 0; i < 150 && welcomes.length === 0; i++) await Bun.sleep(20);
    expect(welcomes).toEqual(['XYZ789']);
    expect(fake.connections()).toBe(2);
    expect(client.status).toBe('connected');
  } finally {
    client.disconnect();
    fake.server.stop(true);
    restore();
  }
});
