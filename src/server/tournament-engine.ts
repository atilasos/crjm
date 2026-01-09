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

export type PlayerStatus = 'active' | 'suspended' | 'eliminated';

export interface TournamentPlayer extends Player {
  losses: number; // 0, 1 ou 2 (eliminado)
  isConnected: boolean;
  socketId: string | null;
  // Campos para reconexão
  reconnectionCode: string;           // Código único 6 caracteres (ex: ABC234)
  status: PlayerStatus;               // Estado do jogador
  suspendedAt: Date | null;           // Quando foi suspenso
  suspendedMatchId: string | null;    // Match pausado (se houver)
}

export interface TournamentMatch extends Match {
  // Estado interno adicional
  player1Ready: boolean;
  player2Ready: boolean;
  gameState: unknown | null;
  whoseTurn: 'player1' | 'player2' | null;
  moves: Array<{ playerId: string; move: unknown; timestamp: Date }>;
  // Campos para pausa por desconexão
  isPaused: boolean;
  pausedAt: Date | null;
  pausedByPlayerId: string | null;
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
  playerByCode: Map<string, TournamentPlayer>; // Índice por código de reconexão

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

/**
 * Gera código de reconexão amigável: 3 letras + 3 números.
 * Exclui caracteres confusos (O, I, 0, 1).
 */
function generateReconnectionCode(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // Sem O, I
  const numbers = '23456789';                 // Sem 0, 1
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 3; i++) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }
  return code;
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
    playerByCode: new Map(),
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

  // Gera código único (verifica colisões)
  let reconnectionCode: string;
  do {
    reconnectionCode = generateReconnectionCode();
  } while (tournament.playerByCode.has(reconnectionCode));

  const player: TournamentPlayer = {
    id: generateId(),
    name,
    classId,
    losses: 0,
    isConnected: true,
    socketId: socketId ?? null,
    reconnectionCode,
    status: 'active',
    suspendedAt: null,
    suspendedMatchId: null,
  };

  tournament.players.push(player);
  tournament.playerById.set(player.id, player);
  tournament.playerByCode.set(reconnectionCode, player);

  return player;
}

