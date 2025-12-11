/**
 * Tests for protocol types and helpers.
 * Validates that the types match CLIENT-INTEGRATION_NEW.md specification.
 */

import { describe, test, expect } from 'bun:test';
import type {
  Player,
  TournamentState,
  Match,
  MatchSummary,
  WelcomeMessage,
  TournamentStateUpdateMessage,
  MatchAssignedMessage,
  GameStartMessage,
  GameStateUpdateMessage,
  GameEndMessage,
  MatchEndMessage,
  TournamentEndMessage,
} from './protocol';
import { tournamentStateFromUpdate } from './protocol';

describe('Protocol Types', () => {
  test('Player type matches NEW spec with isOnline and isBot', () => {
    const player: Player = {
      id: 'p1',
      name: 'João',
      classId: '5ºA',
      isOnline: true,
      isBot: false,
    };
    
    expect(player.id).toBe('p1');
    expect(player.name).toBe('João');
    expect(player.classId).toBe('5ºA');
    expect(player.isOnline).toBe(true);
    expect(player.isBot).toBe(false);
  });

  test('Player type supports bot players', () => {
    const bot: Player = {
      id: 'bot1',
      name: 'Bot Ana',
      isOnline: true,
      isBot: true,
    };
    
    expect(bot.isBot).toBe(true);
    expect(bot.isOnline).toBe(true);
  });

  test('TournamentState uses tournamentId and championName', () => {
    const state: TournamentState = {
      tournamentId: 't1',
      gameId: 'gatos-caes',
      phase: 'registration',
      players: [],
      winnersMatches: [],
      losersMatches: [],
      grandFinal: null,
      grandFinalReset: null,
      championId: null,
      championName: null,
    };
    
    expect(state.tournamentId).toBe('t1');
    expect(state.championName).toBeNull();
  });

  test('MatchSummary has correct structure', () => {
    const match: MatchSummary = {
      id: 'm1',
      round: 1,
      bracket: 'winners',
      player1: { id: 'p1', name: 'João' },
      player2: { id: 'p2', name: 'Maria' },
      score: { player1Wins: 1, player2Wins: 0 },
      phase: 'playing',
      winnerId: null,
    };
    
    expect(match.player1?.name).toBe('João');
    expect(match.score.player1Wins).toBe(1);
  });
});

