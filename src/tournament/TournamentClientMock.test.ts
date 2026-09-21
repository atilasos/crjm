import { expect, test } from 'bun:test';
import { TournamentClientMock } from './TournamentClientMock';
import type { MatchAssignedMessage } from './protocol';

test('mock match assignments include series and starting-seat metadata', async () => {
  const client = new TournamentClientMock();
  const assigned = Promise.withResolvers<MatchAssignedMessage>();
  client.setEventHandlers({ onMessage(message) {
    if (message.type === 'match_assigned') assigned.resolve(message);
  } });
  try {
    await client.connect('mock');
    client.send({ type: 'join_tournament', gameId: 'nex', playerName: 'Tester' });
    const message = await assigned.promise;
    expect(message.match.currentGame).toBe(1);
    expect(message.match.bestOf).toBe(3);
    expect(message.match.whoStartsCurrentGame).toBe('player1');
    expect(message.match.player1?.id).not.toBe(message.match.player2?.id);
    expect(message.yourRole === 'player1' || message.yourRole === 'player2').toBe(true);
  } finally { client.disconnect(); }
}, 10000);
