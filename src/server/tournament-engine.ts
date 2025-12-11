/**
 * Motor de torneios com dupla eliminação.
 * 
 * Suporta:
 * - Qualquer número de jogadores (ímpar, primo, etc.)
 * - Byes automáticos quando necessário
 * - Winners e Losers brackets
 * - Grand Final com possível reset
 * - Confrontos melhor de 3
 */

import type {
  Player,
  Match,
  MatchScore,
  TournamentState,
  TournamentPhase,
  BracketType,
  GameId,
} from '../tournament/protocol';

// ============================================================================
// Tipos internos do motor
// ============================================================================

export interface TournamentPlayer extends Player {
  losses: number; // 0, 1 ou 2 (eliminado)
  isConnected: boolean;
  socketId: string | null;
}

export interface TournamentMatch extends Match {
  // Estado interno adicional
  player1Ready: boolean;
  player2Ready: boolean;
  gameState: unknown | null;
  whoseTurn: 'player1' | 'player2' | null;
  moves: Array<{ playerId: string; move: unknown; timestamp: Date }>;
}

export interface Tournament {
  id: string;
  gameId: GameId;
  phase: TournamentPhase;
  players: TournamentPlayer[];
  winnersMatches: TournamentMatch[];
  losersMatches: TournamentMatch[];
  grandFinal: TournamentMatch | null;
  grandFinalReset: TournamentMatch | null;
  championId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  
  // Índices para lookup rápido
  playerById: Map<string, TournamentPlayer>;
  matchById: Map<string, TournamentMatch>;
  
  // Rastreia jogadores a aguardar próximo match em cada bracket
  winnersWaiting: string[];
  losersWaiting: string[];
  
  // Contadores de rondas
  winnersRound: number;
  losersRound: number;
}

// ============================================================================
// Funções auxiliares
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// Criação de torneio
// ============================================================================

export function createTournament(gameId: GameId): Tournament {
  const id = generateId();
  return {
    id,
    gameId,
    phase: 'registration',
    players: [],
    winnersMatches: [],
    losersMatches: [],
    grandFinal: null,
    grandFinalReset: null,
    championId: null,
    createdAt: new Date(),
    startedAt: null,
    finishedAt: null,
    playerById: new Map(),
    matchById: new Map(),
    winnersWaiting: [],
    losersWaiting: [],
    winnersRound: 1,
    losersRound: 1,
  };
}

// ============================================================================
// Gestão de jogadores
// ============================================================================

export function addPlayer(
  tournament: Tournament,
  name: string,
  classId?: string,
  socketId?: string
): TournamentPlayer | null {
  if (tournament.phase !== 'registration') {
    return null;
  }

  const player: TournamentPlayer = {
    id: generateId(),
    name,
    classId,
    losses: 0,
    isConnected: true,
    socketId: socketId ?? null,
  };

  tournament.players.push(player);
  tournament.playerById.set(player.id, player);

  return player;
}

export function removePlayer(tournament: Tournament, playerId: string): boolean {
  if (tournament.phase !== 'registration') {
    return false;
  }

  const index = tournament.players.findIndex(p => p.id === playerId);
  if (index === -1) return false;

  tournament.players.splice(index, 1);
  tournament.playerById.delete(playerId);
  return true;
}

export function updatePlayerConnection(
  tournament: Tournament,
  playerId: string,
  isConnected: boolean,
  socketId?: string
): void {
  const player = tournament.playerById.get(playerId);
  if (player) {
    player.isConnected = isConnected;
    if (socketId !== undefined) {
      player.socketId = socketId;
    }
  }
}

// ============================================================================
// Criação de matches
// ============================================================================

function createMatch(
  bracket: BracketType,
  round: number,
  player1: TournamentPlayer | null,
  player2: TournamentPlayer | null
): TournamentMatch {
  return {
    id: generateId(),
    round,
    bracket,
    player1: player1 ? { id: player1.id, name: player1.name, classId: player1.classId } : null,
    player2: player2 ? { id: player2.id, name: player2.name, classId: player2.classId } : null,
    score: { player1Wins: 0, player2Wins: 0 },
    bestOf: 3,
    currentGame: 1,
    whoStartsCurrentGame: 'player1',
    phase: 'waiting',
    winnerId: null,
    player1Ready: false,
    player2Ready: false,
    gameState: null,
    whoseTurn: null,
    moves: [],
  };
}

// ============================================================================
// Início do torneio
// ============================================================================