describe('Server Messages', () => {
  test('WelcomeMessage includes playerName and tournamentId', () => {
    const msg: WelcomeMessage = {
      type: 'welcome',
      playerId: 'p1',
      playerName: 'João',
      tournamentId: 't1',
      tournamentState: {
        tournamentId: 't1',
        gameId: 'gatos-caes',
        phase: 'registration',
        players: [],
        winnersMatches: [],
        losersMatches: [],
        grandFinal: null,
        grandFinalReset: null,
        championId: null,
        championName: null,
      },
    };
    
    expect(msg.playerName).toBe('João');
    expect(msg.tournamentId).toBe('t1');
  });

  test('TournamentStateUpdateMessage has flat structure', () => {
    const msg: TournamentStateUpdateMessage = {
      type: 'tournament_state_update',
      tournamentId: 't1',
      gameId: 'dominorio',
      phase: 'running',
      players: [
        { id: 'p1', name: 'João', isOnline: true },
        { id: 'p2', name: 'Maria', isOnline: true, isBot: true },
      ],
      winnersMatches: [],
      losersMatches: [],
      grandFinal: null,
      grandFinalReset: null,
      championId: null,
      championName: null,
    };
    
    expect(msg.gameId).toBe('dominorio');
    expect(msg.players).toHaveLength(2);
    expect(msg.players[1].isBot).toBe(true);
  });

  test('MatchAssignedMessage includes opponentName', () => {
    const msg: MatchAssignedMessage = {
      type: 'match_assigned',
      match: {
        id: 'm1',
        round: 1,
        bracket: 'winners',
        player1: { id: 'p1', name: 'João' },
        player2: { id: 'p2', name: 'Maria' },
        score: { player1Wins: 0, player2Wins: 0 },
        phase: 'waiting',
        winnerId: null,
      },
      yourRole: 'player1',
      opponentName: 'Maria',
    };
    
    expect(msg.opponentName).toBe('Maria');
    expect(msg.yourRole).toBe('player1');
  });

  test('GameStartMessage includes yourRole', () => {
    const msg: GameStartMessage = {
      type: 'game_start',
      matchId: 'm1',
      gameNumber: 1,
      youStart: true,
      initialState: {},
      yourRole: 'player1',
    };
    
    expect(msg.yourRole).toBe('player1');
    expect(msg.youStart).toBe(true);
  });

  test('GameStateUpdateMessage includes lastMoveBy', () => {
    const msg: GameStateUpdateMessage = {
      type: 'game_state_update',
      matchId: 'm1',
      gameNumber: 1,
      gameState: {},
      yourTurn: false,
      lastMove: { row: 0, col: 0 },
      lastMoveBy: 'player1',
    };
    
    expect(msg.lastMoveBy).toBe('player1');
  });

  test('GameEndMessage includes winnerRole, isDraw, and matchScore', () => {
    const msg: GameEndMessage = {
      type: 'game_end',
      matchId: 'm1',
      gameNumber: 2,
      winnerId: 'p1',
      winnerRole: 'player1',
      isDraw: false,
      finalState: {},
      matchScore: { player1Wins: 2, player2Wins: 0 },
    };
    
    expect(msg.winnerRole).toBe('player1');
    expect(msg.isDraw).toBe(false);
    expect(msg.matchScore.player1Wins).toBe(2);
  });

  test('GameEndMessage handles draw', () => {
    const msg: GameEndMessage = {
      type: 'game_end',
      matchId: 'm1',
      gameNumber: 1,
      winnerId: null,
      winnerRole: null,
      isDraw: true,
      finalState: {},
      matchScore: { player1Wins: 0, player2Wins: 0 },
    };
    
    expect(msg.winnerId).toBeNull();
    expect(msg.winnerRole).toBeNull();
    expect(msg.isDraw).toBe(true);
  });

  test('MatchEndMessage includes winnerName and eliminatedFromTournament', () => {
    const msg: MatchEndMessage = {
      type: 'match_end',
      matchId: 'm1',
      winnerId: 'p1',
      winnerName: 'João',
      finalScore: { player1Wins: 2, player2Wins: 1 },
      youWon: true,
      eliminatedFromTournament: false,
    };
    
    expect(msg.winnerName).toBe('João');
    expect(msg.eliminatedFromTournament).toBe(false);
  });

  test('MatchEndMessage supports nextMatchId', () => {
    const msg: MatchEndMessage = {
      type: 'match_end',
      matchId: 'm1',
      winnerId: 'p1',
      winnerName: 'João',
      finalScore: { player1Wins: 2, player2Wins: 0 },
      youWon: true,
      nextMatchId: 'm2',
      eliminatedFromTournament: false,
    };
    
    expect(msg.nextMatchId).toBe('m2');
  });

  test('TournamentEndMessage includes tournamentId and finalStandings format', () => {
    const msg: TournamentEndMessage = {
      type: 'tournament_end',
      tournamentId: 't1',
      championId: 'p1',
      championName: 'João',
      finalStandings: [
        { rank: 1, playerId: 'p1', playerName: 'João' },
        { rank: 2, playerId: 'p2', playerName: 'Maria' },
      ],
    };
    
    expect(msg.tournamentId).toBe('t1');
    expect(msg.finalStandings[0].rank).toBe(1);
    expect(msg.finalStandings[0].playerId).toBe('p1');
    expect(msg.finalStandings[0].playerName).toBe('João');
  });
});

describe('tournamentStateFromUpdate', () => {
  test('converts TournamentStateUpdateMessage to TournamentState', () => {
    const msg: TournamentStateUpdateMessage = {
      type: 'tournament_state_update',
      tournamentId: 't1',
      gameId: 'quelhas',
      phase: 'running',
      players: [
        { id: 'p1', name: 'João', isOnline: true },
      ],
      winnersMatches: [],
      losersMatches: [],
      grandFinal: null,
      grandFinalReset: null,
      championId: null,
      championName: null,
    };
    
    const state = tournamentStateFromUpdate(msg);
    
    expect(state.tournamentId).toBe('t1');
    expect(state.gameId).toBe('quelhas');
    expect(state.phase).toBe('running');
    expect(state.players).toHaveLength(1);
    expect(state.championId).toBeNull();
  });
});
