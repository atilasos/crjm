import { describe, test, expect } from 'bun:test';
import {
  createTournament,
  addPlayer,
  startTournament,
  processMatchResult,
  toTournamentState,
  setPlayerReady,
  startGame,
  endGame,
  restartCurrentGame,
  restartMatch,
  getActiveMatchesWithGameState,
  type Tournament,
} from './tournament-engine';

describe('Tournament Engine - Bracket Generation', () => {
  // Helper to add multiple players
  function addPlayers(tournament: Tournament, count: number): string[] {
    const ids: string[] = [];
    for (let i = 1; i <= count; i++) {
      const player = addPlayer(tournament, `Player ${i}`);
      if (player) ids.push(player.id);
    }
    return ids;
  }

  // Helper to get active matches (not finished)
  function getActiveMatches(tournament: Tournament) {
    return [
      ...tournament.winnersMatches.filter(m => m.phase !== 'finished'),
      ...tournament.losersMatches.filter(m => m.phase !== 'finished'),
    ];
  }

  test('4 players - basic bracket creation', () => {
    const tournament = createTournament('gatos-caes');
    const playerIds = addPlayers(tournament, 4);

    expect(playerIds.length).toBe(4);
    expect(startTournament(tournament)).toBe(true);

    // Should create 2 matches in winners bracket round 1
    expect(tournament.winnersMatches.length).toBe(2);
    expect(tournament.losersMatches.length).toBe(0);
    expect(tournament.grandFinal).toBeNull();
  });

  test('3 players - one bye in first round', () => {
    const tournament = createTournament('gatos-caes');
    const playerIds = addPlayers(tournament, 3);

    startTournament(tournament);

    // With 3 players: 1 match + 1 bye
    // One player advances automatically with bye
    expect(tournament.winnersMatches.length).toBe(1);
    expect(tournament.winnersWaiting.length).toBe(1); // Player with bye
  });

  test('5 players - two byes to make even brackets', () => {
    const tournament = createTournament('gatos-caes');
    addPlayers(tournament, 5);

    startTournament(tournament);

    // With 5 players: 2 matches + 1 bye
    expect(tournament.winnersMatches.length).toBe(2);
    expect(tournament.winnersWaiting.length).toBe(1); // Player with bye
  });

  test('4 players - full tournament flow', () => {
    const tournament = createTournament('gatos-caes');
    addPlayers(tournament, 4);
    startTournament(tournament);

    // Round 1 Winners: Match 1 and Match 2
    const [match1, match2] = tournament.winnersMatches;
    const m1Winner = match1.player1!.id;
    const m1Loser = match1.player2!.id;
    const m2Winner = match2.player1!.id;
    const m2Loser = match2.player2!.id;

    // Complete Match 1
    processMatchResult(tournament, match1.id, m1Winner);

    // After first match, winner and loser should be waiting
    // (no new matches created yet since Match 2 is still in progress)
    expect(tournament.winnersWaiting).toContain(m1Winner);
    expect(tournament.losersWaiting).toContain(m1Loser);
    expect(tournament.grandFinal).toBeNull(); // Should NOT create grand final yet!

    // Complete Match 2
    processMatchResult(tournament, match2.id, m2Winner);

    // Should have created Round 2 Winners and Round 1 Losers
    expect(tournament.winnersMatches.length).toBe(3); // 2 R1 + 1 R2
    expect(tournament.losersMatches.length).toBe(1);

    // Winners Final (Match 3)
    const winnersFinal = tournament.winnersMatches.find(m => m.phase === 'waiting')!;
    processMatchResult(tournament, winnersFinal.id, m1Winner);

    // Losers Round 1 (Match 4)
    const losersR1 = tournament.losersMatches.find(m => m.phase === 'waiting')!;
    processMatchResult(tournament, losersR1.id, m1Loser);

    // Should have created Losers Final (m2Winner dropped + m1Loser advanced)
    expect(tournament.losersMatches.length).toBe(2);

    // Losers Final
    const losersFinal = tournament.losersMatches.find(m => m.phase === 'waiting')!;
    processMatchResult(tournament, losersFinal.id, m1Loser);

    // Now Grand Final should exist
    expect(tournament.grandFinal).not.toBeNull();
    expect(tournament.grandFinal!.player1!.id).toBe(m1Winner); // Winners champion
    expect(tournament.grandFinal!.player2!.id).toBe(m1Loser); // Losers champion
  });

  test('Grand Final should NOT be created while losers matches are in progress', () => {
    const tournament = createTournament('gatos-caes');
    addPlayers(tournament, 4);
    startTournament(tournament);

    const [match1, match2] = tournament.winnersMatches;
    const m1Winner = match1.player1!.id;
    const m1Loser = match1.player2!.id;
    const m2Winner = match2.player1!.id;
    const m2Loser = match2.player2!.id;

    // Complete both round 1 matches
    processMatchResult(tournament, match1.id, m1Winner);
    processMatchResult(tournament, match2.id, m2Winner);

    // Now we have Winners Final and Losers R1
    const winnersFinal = tournament.winnersMatches.find(m => m.phase === 'waiting')!;
    const losersR1 = tournament.losersMatches.find(m => m.phase === 'waiting')!;

    expect(winnersFinal).toBeDefined();
    expect(losersR1).toBeDefined();

    // Complete Winners Final BEFORE Losers R1
    processMatchResult(tournament, winnersFinal.id, m1Winner);

    // At this point:
    // - Winners bracket has a champion (m1Winner in winnersWaiting)
    // - m2Winner dropped to losers
    // - Losers R1 is STILL IN PROGRESS

    // Grand Final should NOT exist yet because losers bracket isn't done
    const activeMatches = getActiveMatches(tournament);
    expect(activeMatches.length).toBeGreaterThan(0);
    expect(tournament.grandFinal).toBeNull(); // This is the key assertion

    // Now complete losers R1
    processMatchResult(tournament, losersR1.id, m1Loser);

    // Now we need losers final (m2Winner who dropped vs m1Loser who won losers R1)
    const losersFinal = tournament.losersMatches.find(m => m.phase === 'waiting');
    expect(losersFinal).toBeDefined();
    expect(tournament.grandFinal).toBeNull(); // Still shouldn't exist

    // Complete losers final
    processMatchResult(tournament, losersFinal!.id, m1Loser);

    // NOW Grand Final should exist
    expect(tournament.grandFinal).not.toBeNull();
    expect(tournament.grandFinal!.player1!.id).toBe(m1Winner); // Winners champion
    expect(tournament.grandFinal!.player2!.id).toBe(m1Loser); // Losers champion
  });

  test('Grand Final Reset when losers champion wins', () => {
    const tournament = createTournament('gatos-caes');
    addPlayers(tournament, 2);
    startTournament(tournament);

    // Only 1 match in winners bracket
    const match = tournament.winnersMatches[0];
    const winnersChamp = match.player1!.id;
    const losersChamp = match.player2!.id;

    // Player 1 wins winners bracket
    processMatchResult(tournament, match.id, winnersChamp);

    // Grand Final should exist immediately (only 2 players)
    expect(tournament.grandFinal).not.toBeNull();
    expect(tournament.grandFinal!.player1!.id).toBe(winnersChamp);
    expect(tournament.grandFinal!.player2!.id).toBe(losersChamp);

    // Losers champion wins Grand Final
    processMatchResult(tournament, tournament.grandFinal!.id, losersChamp);

    // Grand Final Reset should exist
    expect(tournament.grandFinalReset).not.toBeNull();
    expect(tournament.phase).toBe('running');

    // Winners champion wins the reset
    processMatchResult(tournament, tournament.grandFinalReset!.id, winnersChamp);

    // Tournament should be finished
    expect(tournament.phase).toBe('finished');
    expect(tournament.championId).toBe(winnersChamp);
  });

  test('2 players - simplest tournament', () => {
    const tournament = createTournament('gatos-caes');
    addPlayers(tournament, 2);
    startTournament(tournament);

    expect(tournament.winnersMatches.length).toBe(1);

    const match = tournament.winnersMatches[0];
    const winner = match.player1!.id;

    processMatchResult(tournament, match.id, winner);

    // With 2 players, after 1 match we go straight to Grand Final
    expect(tournament.grandFinal).not.toBeNull();
  });

  test('8 players - power of 2, no byes', () => {
    const tournament = createTournament('gatos-caes');
    addPlayers(tournament, 8);
    startTournament(tournament);

    // Round 1: 4 matches
    expect(tournament.winnersMatches.length).toBe(4);
    expect(tournament.winnersWaiting.length).toBe(0); // No byes
  });

  test('Players lose count correctly through brackets', () => {
    const tournament = createTournament('gatos-caes');
    addPlayers(tournament, 4);
    startTournament(tournament);

    const [match1, match2] = tournament.winnersMatches;
    const loserId = match1.player2!.id;

    // Before any match
    const loserBefore = tournament.playerById.get(loserId)!;
    expect(loserBefore.losses).toBe(0);

    // Lose in winners bracket
    processMatchResult(tournament, match1.id, match1.player1!.id);
    expect(tournament.playerById.get(loserId)!.losses).toBe(1);

    // Complete match2 to create losers bracket
    processMatchResult(tournament, match2.id, match2.player1!.id);

    // Find and complete losers match where our player is
    const losersMatch = tournament.losersMatches.find(
      m => m.player1?.id === loserId || m.player2?.id === loserId
    );

    if (losersMatch) {
      const winnerId = losersMatch.player1?.id === loserId
        ? losersMatch.player2!.id
        : losersMatch.player1!.id;

      processMatchResult(tournament, losersMatch.id, winnerId);

      // After losing in losers bracket
      expect(tournament.playerById.get(loserId)!.losses).toBe(2);
    }
  });
});