export function startTournament(tournament: Tournament): boolean {
  if (tournament.phase !== 'registration') {
    return false;
  }

  if (tournament.players.length < 2) {
    return false;
  }

  tournament.phase = 'running';
  tournament.startedAt = new Date();

  // Baralha jogadores para emparelhamento aleatório
  const shuffledPlayers = shuffle(tournament.players);
  
  // Todos começam na winners bracket
  tournament.winnersWaiting = shuffledPlayers.map(p => p.id);
  
  // Cria os primeiros matches da winners bracket
  createNextRoundMatches(tournament, 'winners');

  return true;
}

// ============================================================================
// Gestão de rondas e emparelhamentos
// ============================================================================

function createNextRoundMatches(tournament: Tournament, bracket: BracketType): void {
  const waiting = bracket === 'winners' ? tournament.winnersWaiting : tournament.losersWaiting;
  
  if (waiting.length === 0) return;
  
  // Se só há 1 jogador a aguardar em cada bracket e é hora da final
  if (bracket === 'winners' && waiting.length === 1 && tournament.losersWaiting.length === 1) {
    createGrandFinal(tournament);
    return;
  }
  
  // Se só há 1 jogador e é a winners, espera pela losers
  if (waiting.length === 1) {
    return;
  }

  const round = bracket === 'winners' ? tournament.winnersRound : tournament.losersRound;
  const matches = bracket === 'winners' ? tournament.winnersMatches : tournament.losersMatches;

  // Emparelha jogadores
  const pairs: Array<[string, string | null]> = [];
  const playersCopy = [...waiting];
  
  while (playersCopy.length > 0) {
    const p1Id = playersCopy.shift()!;
    const p2Id = playersCopy.shift() ?? null; // null = bye
    pairs.push([p1Id, p2Id]);
  }

  // Limpa a lista de espera
  if (bracket === 'winners') {
    tournament.winnersWaiting = [];
  } else {
    tournament.losersWaiting = [];
  }

  // Cria matches para cada par
  for (const [p1Id, p2Id] of pairs) {
    const p1 = tournament.playerById.get(p1Id)!;
    const p2 = p2Id ? tournament.playerById.get(p2Id)! : null;

    if (!p2) {
      // Bye: jogador avança automaticamente
      if (bracket === 'winners') {
        tournament.winnersWaiting.push(p1Id);
      } else {
        tournament.losersWaiting.push(p1Id);
      }
      continue;
    }

    const match = createMatch(bracket, round, p1, p2);
    matches.push(match);
    tournament.matchById.set(match.id, match);
  }

  // Incrementa contador de ronda
  if (bracket === 'winners') {
    tournament.winnersRound++;
  } else {
    tournament.losersRound++;
  }

  // Verifica se precisamos criar matches na losers depois de criar na winners
  if (bracket === 'winners' && tournament.losersWaiting.length >= 2) {
    createNextRoundMatches(tournament, 'losers');
  }
}

function createGrandFinal(tournament: Tournament): void {
  if (tournament.winnersWaiting.length !== 1 || tournament.losersWaiting.length !== 1) {
    return;
  }

  const winnersChampionId = tournament.winnersWaiting[0];
  const losersChampionId = tournament.losersWaiting[0];

  const winnersChampion = tournament.playerById.get(winnersChampionId)!;
  const losersChampion = tournament.playerById.get(losersChampionId)!;

  // O campeão da winners é sempre player1 (vantagem de não ter perdido)
  tournament.grandFinal = createMatch('winners', 999, winnersChampion, losersChampion);
  tournament.matchById.set(tournament.grandFinal.id, tournament.grandFinal);

  // Limpa as listas de espera
  tournament.winnersWaiting = [];
  tournament.losersWaiting = [];
}

// ============================================================================
// Processamento de resultados de match
// ============================================================================