export function removePlayer(tournament: Tournament, playerId: string): boolean {
  if (tournament.phase !== 'registration') {
    return false;
  }

  const player = tournament.playerById.get(playerId);
  if (!player) return false;

  const index = tournament.players.findIndex(p => p.id === playerId);
  if (index === -1) return false;

  tournament.players.splice(index, 1);
  tournament.playerById.delete(playerId);
  tournament.playerByCode.delete(player.reconnectionCode);
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
    isPaused: false,
    pausedAt: null,
    pausedByPlayerId: null,
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

  // MELHORIA: Criar matches assim que há 2 jogadores disponíveis (não esperar todos terminarem)
  // Isto reduz significativamente o tempo de espera para os jogadores

  // Winners bracket: criar matches imediatos
  // Incrementar ronda para cada novo match criado (após a ronda inicial)
  const hasExistingWinnersMatches = tournament.winnersMatches.length > 0;
  let winnersMatchesCreated = 0;

  while (tournament.winnersWaiting.length >= 2) {
    const p1Id = tournament.winnersWaiting.shift()!;
    const p2Id = tournament.winnersWaiting.shift()!;
    const p1 = tournament.playerById.get(p1Id)!;
    const p2 = tournament.playerById.get(p2Id)!;

    // Incrementar ronda se já existem matches e é um novo ciclo
    if (hasExistingWinnersMatches && winnersMatchesCreated === 0) {
      tournament.winnersRound++;
    }

    const newMatch = createMatch('winners', tournament.winnersRound, p1, p2);
    tournament.winnersMatches.push(newMatch);
    tournament.matchById.set(newMatch.id, newMatch);
    newMatches.push(newMatch);
    winnersMatchesCreated++;
  }

  // Losers bracket: criar matches imediatos
  // Incrementar ronda para cada novo match criado (após a ronda inicial)
  const hasExistingLosersMatches = tournament.losersMatches.length > 0;
  let losersMatchesCreated = 0;

  while (tournament.losersWaiting.length >= 2) {
    const p1Id = tournament.losersWaiting.shift()!;
    const p2Id = tournament.losersWaiting.shift()!;
    const p1 = tournament.playerById.get(p1Id)!;
    const p2 = tournament.playerById.get(p2Id)!;

    // Incrementar ronda se já existem matches e é um novo ciclo
    if (hasExistingLosersMatches && losersMatchesCreated === 0) {
      tournament.losersRound++;
    }

    const newMatch = createMatch('losers', tournament.losersRound, p1, p2);
    tournament.losersMatches.push(newMatch);
    tournament.matchById.set(newMatch.id, newMatch);
    newMatches.push(newMatch);
    losersMatchesCreated++;
  }

  // Verifica se é hora da grand final
  // Só cria quando há exatamente 1 jogador em cada bracket e não há mais matches em curso
  const allWinnersMatchesFinished = tournament.winnersMatches.every(m => m.phase === 'finished');
  const allLosersMatchesFinished = tournament.losersMatches.every(m => m.phase === 'finished');

  if (
    tournament.winnersWaiting.length === 1 &&
    tournament.losersWaiting.length === 1 &&
    !tournament.grandFinal &&
    allWinnersMatchesFinished &&
    allLosersMatchesFinished
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
  newGameState: unknown,
  nextTurn: 'player1' | 'player2'
): void {
  match.moves.push({
    playerId,
    move,
    timestamp: new Date(),
  });
  match.gameState = newGameState;

  // Define a vez baseada no argumento
  match.whoseTurn = nextTurn;
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
  const champion = tournament.championId
    ? tournament.playerById.get(tournament.championId)
    : null;

  return {
    tournamentId: tournament.id,
    gameId: tournament.gameId,
    phase: tournament.phase,
    players: tournament.players.map(p => ({
      id: p.id,
      name: p.name,
      classId: p.classId,
      isOnline: p.isConnected,
      status: p.status,
      reconnectionCode: p.reconnectionCode,
    })),
    winnersMatches: tournament.winnersMatches.map(toProtocolMatch),
    losersMatches: tournament.losersMatches.map(toProtocolMatch),
    grandFinal: tournament.grandFinal ? toProtocolMatch(tournament.grandFinal) : null,
    grandFinalReset: tournament.grandFinalReset ? toProtocolMatch(tournament.grandFinalReset) : null,
    championId: tournament.championId,
    championName: champion?.name ?? null,
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
// Utilitários para reconexão e gestão de jogadores
// ============================================================================

/**
 * Encontra jogador pelo código de reconexão.
 */
export function findPlayerByCode(
  tournament: Tournament,
  code: string
): TournamentPlayer | null {
  const normalizedCode = code.toUpperCase().trim();
  return tournament.playerByCode.get(normalizedCode) ?? null;
}

/**
 * Encontra o match ativo onde o jogador está envolvido.
 */
export function findActiveMatchForPlayer(
  tournament: Tournament,
  playerId: string
): TournamentMatch | null {
  return [...tournament.winnersMatches, ...tournament.losersMatches]
    .concat(tournament.grandFinal ? [tournament.grandFinal] : [])
    .concat(tournament.grandFinalReset ? [tournament.grandFinalReset] : [])
    .find(m =>
      m.phase !== 'finished' &&
      (m.player1?.id === playerId || m.player2?.id === playerId)
    ) ?? null;
}

/**
 * Pausa um match devido a desconexão de jogador.
 */
export function pauseMatch(
  tournament: Tournament,
  matchId: string,
  byPlayerId: string
): void {
  const match = tournament.matchById.get(matchId);
  if (!match || match.phase === 'finished') return;

  match.isPaused = true;
  match.pausedAt = new Date();
  match.pausedByPlayerId = byPlayerId;
}

/**
 * Retoma um match que estava pausado.
 */
export function resumeMatch(
  tournament: Tournament,
  matchId: string
): void {
  const match = tournament.matchById.get(matchId);
  if (!match || !match.isPaused) return;

  match.isPaused = false;
  match.pausedAt = null;
  match.pausedByPlayerId = null;
}

/**
 * Suspende um jogador (desconectado mas pode voltar).
 * Se estiver num match ativo, pausa o match em vez de forfeit.
 */
export function suspendPlayer(
  tournament: Tournament,
  playerId: string
): { pausedMatchId: string | null } {
  const player = tournament.playerById.get(playerId);
  if (!player) return { pausedMatchId: null };

  player.status = 'suspended';
  player.suspendedAt = new Date();
  player.isConnected = false;

  // Se está em match ativo, pausar em vez de forfeit
  if (tournament.phase === 'running') {
    const activeMatch = findActiveMatchForPlayer(tournament, playerId);
    if (activeMatch && activeMatch.phase !== 'finished') {
      pauseMatch(tournament, activeMatch.id, playerId);
      player.suspendedMatchId = activeMatch.id;
      return { pausedMatchId: activeMatch.id };
    }
  }

  return { pausedMatchId: null };
}

/**
 * Reativa um jogador que estava suspenso (reconectou).
 */
export function reactivatePlayer(
  tournament: Tournament,
  playerId: string,
  socketId: string
): { resumedMatchId: string | null } {
  const player = tournament.playerById.get(playerId);
  if (!player) return { resumedMatchId: null };

  player.status = 'active';
  player.isConnected = true;
  player.socketId = socketId;
  player.suspendedAt = null;

  // Se tinha um match pausado, retomar
  const pausedMatchId = player.suspendedMatchId;
  if (pausedMatchId) {
    resumeMatch(tournament, pausedMatchId);
    player.suspendedMatchId = null;
    return { resumedMatchId: pausedMatchId };
  }

  return { resumedMatchId: null };
}

/**
 * Elimina um jogador do torneio.
 * Todos os matches ativos/pendentes são forfeitados.
 */
export function eliminatePlayer(
  tournament: Tournament,
  playerId: string
): { forfeitedMatchIds: string[] } {
  const player = tournament.playerById.get(playerId);
  if (!player) return { forfeitedMatchIds: [] };

  player.status = 'eliminated';
  player.losses = 2; // Marcar como eliminado
  player.isConnected = false;
  player.suspendedAt = null;
  player.suspendedMatchId = null;

  const forfeitedMatchIds: string[] = [];

  // Encontrar e forfeit todos os matches onde este jogador está envolvido
  const allMatches = [...tournament.winnersMatches, ...tournament.losersMatches]
    .concat(tournament.grandFinal ? [tournament.grandFinal] : [])
    .concat(tournament.grandFinalReset ? [tournament.grandFinalReset] : []);

  for (const match of allMatches) {
    if (match.phase === 'finished') continue;
    if (match.player1?.id !== playerId && match.player2?.id !== playerId) continue;

    // Forfeit este match
    const winnerId = forfeitMatch(tournament, match.id, playerId);
    if (winnerId) {
      forfeitedMatchIds.push(match.id);
    }
  }

  return { forfeitedMatchIds };
}

// ============================================================================
// Utilitários para desconexão (legado - mantido para compatibilidade)
// ============================================================================

/**
 * @deprecated Use suspendPlayer() em vez disso para suportar reconexão.
 * Esta função agora suspende o jogador em vez de forfeit imediato.
 */
export function handlePlayerDisconnect(
  tournament: Tournament,
  playerId: string
): { forfeitMatchId: string | null; pausedMatchId: string | null } {
  const player = tournament.playerById.get(playerId);
  if (!player) {
    return { forfeitMatchId: null, pausedMatchId: null };
  }

  player.isConnected = false;
  player.socketId = null;

  // Se o torneio não está a decorrer, apenas marcar como suspenso
  if (tournament.phase !== 'running') {
    player.status = 'suspended';
    player.suspendedAt = new Date();
    return { forfeitMatchId: null, pausedMatchId: null };
  }

  // Suspender jogador e pausar match (em vez de forfeit imediato)
  const { pausedMatchId } = suspendPlayer(tournament, playerId);

  return { forfeitMatchId: null, pausedMatchId };
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

  // Limpar estado de pausa se existia
  match.isPaused = false;
  match.pausedAt = null;
  match.pausedByPlayerId = null;

  // Dá vitória ao outro jogador (2-0 automático)
  match.score = match.player1?.id === winnerId
    ? { player1Wins: 2, player2Wins: 0 }
    : { player1Wins: 0, player2Wins: 2 };

  // Definir o vencedor do match (importante para notificações!)
  match.winnerId = winnerId;

  return winnerId;
}

// ============================================================================
// Funções para reiniciar jogos/matches (recuperação de bloqueios)
// ============================================================================

/**
 * Reinicia apenas o jogo atual de um match.
 * Mantém o score do match, só limpa o estado do jogo atual.
 * Útil quando um jogo fica bloqueado/corrupto.
 */
export function restartCurrentGame(
  tournament: Tournament,
  matchId: string
): { success: boolean; error?: string } {
  if (tournament.phase !== 'running') {
    return { success: false, error: 'Torneio não está a decorrer' };
  }

  const match = tournament.matchById.get(matchId);
  if (!match) {
    return { success: false, error: 'Match não encontrado' };
  }

  if (match.phase === 'finished') {
    return { success: false, error: 'Match já terminou' };
  }

  // Limpa o estado do jogo atual
  match.gameState = null;
  match.whoseTurn = null;
  match.moves = [];
  match.player1Ready = false;
  match.player2Ready = false;
  match.phase = 'waiting';

  // Limpa estado de pausa se existia
  match.isPaused = false;
  match.pausedAt = null;
  match.pausedByPlayerId = null;

  return { success: true };
}

/**
 * Reinicia um match completo.
 * Reseta o score para 0-0, volta ao jogo 1, limpa todos os estados.
 * Mantém o bracket e os jogadores.
 * Útil quando um match inteiro está bloqueado.
 */
export function restartMatch(
  tournament: Tournament,
  matchId: string
): { success: boolean; error?: string } {
  if (tournament.phase !== 'running') {
    return { success: false, error: 'Torneio não está a decorrer' };
  }

  const match = tournament.matchById.get(matchId);
  if (!match) {
    return { success: false, error: 'Match não encontrado' };
  }

  if (match.phase === 'finished') {
    return { success: false, error: 'Match já terminou' };
  }

  // Reseta tudo
  match.score = { player1Wins: 0, player2Wins: 0 };
  match.currentGame = 1;
  match.whoStartsCurrentGame = 'player1';
  match.gameState = null;
  match.whoseTurn = null;
  match.moves = [];
  match.player1Ready = false;
  match.player2Ready = false;
  match.phase = 'waiting';
  match.winnerId = null;

  // Limpa estado de pausa se existia
  match.isPaused = false;
  match.pausedAt = null;
  match.pausedByPlayerId = null;

  return { success: true };
}

/**
 * Obtém todos os matches em curso (para modo espectador).
 * Devolve os matches com fase 'playing' e os seus estados de jogo.
 */
export function getActiveMatchesWithGameState(
  tournament: Tournament
): Array<{ match: TournamentMatch; gameState: unknown }> {
  const allMatches = [
    ...tournament.winnersMatches,
    ...tournament.losersMatches,
    ...(tournament.grandFinal ? [tournament.grandFinal] : []),
    ...(tournament.grandFinalReset ? [tournament.grandFinalReset] : []),
  ];

  return allMatches
    .filter(m => m.phase === 'playing' && m.gameState !== null)
    .map(m => ({
      match: m,
      gameState: m.gameState,
    }));
}

// ============================================================================
// Exportação e importação de torneios
// ============================================================================

/**
 * Formato exportado de um jogador (sem Maps e com Dates como strings).
 */
export interface ExportedPlayer extends Omit<TournamentPlayer, 'suspendedAt'> {
  suspendedAt: string | null;
}

/**
 * Formato exportado de um match (sem Maps e com Dates como strings).
 */
export interface ExportedMatch extends Omit<TournamentMatch, 'moves' | 'pausedAt'> {
  moves: Array<{ playerId: string; move: unknown; timestamp: string }>;
  pausedAt: string | null;
}

/**
 * Formato completo de exportação de um torneio.
 */
export interface TournamentExport {
  version: 1;
  exportedAt: string;
  id: string;
  gameId: GameId;
  phase: TournamentPhase;
  players: ExportedPlayer[];
  winnersMatches: ExportedMatch[];
  losersMatches: ExportedMatch[];
  grandFinal: ExportedMatch | null;
  grandFinalReset: ExportedMatch | null;
  championId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  winnersWaiting: string[];
  losersWaiting: string[];
  winnersRound: number;
  losersRound: number;
}

/**
 * Exporta um torneio para um formato JSON serializável.
 */
export function exportTournament(tournament: Tournament): TournamentExport {
  const exportMatch = (m: TournamentMatch): ExportedMatch => ({
    ...m,
    moves: m.moves.map(move => ({
      ...move,
      timestamp: move.timestamp.toISOString(),
    })),
    pausedAt: m.pausedAt?.toISOString() ?? null,
  });

  const exportPlayer = (p: TournamentPlayer): ExportedPlayer => ({
    ...p,
    suspendedAt: p.suspendedAt?.toISOString() ?? null,
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    id: tournament.id,
    gameId: tournament.gameId,
    phase: tournament.phase,
    players: tournament.players.map(exportPlayer),
    winnersMatches: tournament.winnersMatches.map(exportMatch),
    losersMatches: tournament.losersMatches.map(exportMatch),
    grandFinal: tournament.grandFinal ? exportMatch(tournament.grandFinal) : null,
    grandFinalReset: tournament.grandFinalReset ? exportMatch(tournament.grandFinalReset) : null,
    championId: tournament.championId,
    createdAt: tournament.createdAt.toISOString(),
    startedAt: tournament.startedAt?.toISOString() ?? null,
    finishedAt: tournament.finishedAt?.toISOString() ?? null,
    winnersWaiting: [...tournament.winnersWaiting],
    losersWaiting: [...tournament.losersWaiting],
    winnersRound: tournament.winnersRound,
    losersRound: tournament.losersRound,
  };
}

/**
 * Importa um torneio a partir de dados exportados.
 * Reconstrói os Maps e converte strings ISO de volta para Dates.
 */
export function importTournament(data: TournamentExport): Tournament {
  // Converter matches de volta para o formato interno
  const importMatch = (m: ExportedMatch): TournamentMatch => ({
    ...m,
    moves: m.moves.map(move => ({
      ...move,
      timestamp: new Date(move.timestamp),
    })),
    pausedAt: m.pausedAt ? new Date(m.pausedAt) : null,
  });

  // Converter players de volta para o formato interno
  const importPlayer = (p: ExportedPlayer): TournamentPlayer => ({
    ...p,
    suspendedAt: p.suspendedAt ? new Date(p.suspendedAt) : null,
    // Marcar todos como desconectados ao importar (precisarão reconectar)
    isConnected: false,
    socketId: null,
  });

  const players = data.players.map(importPlayer);
  const winnersMatches = data.winnersMatches.map(importMatch);
  const losersMatches = data.losersMatches.map(importMatch);
  const grandFinal = data.grandFinal ? importMatch(data.grandFinal) : null;
  const grandFinalReset = data.grandFinalReset ? importMatch(data.grandFinalReset) : null;

  // Reconstruir Maps
  const playerById = new Map<string, TournamentPlayer>();
  const playerByCode = new Map<string, TournamentPlayer>();
  for (const player of players) {
    playerById.set(player.id, player);
    playerByCode.set(player.reconnectionCode, player);
  }

  const matchById = new Map<string, TournamentMatch>();
  for (const match of winnersMatches) {
    matchById.set(match.id, match);
  }
  for (const match of losersMatches) {
    matchById.set(match.id, match);
  }
  if (grandFinal) {
    matchById.set(grandFinal.id, grandFinal);
  }
  if (grandFinalReset) {
    matchById.set(grandFinalReset.id, grandFinalReset);
  }

  return {
    id: data.id,
    gameId: data.gameId,
    phase: data.phase,
    players,
    winnersMatches,
    losersMatches,
    grandFinal,
    grandFinalReset,
    championId: data.championId,
    createdAt: new Date(data.createdAt),
    startedAt: data.startedAt ? new Date(data.startedAt) : null,
    finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
    playerById,
    matchById,
    playerByCode,
    winnersWaiting: [...data.winnersWaiting],
    losersWaiting: [...data.losersWaiting],
    winnersRound: data.winnersRound,
    losersRound: data.losersRound,
  };
}