describe('Tournament Engine - Edge Cases', () => {
  test('Cannot start tournament with less than 2 players', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Solo Player');

    expect(startTournament(tournament)).toBe(false);
    expect(tournament.phase).toBe('registration');
  });

  test('Cannot add players after tournament starts', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');
    startTournament(tournament);

    const newPlayer = addPlayer(tournament, 'Late Player');
    expect(newPlayer).toBeNull();
  });

  test('Cannot start tournament twice', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');

    expect(startTournament(tournament)).toBe(true);
    expect(startTournament(tournament)).toBe(false);
  });
});

describe('Tournament Engine - Restart Functions', () => {
  test('restartCurrentGame - preserves match score, resets game state', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');
    startTournament(tournament);

    const match = tournament.winnersMatches[0];
    const p1Id = match.player1!.id;
    const p2Id = match.player2!.id;

    // Set both players ready and start game
    setPlayerReady(tournament, match.id, p1Id);
    setPlayerReady(tournament, match.id, p2Id);
    startGame(match, { someState: 'initial' });

    // Simulate player 1 winning first game
    match.score.player1Wins = 1;
    match.currentGame = 2;
    match.gameState = { someState: 'game2' };
    match.phase = 'playing';

    // Restart current game
    const result = restartCurrentGame(tournament, match.id);

    expect(result.success).toBe(true);
    expect(match.score.player1Wins).toBe(1); // Score preserved
    expect(match.score.player2Wins).toBe(0);
    expect(match.currentGame).toBe(2); // Same game number
    expect(match.gameState).toBeNull(); // Game state cleared
    expect(match.phase).toBe('waiting'); // Back to waiting
    expect(match.player1Ready).toBe(false);
    expect(match.player2Ready).toBe(false);
  });

  test('restartMatch - resets score to 0-0 and game to 1', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');
    startTournament(tournament);

    const match = tournament.winnersMatches[0];
    const p1Id = match.player1!.id;
    const p2Id = match.player2!.id;

    // Set both players ready and start game
    setPlayerReady(tournament, match.id, p1Id);
    setPlayerReady(tournament, match.id, p2Id);
    startGame(match, { someState: 'initial' });

    // Simulate ongoing match with score 1-1
    match.score.player1Wins = 1;
    match.score.player2Wins = 1;
    match.currentGame = 3;
    match.gameState = { someState: 'game3' };
    match.phase = 'playing';

    // Restart entire match
    const result = restartMatch(tournament, match.id);

    expect(result.success).toBe(true);
    expect(match.score.player1Wins).toBe(0); // Score reset
    expect(match.score.player2Wins).toBe(0);
    expect(match.currentGame).toBe(1); // Back to game 1
    expect(match.gameState).toBeNull(); // Game state cleared
    expect(match.phase).toBe('waiting'); // Back to waiting
    expect(match.winnerId).toBeNull(); // No winner yet
  });

  test('restart fails on finished match', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');
    startTournament(tournament);

    const match = tournament.winnersMatches[0];
    
    // Mark match as finished
    match.phase = 'finished';
    match.winnerId = match.player1!.id;

    // Try to restart
    const gameResult = restartCurrentGame(tournament, match.id);
    const matchResult = restartMatch(tournament, match.id);

    expect(gameResult.success).toBe(false);
    expect(gameResult.error).toBe('Match já terminou');
    expect(matchResult.success).toBe(false);
    expect(matchResult.error).toBe('Match já terminou');
  });

  test('restart fails when tournament not running', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');
    // Don't start tournament

    // Try to restart non-existent match
    const gameResult = restartCurrentGame(tournament, 'fake-match-id');
    const matchResult = restartMatch(tournament, 'fake-match-id');

    expect(gameResult.success).toBe(false);
    expect(gameResult.error).toBe('Torneio não está a decorrer');
    expect(matchResult.success).toBe(false);
    expect(matchResult.error).toBe('Torneio não está a decorrer');
  });

  test('restartMatch preserves bracket position', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');
    startTournament(tournament);

    const match = tournament.winnersMatches[0];
    const originalBracket = match.bracket;
    const originalRound = match.round;
    const originalP1 = match.player1;
    const originalP2 = match.player2;

    // Modify match state
    match.score.player1Wins = 1;
    match.currentGame = 2;

    // Restart match
    restartMatch(tournament, match.id);

    // Verify bracket/players preserved
    expect(match.bracket).toBe(originalBracket);
    expect(match.round).toBe(originalRound);
    expect(match.player1).toEqual(originalP1);
    expect(match.player2).toEqual(originalP2);
  });
});

