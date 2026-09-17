import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ClientMessage, ServerMessage } from '../tournament/protocol';
import type { TournamentExport, ExportedMatch } from './tournament-engine';
import { criarEstadoInicial, colocarPeca, getJogadasValidas } from '../games/faisca/logic';
import { toNetworkFaiscaMove } from '../tournament/game-protocol';

const matches = (tournament: TournamentExport): ExportedMatch[] => [
  ...tournament.winnersMatches, ...tournament.losersMatches,
  ...[tournament.grandFinal, tournament.grandFinalReset].filter((match): match is ExportedMatch => match !== null),
];

/** Real HTTP/WebSocket boundary, isolated from student data and other servers. */
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
    throw new Error(`No ${type} received; recent messages: ${this.messages.slice(-4).map(m => m.type)}`);
  }
}

test('Faísca real: autoridade, reconexão, espectador, administração e dupla eliminação', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'crjm-faisca-'));
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
  async function connect(admin = false) {
    // Bun supports authenticated WebSocket options; lib.dom only types protocols.
    const BunSocket = WebSocket as unknown as new (url: string, options?: Bun.WebSocketOptions) => WebSocket;
    const socket = new BunSocket(`${base.replace('http', 'ws')}/ws`, admin ? { headers: { Authorization: `Bearer ${adminKey}` } } : undefined);
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
  const exported = async (): Promise<TournamentExport> => api('tournaments/faisca/export');
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(`${base}/api/tournaments`, { headers: { Authorization: `Bearer ${adminKey}` } })).ok) break; } catch {}
      await Bun.sleep(20);
    }
    const created = await api('tournaments/faisca/create-with-players', { players: ['Ana', 'Beto', 'Cris', 'Dina'].map(name => ({ name })) });
    const players = new Map<string, Participant>();
    const codes = new Map<string, string>();
    for (const player of created.players) {
      const client = await connect();
      client.send({ type: 'rejoin_tournament', reconnectionCode: player.reconnectionCode });
      await client.next('welcome');
      players.set(player.id, client);
      codes.set(player.id, player.reconnectionCode);
    }
    const spectator = await connect(true);
    await api('tournaments/faisca/start', {});
    let checked = false;
    let games = 0;
    const brackets = new Set<string>();
    for (let round = 0; round < 40; round++) {
      const tournament = await exported();
      if (tournament.phase === 'finished') {
        expect(games).toBeGreaterThanOrEqual(10);
        expect(brackets.has('losers')).toBe(true);
        expect(tournament.championId).toBeTruthy();
        expect(tournament.players.filter(player => matches(tournament).filter(match =>
          match.winnerId && match.winnerId !== player.id && (match.player1?.id === player.id || match.player2?.id === player.id)
        ).length === 2)).toHaveLength(3);
        break;
      }
      const match = matches(tournament).find(m => m.phase === 'waiting' && m.player1 && m.player2)!;
      expect(match).toBeDefined();
      brackets.add(match.bracket);
      let p1 = players.get(match.player1!.id)!;
      const p2 = players.get(match.player2!.id)!;
      p1.send({ type: 'ready_for_match', matchId: match.id });
      p2.send({ type: 'ready_for_match', matchId: match.id });
      const started = await p1.next('game_start', m => m.matchId === match.id && m.gameNumber === match.currentGame);
      await p2.next('game_start', m => m.matchId === match.id && m.gameNumber === match.currentGame);
      let state = criarEstadoInicial();
      expect(started.initialState).toEqual(state);
      await spectator.next('spectator_game_state', m => m.matchId === match.id && m.gameNumber === match.currentGame);
      const submit = (client: Participant, move: unknown) => client.send({ type: 'submit_move', matchId: match.id, gameNumber: match.currentGame, move });
      if (!checked) {
        const wrongPlayer = [...players.entries()].find(([id]) => id !== match.player1!.id && id !== match.player2!.id)![1];
        submit(wrongPlayer, toNetworkFaiscaMove(getJogadasValidas(state)[0]!));
        expect((await wrongPlayer.next('error')).code).toBe('NOT_YOUR_MATCH');
        submit(p2, toNetworkFaiscaMove(getJogadasValidas(state)[0]!));
        expect((await p2.next('error')).code).toBe('NOT_YOUR_TURN');
        p1.send({ type: 'submit_move', matchId: match.id, gameNumber: match.currentGame + 1, move: toNetworkFaiscaMove(getJogadasValidas(state)[0]!) });
        expect((await p1.next('error')).code).toBe('WRONG_GAME');
        for (const move of [null, {}, { row: 0, col: 0, distance: 3, direction: 'up' }, { row: 0, col: 0, distance: 1, direction: 'diagonal' }]) {
          submit(p1, move);
          expect((await p1.next('error')).code).toBe('INVALID_MOVE');
        }
        const snapshot = await exported();
        expect(matches(snapshot).find(m => m.id === match.id)!.gameState).toEqual(state);
      }
      let previousMove: unknown;
      while (state.estado === 'a-jogar') {
        const move = getJogadasValidas(state)[0]!;
        const mover = (state.jogadorAtual === 'jogador1') === started.youStart ? p1 : p2;
        if (previousMove && !checked && state.tabuleiro.flat().filter(Boolean).length === 2) {
          submit(mover, previousMove);
          expect((await mover.next('error')).code).toBe('INVALID_MOVE');
        }
        const networkMove = toNetworkFaiscaMove(move);
        submit(mover, networkMove);
        state = colocarPeca(state, move);
        const type = state.estado === 'a-jogar' ? 'game_state_update' : 'game_end';
        const one = await p1.next(type, m => m.matchId === match.id && m.gameNumber === match.currentGame);
        const two = await p2.next(type, m => m.matchId === match.id && m.gameNumber === match.currentGame);
        expect('gameState' in one ? one.gameState : one.finalState).toEqual(state);
        expect('gameState' in two ? two.gameState : two.finalState).toEqual(state);
        const observed = await spectator.next('spectator_game_state', m => m.matchId === match.id && m.gameNumber === match.currentGame);
        expect(observed.gameState).toEqual(state);
        if (!checked && state.tabuleiro.flat().filter(Boolean).length === 1) {
          previousMove = networkMove;
          const closed = new Promise<void>(resolve => p1.socket.addEventListener('close', () => resolve(), { once: true }));
          p1.socket.close();
          await closed;
          await p2.next('info', m => m.message.includes('pausado'));
          submit(p2, toNetworkFaiscaMove(getJogadasValidas(state)[0]!));
          expect((await p2.next('error')).code).toBe('MATCH_NOT_PLAYING');
          p1 = await connect();
          players.set(match.player1!.id, p1);
          p1.send({ type: 'rejoin_tournament', reconnectionCode: codes.get(match.player1!.id)! });
          await p1.next('welcome');
          const recovered = await p1.next('game_state_update');
          expect(recovered.gameState).toEqual(state);
          expect(recovered.gameNumber).toBe(match.currentGame);
          expect(recovered.yourTurn).toBe(false);
          await p2.next('game_state_update');
          // A refreshed tab can replace the connection before the old close arrives.
          const replacement = await connect();
          replacement.send({ type: 'rejoin_tournament', reconnectionCode: codes.get(match.player1!.id)! });
          await replacement.next('welcome');
          await replacement.next('match_assigned');
          expect((await replacement.next('game_state_update')).gameState).toEqual(state);
          p1 = replacement;
          players.set(match.player1!.id, p1);
          await p2.next('game_state_update');
        }
      }
      games++;
      checked = true;
    }
    const result = await exported();
    expect(result.phase).toBe('finished');
    // Existing admin export/import retains every board and tournament result.
    await api('tournaments/faisca/import', result);
    expect((await exported()).championId).toBe(result.championId);
  } finally {
    for (const client of sockets) client.socket.close();
    server.kill();
    await server.exited;
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
