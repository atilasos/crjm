import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ClientMessage, ServerMessage } from '../tournament/protocol';
import type { TournamentExport } from './tournament-engine';
import { criarEstadoInicial, colocarPeca, getJogadasValidas } from '../games/faisca/logic';
import { toNetworkFaiscaMove } from '../tournament/game-protocol';
import { TournamentWebSocketClient } from '../tournament/TournamentWebSocketClient';

/** Real WebSocket client that keeps every message for later assertions. */
class Participant {
  messages: ServerMessage[] = [];
  /** Tudo o que foi recebido, mesmo depois de `next()` consumir (para verificar fugas). */
  all: ServerMessage[] = [];
  constructor(readonly socket: WebSocket) {
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      this.messages.push(message);
      this.all.push(message);
    });
  }
  send(message: ClientMessage) { this.socket.send(JSON.stringify(message)); }
  async next<T extends ServerMessage['type']>(type: T, accept: (message: Extract<ServerMessage, { type: T }>) => boolean = () => true): Promise<Extract<ServerMessage, { type: T }>> {
    for (let attempt = 0; attempt < 300; attempt++) {
      const index = this.messages.findIndex(message => message.type === type && accept(message as Extract<ServerMessage, { type: T }>));
      if (index >= 0) return this.messages.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>;
      await Bun.sleep(10);
    }
    throw new Error(`No ${type} received; recent: ${this.messages.slice(-5).map(m => m.type)}`);
  }
}