describe('Tournament Engine - Spectator Functions', () => {
  test('getActiveMatchesWithGameState returns playing matches with game state', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');
    addPlayer(tournament, 'Player 3');
    addPlayer(tournament, 'Player 4');
    startTournament(tournament);

    // Initially no active matches (all in waiting)
    let active = getActiveMatchesWithGameState(tournament);
    expect(active.length).toBe(0);

    // Start first match
    const match1 = tournament.winnersMatches[0];
    const p1Id = match1.player1!.id;
    const p2Id = match1.player2!.id;

    setPlayerReady(tournament, match1.id, p1Id);
    setPlayerReady(tournament, match1.id, p2Id);
    startGame(match1, { board: 'test-state' });

    // Now should have 1 active match
    active = getActiveMatchesWithGameState(tournament);
    expect(active.length).toBe(1);
    expect(active[0].match.id).toBe(match1.id);
    expect(active[0].gameState).toEqual({ board: 'test-state' });

    // Start second match
    const match2 = tournament.winnersMatches[1];
    const p3Id = match2.player1!.id;
    const p4Id = match2.player2!.id;

    setPlayerReady(tournament, match2.id, p3Id);
    setPlayerReady(tournament, match2.id, p4Id);
    startGame(match2, { board: 'test-state-2' });

    // Now should have 2 active matches
    active = getActiveMatchesWithGameState(tournament);
    expect(active.length).toBe(2);
  });

  test('getActiveMatchesWithGameState excludes matches without game state', () => {
    const tournament = createTournament('gatos-caes');
    addPlayer(tournament, 'Player 1');
    addPlayer(tournament, 'Player 2');
    startTournament(tournament);

    const match = tournament.winnersMatches[0];
    
    // Set phase to playing but no game state
    match.phase = 'playing';
    match.gameState = null;

    const active = getActiveMatchesWithGameState(tournament);
    expect(active.length).toBe(0);
  });
});
