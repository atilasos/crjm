import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ClientMessage, ServerMessage } from '../tournament/protocol';
import type { TournamentExport } from './tournament-engine';
import { criarEstadoInicial, colocarPeca, getJogadasValidas } from '../games/faisca/logic';
import { toNetworkFaiscaMove } from '../tournament/game-protocol';

/** Real WebSocket client that keeps every message for later assertions. */
class Participant {
  messages: ServerMessage[] = [];
  constructor(readonly socket: WebSocket) {
    socket.addEventListener('message', event => this.messages.push(JSON.parse(String(event.data))));
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

    const assigned = await [...clients.values()][0]!.next('match_assigned');
    const match = assigned.match;
    const p1 = clients.get(match.player1!.id)!;
    const p2 = clients.get(match.player2!.id)!;

    // Um pedido atrasado de outro jogo não conta.
    p1.send({ type: 'ready_for_match', matchId: match.id, gameNumber: 2 });
    expect((await p1.next('ready_state')).player1Ready).toBe(false);
    // «Pronto» é confirmado a ambos; um clique repetido é confirmado de novo a quem clicou.
    p1.send({ type: 'ready_for_match', matchId: match.id, gameNumber: 1 });
    expect((await p1.next('ready_state')).player1Ready).toBe(true);
    expect((await p2.next('ready_state')).player1Ready).toBe(true);
    p1.send({ type: 'ready_for_match', matchId: match.id });
    expect((await p1.next('ready_state')).player1Ready).toBe(true);
    p2.send({ type: 'ready_for_match', matchId: match.id });
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