export function processMatchResult(
  tournament: Tournament,
  matchId: string,
  winnerId: string
): { 
  affectedPlayerIds: string[];
  newMatches: TournamentMatch[];
  isGrandFinal: boolean;
  isTournamentEnd: boolean;
} {
  const match = tournament.matchById.get(matchId);
  if (!match) {
    return { affectedPlayerIds: [], newMatches: [], isGrandFinal: false, isTournamentEnd: false };
  }

  const loserId = match.player1!.id === winnerId ? match.player2!.id : match.player1!.id;
  const winner = tournament.playerById.get(winnerId)!;
  const loser = tournament.playerById.get(loserId)!;

  match.winnerId = winnerId;
  match.phase = 'finished';

  const affectedPlayerIds = [winnerId, loserId];
  const newMatches: TournamentMatch[] = [];

  // Verifica se é a grand final
  if (tournament.grandFinal && tournament.grandFinal.id === matchId) {
    // Se o campeão da losers ganhou, precisa de reset
    if (winnerId === match.player2!.id) {
      // Campeão da losers ganhou - precisa de grand final reset
      tournament.grandFinalReset = createMatch('winners', 1000, winner, loser);
      tournament.matchById.set(tournament.grandFinalReset.id, tournament.grandFinalReset);
      newMatches.push(tournament.grandFinalReset);
      return { affectedPlayerIds, newMatches, isGrandFinal: true, isTournamentEnd: false };
    } else {
      // Campeão da winners ganhou - torneio termina
      tournament.championId = winnerId;
      tournament.phase = 'finished';
      tournament.finishedAt = new Date();
      return { affectedPlayerIds, newMatches, isGrandFinal: true, isTournamentEnd: true };
    }
  }

  // Verifica se é o grand final reset
  if (tournament.grandFinalReset && tournament.grandFinalReset.id === matchId) {
    tournament.championId = winnerId;
    tournament.phase = 'finished';
    tournament.finishedAt = new Date();
    return { affectedPlayerIds, newMatches, isGrandFinal: true, isTournamentEnd: true };
  }

  // Match normal: atualiza losses e brackets
  loser.losses++;

  if (match.bracket === 'winners') {
    // Vencedor continua na winners
    tournament.winnersWaiting.push(winnerId);
    
    // Perdedor vai para losers (se ainda não foi eliminado)
    if (loser.losses < 2) {
      tournament.losersWaiting.push(loserId);
    }
  } else {
    // Losers bracket
    // Vencedor continua na losers
    tournament.losersWaiting.push(winnerId);
    
    // Perdedor é eliminado (já tinha 1 derrota, agora tem 2)
    // Não precisa fazer nada, simplesmente não é adicionado a nenhuma lista
  }

  // Verifica se precisamos criar novos matches
  const allWinnersMatchesFinished = tournament.winnersMatches.every(m => m.phase === 'finished');
  const allLosersMatchesFinished = tournament.losersMatches.every(m => m.phase === 'finished');

  if (allWinnersMatchesFinished && tournament.winnersWaiting.length >= 2) {
    createNextRoundMatches(tournament, 'winners');
    newMatches.push(...tournament.winnersMatches.filter(m => m.phase === 'waiting'));
  }

  if (allLosersMatchesFinished && tournament.losersWaiting.length >= 2) {
    createNextRoundMatches(tournament, 'losers');
    newMatches.push(...tournament.losersMatches.filter(m => m.phase === 'waiting'));
  }

  // Verifica se é hora da grand final
  if (
    tournament.winnersWaiting.length === 1 &&
    tournament.losersWaiting.length === 1 &&
    !tournament.grandFinal
  ) {
    createGrandFinal(tournament);
    if (tournament.grandFinal) {
      newMatches.push(tournament.grandFinal);
    }
  }

  return { affectedPlayerIds, newMatches, isGrandFinal: false, isTournamentEnd: false };
}

// ============================================================================
// Gestão de jogos dentro de um match (melhor de 3)
// ============================================================================

export function setPlayerReady(
  tournament: Tournament,
  matchId: string,
  playerId: string
): { bothReady: boolean; match: TournamentMatch | null } {
  const match = tournament.matchById.get(matchId);
  if (!match || match.phase !== 'waiting') {
    return { bothReady: false, match: null };
  }

  if (match.player1?.id === playerId) {
    match.player1Ready = true;
  } else if (match.player2?.id === playerId) {
    match.player2Ready = true;
  } else {
    return { bothReady: false, match: null };
  }

  const bothReady = match.player1Ready && match.player2Ready;
  return { bothReady, match };
}

export function startGame(
  match: TournamentMatch,
  initialGameState: unknown
): void {
  match.phase = 'playing';
  match.gameState = initialGameState;
  match.player1Ready = false;
  match.player2Ready = false;
  match.moves = [];

  // Determina quem começa baseado no número do jogo
  // Jogo 1: player1, Jogo 2: player2, Jogo 3: player1
  match.whoStartsCurrentGame = match.currentGame % 2 === 1 ? 'player1' : 'player2';
  match.whoseTurn = match.whoStartsCurrentGame;
}

