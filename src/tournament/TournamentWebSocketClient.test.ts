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