test('torneio importado a meio de um jogo retoma quando os dois voltam; «pronto» repetido é confirmado', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'crjm-resume-'));
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = reservation.port!;
  reservation.stop(true);
  const base = `http://127.0.0.1:${port}`;
  const adminKey = crypto.randomUUID();
  const server = Bun.spawn(['bun', 'src/server/tournament-server.ts'], {
    env: { ...process.env, PORT: String(port), ADMIN_KEY: adminKey, CLASS_STORE_PATH: join(directory, 'classes.json') },
    stdout: 'ignore', stderr: 'pipe',
  });
  const sockets: Participant[] = [];
  async function connect() {
    const socket = new WebSocket(`${base.replace('http', 'ws')}/ws`);
    const participant = new Participant(socket);
    sockets.push(participant);
    await new Promise<void>((resolve, reject) => { socket.onopen = () => resolve(); socket.onerror = () => reject(new Error('WebSocket failed')); });
    return participant;
  }
  async function api(path: string, body?: unknown) {
    const response = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return response.json();
  }
  async function rejoin(code: string) {
    const client = await connect();
    client.send({ type: 'rejoin_tournament', reconnectionCode: code });
    await client.next('welcome');
    return client;
  }
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${base}/api/tournaments`, { headers: { Authorization: `Bearer ${adminKey}` } })).ok) break; } catch {}
      await Bun.sleep(20);
    }
    const created = await api('tournaments/faisca/create-with-players', { players: [{ name: 'Ana' }, { name: 'Beto' }] });
    const codes = new Map<string, string>(created.players.map((p: { id: string; reconnectionCode: string }) => [p.id, p.reconnectionCode]));
    const clients = new Map<string, Participant>();
    for (const [id, code] of codes) clients.set(id, await rejoin(code));
    await api('tournaments/faisca/start', {});

    // Nenhum aluno recebe os códigos dos colegas: só o seu, no welcome.
    for (const client of clients.values()) {
      await client.next('tournament_state_update', m => m.phase === 'running');
    }
    for (const [id, client] of clients) {
      const welcomes = client.all.filter((m): m is Extract<ServerMessage, { type: 'welcome' }> => m.type === 'welcome');
      const updates = client.all.filter(m => m.type === 'tournament_state_update');
      expect(welcomes.length).toBeGreaterThan(0);
      expect(updates.length).toBeGreaterThan(0);
      for (const welcome of welcomes) {
        expect(welcome.reconnectionCode).toBe(codes.get(id)!);
        expect(welcome.tournamentState.players.length).toBe(2);
      }
      // Nenhum código de colega em lado nenhum do que este aluno recebeu.
      const received = JSON.stringify(client.all);
      for (const [otherId, otherCode] of codes) {
        if (otherId !== id) expect(received).not.toContain(otherCode);
      }
      for (const update of updates) {
        if (update.type !== 'tournament_state_update') continue;
        expect(update.players.length).toBe(2);
        for (const player of update.players) expect('reconnectionCode' in player).toBe(false);
      }
    }
    // O professor continua a ter todos os códigos (cartões e painel).
    const adminView = await api('tournaments');
    const adminCodes = new Map<string, string>(adminView[0].players.map((p: { id: string; reconnectionCode: string }) => [p.id, p.reconnectionCode]));
    expect(adminCodes).toEqual(codes);

    const assigned = await [...clients.values()][0]!.next('match_assigned');
    const match = assigned.match;
    const p1 = clients.get(match.player1!.id)!;
    const p2 = clients.get(match.player2!.id)!;

    // Um pedido atrasado de outro jogo não conta.
    p1.send({ type: 'ready_for_match', matchId: match.id, gameNumber: 2 });
    const resync = await p1.next('ready_state');
    expect(resync.player1Ready).toBe(false);
    expect(resync.reset).toBe(true);
    // Sem número de jogo (separador antigo): também não conta, e pede para atualizar.
    p1.send({ type: 'ready_for_match', matchId: match.id } as unknown as ClientMessage);
    expect((await p1.next('ready_state')).player1Ready).toBe(false);
    await p1.next('info', m => m.message.includes('Atualiza'));
    // «Pronto» é confirmado a ambos; um clique repetido é confirmado de novo a quem clicou.
    p1.send({ type: 'ready_for_match', matchId: match.id, gameNumber: 1 });
    expect((await p1.next('ready_state')).player1Ready).toBe(true);
    expect((await p2.next('ready_state')).player1Ready).toBe(true);
    p1.send({ type: 'ready_for_match', matchId: match.id, gameNumber: 1 });
    expect((await p1.next('ready_state')).player1Ready).toBe(true);
    p2.send({ type: 'ready_for_match', matchId: match.id, gameNumber: 1 });
    const started = await p1.next('game_start');
    await p2.next('game_start');

    // Primeira jogada, depois exportar a meio do jogo.
    let state = criarEstadoInicial();
    const firstMover = started.youStart ? p1 : p2;
    const move = getJogadasValidas(state)[0]!;
    firstMover.send({ type: 'submit_move', matchId: match.id, gameNumber: 1, move: toNetworkFaiscaMove(move) });
    state = colocarPeca(state, move);
    await p1.next('game_state_update');
    await p2.next('game_state_update');
    const snapshot: TournamentExport = await api('tournaments/faisca/export');
    expect(snapshot.version).toBe(2);

    // Importar com os alunos ainda ligados: as ligações antigas são fechadas e deixam de jogar.
    const closed = [p1, p2].map(client => new Promise<void>(resolve => client.socket.addEventListener('close', () => resolve(), { once: true })));
    await api('tournaments/faisca/import', snapshot);
    await Promise.all(closed);
    expect(p1.messages.some(m => m.type === 'info' && m.message.includes('restaurado'))).toBe(true);
    const restored: TournamentExport = await api('tournaments/faisca/export');
    const pausedMatch = [...restored.winnersMatches, ...restored.losersMatches].find(m => m.id === match.id)!;
    expect(pausedMatch.isPaused).toBe(true);

    const back1 = await rejoin(codes.get(match.player1!.id)!);
    const back2 = await rejoin(codes.get(match.player2!.id)!);
    await back2.next('game_state_update');
    const secondMover = started.youStart ? back2 : back1;
    const reply = getJogadasValidas(state)[0]!;
    secondMover.send({ type: 'submit_move', matchId: match.id, gameNumber: 1, move: toNetworkFaiscaMove(reply) });
    const update = await secondMover.next('game_state_update', m => m.matchId === match.id && (m.gameState as { tabuleiro?: unknown }).tabuleiro !== undefined && JSON.stringify(m.gameState) === JSON.stringify(colocarPeca(state, reply)));
    expect(update.yourTurn).toBe(false);
    expect(secondMover.messages.some(m => m.type === 'error' && m.code === 'MATCH_NOT_PLAYING')).toBe(false);
  } finally {
    for (const client of sockets) client.socket.close();
    server.kill();
    await server.exited;
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);

test('o cliente do aluno volta a entrar sozinho com o código depois de o torneio ser restaurado', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'crjm-autorejoin-'));
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = reservation.port!;
  reservation.stop(true);
  const base = `http://127.0.0.1:${port}`;
  const adminKey = crypto.randomUUID();
  const server = Bun.spawn(['bun', 'src/server/tournament-server.ts'], {
    env: { ...process.env, PORT: String(port), ADMIN_KEY: adminKey, CLASS_STORE_PATH: join(directory, 'classes.json') },
    stdout: 'ignore', stderr: 'pipe',
  });
  const client = new TournamentWebSocketClient();
  async function api(path: string, body?: unknown) {
    const response = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return response.json();
  }
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${base}/api/tournaments`, { headers: { Authorization: `Bearer ${adminKey}` } })).ok) break; } catch {}
      await Bun.sleep(20);
    }
    const created = await api('tournaments/faisca/create-with-players', { players: [{ name: 'Ana' }, { name: 'Beto' }] });
    const welcomes: string[] = [];
    client.setEventHandlers({ onMessage: message => { if (message.type === 'welcome') welcomes.push(message.playerId); } });
    await client.rejoin(base, created.players[0].reconnectionCode);
    for (let i = 0; i < 100 && welcomes.length < 1; i++) await Bun.sleep(20);
    expect(welcomes).toEqual([created.players[0].id]);

    const snapshot = await api('tournaments/faisca/export');
    await api('tournaments/faisca/import', snapshot);
    // O servidor fecha a ligação antiga; o cliente religa e reenvia o código sozinho.
    for (let i = 0; i < 200 && welcomes.length < 2; i++) await Bun.sleep(20);
    expect(welcomes).toEqual([created.players[0].id, created.players[0].id]);
    const state = await api('tournaments');
    expect(state[0].players.find((p: { id: string }) => p.id === created.players[0].id).isConnected).toBe(true);
  } finally {
    client.disconnect();
    server.kill();
    await server.exited;
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);

/** Arranca um servidor de torneios isolado; `restart` volta a abrir na mesma porta. */
async function startServer() {
  const directory = await mkdtemp(join(tmpdir(), 'crjm-recovery-'));
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = reservation.port!;
  reservation.stop(true);
  const base = `http://127.0.0.1:${port}`;
  const adminKey = crypto.randomUUID();
  let process = spawnServer();
  function spawnServer() {
    return Bun.spawn(['bun', 'src/server/tournament-server.ts'], {
      env: { ...Bun.env, PORT: String(port), ADMIN_KEY: adminKey, CLASS_STORE_PATH: join(directory, 'classes.json') },
      stdout: 'ignore', stderr: 'pipe',
    });
  }
  async function ready() {
    for (let i = 0; i < 200; i++) {
      try { if ((await fetch(`${base}/api/tournaments`, { headers: { Authorization: `Bearer ${adminKey}` } })).ok) return; } catch {}
      await Bun.sleep(20);
    }
    throw new Error('server did not start');
  }
  async function api(path: string, body?: unknown) {
    const response = await fetch(`${base}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return response.json();
  }
  await ready();
  async function importRaw(body: unknown) {
    return fetch(`${base}/api/tournaments/faisca/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return {
    base, api, ready, importRaw, adminKey,
    async stop() { process.kill(); await process.exited; },
    async restart() { process = spawnServer(); await ready(); },
    async cleanup() { process.kill(); await process.exited; await rm(directory, { recursive: true, force: true }); },
  };
}

test('servidor reiniciado durante vários segundos e torneio restaurado depois: o aluno volta sozinho', async () => {
  const server = await startServer();
  const client = new TournamentWebSocketClient();
  try {
    const created = await server.api('tournaments/faisca/create-with-players', { players: [{ name: 'Ana' }, { name: 'Beto' }] });
    const welcomes: string[] = [];
    client.setEventHandlers({ onMessage: message => { if (message.type === 'welcome') welcomes.push(message.playerId); } });
    await client.rejoin(server.base, created.players[0].reconnectionCode);
    for (let i = 0; i < 100 && welcomes.length < 1; i++) await Bun.sleep(20);
    const snapshot = await server.api('tournaments/faisca/export');

    await server.stop();
    await Bun.sleep(2500); // mais do que a primeira tentativa (1 s)
    await server.restart();
    await Bun.sleep(1500); // o código é recusado enquanto o professor ainda não restaurou
    await server.api('tournaments/faisca/import', snapshot);

    for (let i = 0; i < 1000 && welcomes.length < 2; i++) await Bun.sleep(20);
    expect(welcomes).toEqual([created.players[0].id, created.players[0].id]);
  } finally {
    client.disconnect();
    await server.cleanup();
  }
}, 40000);

test('reentrada automática de outro dispositivo não tira o lugar; o mesmo dispositivo volta sempre', async () => {
  const server = await startServer();
  const sockets: Participant[] = [];
  async function connect() {
    const socket = new WebSocket(`${server.base.replace('http', 'ws')}/ws`);
    const participant = new Participant(socket);
    sockets.push(participant);
    await new Promise<void>((resolve, reject) => { socket.onopen = () => resolve(); socket.onerror = () => reject(new Error('WebSocket failed')); });
    return participant;
  }
  try {
    const created = await server.api('tournaments/faisca/create-with-players', { players: [{ name: 'Ana' }, { name: 'Beto' }] });
    const code = created.players[0].reconnectionCode;
    // O aluno está agora no tablet novo.
    const current = await connect();
    current.send({ type: 'rejoin_tournament', reconnectionCode: code, deviceId: 'tablet-novo' });
    await current.next('welcome');

    // O tablet antigo recupera a rede e tenta voltar sozinho: recusado, o lugar fica onde está.
    const old = await connect();
    old.send({ type: 'rejoin_tournament', reconnectionCode: code, auto: true, deviceId: 'tablet-antigo' });
    expect((await old.next('error')).code).toBe('SEAT_TAKEN');
    expect(current.socket.readyState).toBe(WebSocket.OPEN);

    // O tablet novo perde a ligação sem o servidor saber; ao voltar, retoma o lugar.
    const again = await connect();
    again.send({ type: 'rejoin_tournament', reconnectionCode: code, auto: true, deviceId: 'tablet-novo' });
    await again.next('welcome');
  } finally {
    for (const client of sockets) client.socket.close();
    await server.cleanup();
  }
}, 30000);

test('importar recusa tabuleiro adulterado ou lugares impossíveis sem tocar no torneio em curso', async () => {
  const server = await startServer();
  const sockets: Participant[] = [];
  async function connect() {
    const socket = new WebSocket(`${server.base.replace('http', 'ws')}/ws`);
    const participant = new Participant(socket);
    sockets.push(participant);
    await new Promise<void>((resolve, reject) => { socket.onopen = () => resolve(); socket.onerror = () => reject(new Error('WebSocket failed')); });
    return participant;
  }
  try {
    const created = await server.api('tournaments/faisca/create-with-players', { players: [{ name: 'Ana' }, { name: 'Beto' }] });
    const clients: Participant[] = [];
    for (const player of created.players) {
      const client = await connect();
      client.send({ type: 'rejoin_tournament', reconnectionCode: player.reconnectionCode });
      await client.next('welcome');
      clients.push(client);
    }
    await server.api('tournaments/faisca/start', {});
    const match = (await clients[0]!.next('match_assigned')).match;
    for (const client of clients) client.send({ type: 'ready_for_match', matchId: match.id, gameNumber: 1 });
    await clients[0]!.next('game_start');
    const snapshot: TournamentExport = await server.api('tournaments/faisca/export');

    const tampered = JSON.parse(JSON.stringify(snapshot));
    tampered.winnersMatches[0].gameState = { tabuleiro: [] };
    const sameSeat = JSON.parse(JSON.stringify(snapshot));
    sameSeat.winnersMatches[0].player2 = sameSeat.winnersMatches[0].player1;
    // Vez e estado coerentes, mas tabuleiro com dimensões erradas.
    const wrongBoard = JSON.parse(JSON.stringify(snapshot));
    wrongBoard.winnersMatches[0].gameState.tabuleiro = wrongBoard.winnersMatches[0].gameState.tabuleiro.slice(1);
    const noStarter = JSON.parse(JSON.stringify(snapshot));
    delete noStarter.winnersMatches[0].whoStartsCurrentGame;
    for (const bad of [tampered, sameSeat, wrongBoard, noStarter]) {
      const response = await server.importRaw(bad);
      expect(response.status).toBe(400);
    }
    // O torneio em curso continua intacto e os alunos ligados.
    await Bun.sleep(50);
    for (const client of clients) expect(client.socket.readyState).toBe(WebSocket.OPEN);
    const live: TournamentExport = await server.api('tournaments/faisca/export');
    expect(live.id).toBe(snapshot.id);
    // Um ficheiro válido continua a ser aceite.
    expect((await server.importRaw(snapshot)).status).toBe(200);
  } finally {
    for (const client of sockets) client.socket.close();
    await server.cleanup();
  }
}, 30000);

test('importar recusa um jogo não suportado e um tabuleiro de Y sem uma casa', async () => {
  const server = await startServer();
  const sockets: Participant[] = [];
  try {
    const created = await server.api('tournaments/y/create-with-players', { players: [{ name: 'Ana' }, { name: 'Beto' }] });
    for (const player of created.players) {
      const socket = new WebSocket(`${server.base.replace('http', 'ws')}/ws`);
      const client = new Participant(socket);
      sockets.push(client);
      await new Promise<void>(resolve => { socket.onopen = () => resolve(); });
      client.send({ type: 'rejoin_tournament', reconnectionCode: player.reconnectionCode });
      await client.next('welcome');
    }
    await server.api('tournaments/y/start', {});
    const match = (await sockets[0]!.next('match_assigned')).match;
    for (const client of sockets) client.send({ type: 'ready_for_match', matchId: match.id, gameNumber: 1 });
    await sockets[0]!.next('game_start');
    const snapshot: TournamentExport = await server.api('tournaments/y/export');

    const missingCell = JSON.parse(JSON.stringify(snapshot));
    const board = missingCell.winnersMatches[0].gameState.tabuleiro as Record<string, unknown>;
    delete board[Object.keys(board)[0]!];
    const response = await fetch(`${server.base}/api/tournaments/y/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.adminKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(missingCell),
    });
    expect(response.status).toBe(400);

    const unknownGame = { ...JSON.parse(JSON.stringify(snapshot)), gameId: 'xadrez' };
    const unsupported = await fetch(`${server.base}/api/tournaments/xadrez/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.adminKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(unknownGame),
    });
    expect(unsupported.status).toBe(400);

    // O torneio em curso continua lá e os alunos ligados.
    for (const client of sockets) expect(client.socket.readyState).toBe(WebSocket.OPEN);
    expect(((await server.api('tournaments/y/export')) as TournamentExport).id).toBe(snapshot.id);
  } finally {
    for (const client of sockets) client.socket.close();
    await server.cleanup();
  }
}, 30000);