export function recordMove(
  match: TournamentMatch,
  playerId: string,
  move: unknown,
  newGameState: unknown
): void {
  match.moves.push({
    playerId,
    move,
    timestamp: new Date(),
  });
  match.gameState = newGameState;

  // Alterna a vez
  match.whoseTurn = match.whoseTurn === 'player1' ? 'player2' : 'player1';
}

export function endGame(
  match: TournamentMatch,
  winnerId: string
): { matchEnded: boolean; matchWinnerId: string | null } {
  // Atualiza o score
  if (match.player1?.id === winnerId) {
    match.score.player1Wins++;
  } else {
    match.score.player2Wins++;
  }

  // Verifica se o match terminou (melhor de 3 = primeiro a 2)
  const winsNeeded = Math.ceil(match.bestOf / 2);
  if (match.score.player1Wins >= winsNeeded) {
    return { matchEnded: true, matchWinnerId: match.player1!.id };
  }
  if (match.score.player2Wins >= winsNeeded) {
    return { matchEnded: true, matchWinnerId: match.player2!.id };
  }

  // Match continua, prepara próximo jogo
  match.currentGame++;
  match.phase = 'waiting';
  match.gameState = null;
  match.whoseTurn = null;

  return { matchEnded: false, matchWinnerId: null };
}

// ============================================================================
// Conversão para o formato do protocolo (para enviar aos clientes)
// ============================================================================

export function toTournamentState(tournament: Tournament): TournamentState {
  return {
    id: tournament.id,
    gameId: tournament.gameId,
    phase: tournament.phase,
    players: tournament.players.map(p => ({
      id: p.id,
      name: p.name,
      classId: p.classId,
    })),
    winnersMatches: tournament.winnersMatches.map(toProtocolMatch),
    losersMatches: tournament.losersMatches.map(toProtocolMatch),
    grandFinal: tournament.grandFinal ? toProtocolMatch(tournament.grandFinal) : null,
    grandFinalReset: tournament.grandFinalReset ? toProtocolMatch(tournament.grandFinalReset) : null,
    championId: tournament.championId,
  };
}

function toProtocolMatch(match: TournamentMatch): Match {
  return {
    id: match.id,
    round: match.round,
    bracket: match.bracket,
    player1: match.player1,
    player2: match.player2,
    score: match.score,
    bestOf: match.bestOf,
    currentGame: match.currentGame,
    whoStartsCurrentGame: match.whoStartsCurrentGame,
    phase: match.phase,
    winnerId: match.winnerId,
  };
}

// ============================================================================
// Utilitários para desconexão
// ============================================================================

export function handlePlayerDisconnect(
  tournament: Tournament,
  playerId: string
): { forfeitMatchId: string | null } {
  const player = tournament.playerById.get(playerId);
  if (!player) {
    return { forfeitMatchId: null };
  }

  player.isConnected = false;
  player.socketId = null;

  // Se o torneio não está a decorrer, não há nada a fazer
  if (tournament.phase !== 'running') {
    return { forfeitMatchId: null };
  }

  // Encontra match em curso onde este jogador está envolvido
  const activeMatch = [...tournament.winnersMatches, ...tournament.losersMatches]
    .concat(tournament.grandFinal ? [tournament.grandFinal] : [])
    .concat(tournament.grandFinalReset ? [tournament.grandFinalReset] : [])
    .find(m => 
      m.phase !== 'finished' && 
      (m.player1?.id === playerId || m.player2?.id === playerId)
    );

  if (activeMatch) {
    return { forfeitMatchId: activeMatch.id };
  }

  return { forfeitMatchId: null };
}

export function forfeitMatch(
  tournament: Tournament,
  matchId: string,
  forfeitingPlayerId: string
): string | null {
  const match = tournament.matchById.get(matchId);
  if (!match || match.phase === 'finished') {
    return null;
  }

  // O vencedor é o outro jogador
  const winnerId = match.player1?.id === forfeitingPlayerId 
    ? match.player2?.id 
    : match.player1?.id;

  if (!winnerId) {
    return null;
  }

  // Dá vitória ao outro jogador (2-0 automático)
  match.score = match.player1?.id === winnerId 
    ? { player1Wins: 2, player2Wins: 0 }
    : { player1Wins: 0, player2Wins: 2 };

  return winnerId;
}