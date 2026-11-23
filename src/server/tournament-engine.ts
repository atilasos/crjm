/**
 * Motor de torneios com dupla eliminação dinâmica.
 *
 * Em vez de pré-planear uma árvore de potência de 2 (que deixava jogadores
 * parados ou bloqueava a chave para tamanhos como 5, 6, 17…), os confrontos
 * são criados à medida que os jogadores ficam livres:
 *
 * - Winners: só joga quem tem 0 derrotas, sempre contra alguém do mesmo nível
 *   (mesmo número de vitórias na winners), como numa chave clássica. Um
 *   jogador sozinho num nível sobe por isenção quando já ninguém o pode
 *   alcançar.
 * - Losers: quem tem 1 derrota joga logo que haja outro jogador livre com 1
 *   derrota (preferindo não repetir adversários e níveis semelhantes).
 * - Final: campeão da winners contra campeão da losers, com reset se o
 *   campeão da losers ganhar.
 * - Cada confronto é à melhor de 3, alternando quem começa.
 *
 * Invariantes: cada confronto termina com exatamente uma derrota; um jogador
 * é eliminado à segunda derrota; o número total de confrontos é 2n−2 (ou
 * 2n−1 com reset), independentemente da ordem dos emparelhamentos.
 */

import type {
  Player,
  Match,
  TournamentState,
  TournamentPhase,
  BracketType,
  GameId,
} from '../tournament/protocol';

// ============================================================================
// Tipos internos do motor
// ============================================================================

export type PlayerStatus = 'active' | 'suspended' | 'eliminated';

export interface TournamentPlayer extends Omit<Player, 'isOnline'> {
  losses: number; // 0, 1 ou 2 (eliminado)
  isConnected: boolean;
  socketId: string | null;
  reconnectionCode: string;           // Código único 6 caracteres (ex: ABC234)
  status: PlayerStatus;
  suspendedAt: Date | null;
  suspendedMatchId: string | null;
  /** Nível na winners (1 + vitórias/isenções na winners). */
  winnersLevel: number;
  /** Vitórias na losers. */
  losersWins: number;
  /** Isenções recebidas na winners. */
  byes: number;
  /** Desde quando está livre à espera de adversário (null se a jogar/eliminado). */
  freeSince: Date | null;
  /** Ordem de eliminação (1 = primeiro eliminado). */
  eliminationOrder: number | null;
  /** Sorteio inicial, usado como desempate estável. */
  drawOrder: number;
}

/** Jogada compacta: lugar de quem jogou (1 = player1, 2 = player2) e a jogada. */
export interface SeatMove {
  by: 1 | 2;
  move: unknown;
}

/** Registo compacto de um jogo terminado dentro de um confronto. */
export interface GameRecord {
  number: number;
  starter: 'player1' | 'player2';
  winner: 'player1' | 'player2';
  startedAt: Date | null;
  endedAt: Date;
  moves: SeatMove[];
}

function toSeatMove(match: { player1: { id: string } | null }, entry: { playerId: string; move: unknown }): SeatMove {
  return { by: entry.playerId === match.player1?.id ? 1 : 2, move: entry.move };
}

export interface TournamentMatch extends Match {
  player1Ready: boolean;
  player2Ready: boolean;
  gameState: unknown | null;
  whoseTurn: 'player1' | 'player2' | null;
  /** Jogadas do jogo em curso. */
  moves: Array<{ playerId: string; move: unknown; timestamp: Date }>;
  /** Histórico dos jogos já terminados deste confronto. */
  games: GameRecord[];
  gameStartedAt: Date | null;
  createdAt: Date;
  finishedAt: Date | null;
  isPaused: boolean;
  pausedAt: Date | null;
  pausedByPlayerId: string | null;
  matchNumber: number;
  sourceMatch1: number | null;
  sourceMatch2: number | null;
  sourceLabel1: string;
  sourceLabel2: string;
  nextMatchIfWin: number | null;
  nextMatchIfLose: number | null;
  result: 'normal' | 'bye' | 'forfeit' | null; // 'forfeit' = vitória por falta/eliminação
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

  playerById: Map<string, TournamentPlayer>;
  matchById: Map<string, TournamentMatch>;
  playerByCode: Map<string, TournamentPlayer>;

  /** Jogadores livres à espera, por chave (derivado; atualizado pelo escalonador). */
  winnersWaiting: string[];
  losersWaiting: string[];

  nextMatchNumber: number;
  eliminationCounter: number;
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
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const numbers = '23456789';
  let code = '';
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 3; i++) code += numbers[Math.floor(Math.random() * numbers.length)];
  return code;
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

function allMatches(tournament: Tournament): TournamentMatch[] {
  return [
    ...tournament.winnersMatches,
    ...tournament.losersMatches,
    ...(tournament.grandFinal ? [tournament.grandFinal] : []),
    ...(tournament.grandFinalReset ? [tournament.grandFinalReset] : []),
  ];
}

function playerInfo(player: TournamentPlayer) {
  return { id: player.id, name: player.name, classId: player.classId };
}

// ============================================================================
// Criação de torneio e jogadores
// ============================================================================

export function createTournament(gameId: GameId): Tournament {
  return {
    id: generateId(),
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
    nextMatchNumber: 1,
    eliminationCounter: 0,
  };
}

export function addPlayer(
  tournament: Tournament,
  name: string,
  classId?: string,
  socketId?: string
): TournamentPlayer | null {
  if (tournament.phase !== 'registration') return null;

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
    winnersLevel: 1,
    losersWins: 0,
    byes: 0,
    freeSince: null,
    eliminationOrder: null,
    drawOrder: tournament.players.length,
  };

  tournament.players.push(player);
  tournament.playerById.set(player.id, player);
  tournament.playerByCode.set(reconnectionCode, player);
  return player;
}

export function removePlayer(tournament: Tournament, playerId: string): boolean {
  if (tournament.phase !== 'registration') return false;
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
  if (!player) return;
  player.isConnected = isConnected;
  if (socketId !== undefined) player.socketId = socketId;
}

// ============================================================================
// Criação de confrontos
// ============================================================================

function createMatch(
  tournament: Tournament,
  bracket: BracketType | 'grandFinal' | 'grandFinalReset',
  round: number,
  first: TournamentPlayer,
  second: TournamentPlayer,
): TournamentMatch {
  const match: TournamentMatch = {
    id: generateId(),
    round,
    bracket: bracket === 'grandFinal' || bracket === 'grandFinalReset' ? 'winners' : bracket,
    player1: playerInfo(first),
    player2: playerInfo(second),
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
    games: [],
    gameStartedAt: null,
    createdAt: new Date(),
    finishedAt: null,
    isPaused: false,
    pausedAt: null,
    pausedByPlayerId: null,
    matchNumber: tournament.nextMatchNumber++,
    sourceMatch1: null,
    sourceMatch2: null,
    sourceLabel1: first.name,
    sourceLabel2: second.name,
    nextMatchIfWin: null,
    nextMatchIfLose: null,
    result: null,
  };

  tournament.matchById.set(match.id, match);
  if (bracket === 'grandFinal') tournament.grandFinal = match;
  else if (bracket === 'grandFinalReset') tournament.grandFinalReset = match;
  else if (bracket === 'winners') tournament.winnersMatches.push(match);
  else tournament.losersMatches.push(match);

  first.freeSince = null;
  second.freeSince = null;
  return match;
}

/** Sorteia quem fica como player1 (começa o jogo 1). */
function createPairing(
  tournament: Tournament,
  bracket: BracketType,
  round: number,
  a: TournamentPlayer,
  b: TournamentPlayer,
): TournamentMatch {
  return Math.random() < 0.5
    ? createMatch(tournament, bracket, round, a, b)
    : createMatch(tournament, bracket, round, b, a);
}

// ============================================================================
// Escalonador dinâmico
// ============================================================================

function busyPlayerIds(tournament: Tournament): Set<string> {
  const busy = new Set<string>();
  for (const match of allMatches(tournament)) {
    if (match.phase === 'finished') continue;
    if (match.player1) busy.add(match.player1.id);
    if (match.player2) busy.add(match.player2.id);
  }
  return busy;
}

/** Pode ser emparelhado agora (ligado e não suspenso). */
function isPairable(player: TournamentPlayer): boolean {
  return player.status === 'active' && player.isConnected;
}

function byWaitingTime(a: TournamentPlayer, b: TournamentPlayer): number {
  const ta = a.freeSince?.getTime() ?? 0;
  const tb = b.freeSince?.getTime() ?? 0;
  return ta - tb || a.drawOrder - b.drawOrder;
}

function timesPlayed(tournament: Tournament, a: string, b: string): number {
  let count = 0;
  for (const match of allMatches(tournament)) {
    const ids = [match.player1?.id, match.player2?.id];
    if (ids.includes(a) && ids.includes(b)) count++;
  }
  return count;
}

function finishTournament(tournament: Tournament, championId: string | null): void {
  tournament.championId = championId;
  tournament.phase = 'finished';
  tournament.finishedAt = new Date();
  for (const player of tournament.players) player.freeSince = null;
  tournament.winnersWaiting = [];
  tournament.losersWaiting = [];
}

function eliminate(tournament: Tournament, player: TournamentPlayer): void {
  if (player.status === 'eliminated' && player.eliminationOrder !== null) return;
  player.status = 'eliminated';
  player.losses = Math.max(player.losses, 2);
  player.freeSince = null;
  player.suspendedMatchId = null;
  player.eliminationOrder = ++tournament.eliminationCounter;
}

/**
 * Cria todos os confrontos possíveis neste momento e devolve os novos.
 * Idempotente: chamar sem alterações de estado não cria nada.
 */
export function scheduleMatches(tournament: Tournament): TournamentMatch[] {
  const created: TournamentMatch[] = [];
  if (tournament.phase !== 'running') return created;
  // Durante a final só os dois finalistas estão em prova.
  if (tournament.grandFinal) {
    refreshWaitingLists(tournament);
    return created;
  }

  for (let guard = 0; guard < 10_000; guard++) {
    const busy = busyPlayerIds(tournament);
    const active = tournament.players.filter(p => p.status !== 'eliminated');
    const winners = active.filter(p => p.losses === 0);
    const losers = active.filter(p => p.losses === 1);
    const isFree = (p: TournamentPlayer) => !busy.has(p.id);

    // Fim por falta de adversários (ex.: eliminações administrativas).
    if (active.length <= 1 && busy.size === 0) {
      finishTournament(tournament, active[0]?.id ?? null);
      return created;
    }

    // Final: campeão da winners vs campeão da losers.
    // Só com os dois ligados; ao voltar, o rejoin volta a chamar o escalonador.
    if (winners.length === 1 && losers.length === 1) {
      if (!isFree(winners[0]!) || !isFree(losers[0]!) || !isPairable(winners[0]!) || !isPairable(losers[0]!)) break;
      created.push(createMatch(tournament, 'grandFinal', 999, winners[0]!, losers[0]!));
      break;
    }
    // Sem winners em prova (campeão eliminado pelo admin): a losers decide.
    // Sem losers em prova: o campeão da winners vence.
    if (winners.length === 1 && losers.length === 0 && busy.size === 0) {
      finishTournament(tournament, winners[0]!.id);
      return created;
    }

    let changed = false;

    // --- Winners: emparelhar por nível ---
    const freeWinners = winners.filter(isFree);
    const levels = [...new Set(freeWinners.map(p => p.winnersLevel))].sort((a, b) => a - b);
    for (const level of levels) {
      const atLevel = freeWinners.filter(p => p.winnersLevel === level).sort(byWaitingTime);
      const pairable = atLevel.filter(isPairable);
      while (pairable.length >= 2) {
        const a = pairable.shift()!;
        const b = pairable.shift()!;
        created.push(createPairing(tournament, 'winners', level, a, b));
        changed = true;
      }
      // Isenção: único livre neste nível e ninguém mais o pode alcançar.
      // Quem está desligado não sobe sem jogar: fica no nível até voltar
      // (ou até o professor o eliminar), como no torneio de 2026-11-23.
      const stillFree = atLevel.filter(p => !created.some(m => m.player1?.id === p.id || m.player2?.id === p.id));
      if (stillFree.length === 1 && isPairable(stillFree[0]!) && winners.length > 1) {
        const lone = stillFree[0]!;
        const canBeReached = winners.some(p => p.id !== lone.id && p.winnersLevel < level);
        if (!canBeReached) {
          lone.winnersLevel++;
          lone.byes++;
          changed = true;
          break; // recomeçar: o nível mudou
        }
      }
    }
    if (changed) continue;

    // --- Losers: emparelhar quem estiver livre ---
    const freeLosers = losers.filter(p => isFree(p) && isPairable(p)).sort(byWaitingTime);
    while (freeLosers.length >= 2) {
      const a = freeLosers.shift()!;
      // Preferir quem ainda não defrontou; depois nível parecido; depois quem espera há mais tempo.
      let bestIndex = 0;
      let bestRematches = Number.POSITIVE_INFINITY;
      let bestGap = Number.POSITIVE_INFINITY;
      for (let index = 0; index < freeLosers.length; index++) {
        const candidate = freeLosers[index]!;
        const rematches = timesPlayed(tournament, a.id, candidate.id);
        const gap = Math.abs(a.losersWins - candidate.losersWins);
        if (rematches < bestRematches || (rematches === bestRematches && gap < bestGap)) {
          bestRematches = rematches;
          bestGap = gap;
          bestIndex = index;
        }
      }
      const b = freeLosers.splice(bestIndex, 1)[0]!;
      created.push(createPairing(tournament, 'losers', 1 + Math.max(a.losersWins, b.losersWins), a, b));
      changed = true;
    }
    if (!changed) break;
  }

  refreshWaitingLists(tournament);
  return created;
}

function refreshWaitingLists(tournament: Tournament): void {
  const busy = busyPlayerIds(tournament);
  const free = tournament.players.filter(p => p.status !== 'eliminated' && !busy.has(p.id));
  tournament.winnersWaiting = free.filter(p => p.losses === 0).map(p => p.id);
  tournament.losersWaiting = free.filter(p => p.losses === 1).map(p => p.id);
}

// ============================================================================
// Início do torneio
// ============================================================================

export function startTournament(tournament: Tournament): boolean {
  if (tournament.phase !== 'registration') return false;
  if (tournament.players.length < 2) return false;

  tournament.phase = 'running';
  tournament.startedAt = new Date();
  const order = shuffle(tournament.players);
  order.forEach((player, index) => {
    player.drawOrder = index;
    player.freeSince = tournament.startedAt;
  });
  scheduleMatches(tournament);
  return true;
}

// ============================================================================
// Resultados
// ============================================================================

export interface MatchOutcome {
  affectedPlayerIds: string[];
  newMatches: TournamentMatch[];
  isGrandFinal: boolean;
  isTournamentEnd: boolean;
}

/**
 * Regista o vencedor de um confronto, atualiza as chaves e cria os
 * confrontos que ficarem possíveis. Ignora confrontos já terminados.
 */
export function processMatchResult(
  tournament: Tournament,
  matchId: string,
  winnerId: string,
  options: { forfeit?: boolean } = {}
): MatchOutcome {
  const empty: MatchOutcome = { affectedPlayerIds: [], newMatches: [], isGrandFinal: false, isTournamentEnd: false };
  const match = tournament.matchById.get(matchId);
  if (!match || match.phase === 'finished' || !match.player1 || !match.player2) return empty;
  if (winnerId !== match.player1.id && winnerId !== match.player2.id) return empty;

  const loserId = match.player1.id === winnerId ? match.player2.id : match.player1.id;
  const winner = tournament.playerById.get(winnerId)!;
  const loser = tournament.playerById.get(loserId)!;
  const now = new Date();

  match.winnerId = winnerId;
  match.phase = 'finished';
  match.result = options.forfeit ? 'forfeit' : 'normal';
  match.finishedAt = now;
  match.isPaused = false;
  match.pausedAt = null;
  match.pausedByPlayerId = null;
  if (options.forfeit) {
    match.score = match.player1.id === winnerId
      ? { player1Wins: 2, player2Wins: 0 }
      : { player1Wins: 0, player2Wins: 2 };
  }

  for (const player of [winner, loser]) {
    if (player.suspendedMatchId === match.id) player.suspendedMatchId = null;
  }

  const affectedPlayerIds = [winnerId, loserId];
  const isGrandFinal = match === tournament.grandFinal || match === tournament.grandFinalReset;

  if (match === tournament.grandFinal) {
    // player1 da final é sempre o campeão da winners.
    if (winnerId === match.player1.id) {
      eliminate(tournament, loser);
      finishTournament(tournament, winnerId);
      return { affectedPlayerIds, newMatches: [], isGrandFinal, isTournamentEnd: true };
    }
    if (loser.status === 'eliminated') {
      finishTournament(tournament, winnerId);
      return { affectedPlayerIds, newMatches: [], isGrandFinal, isTournamentEnd: true };
    }
    loser.losses = 1;
    winner.freeSince = now;
    loser.freeSince = now;
    const reset = createMatch(tournament, 'grandFinalReset', 1000, winner, loser);
    return { affectedPlayerIds, newMatches: [reset], isGrandFinal, isTournamentEnd: false };
  }

  if (match === tournament.grandFinalReset) {
    eliminate(tournament, loser);
    finishTournament(tournament, winnerId);
    return { affectedPlayerIds, newMatches: [], isGrandFinal, isTournamentEnd: true };
  }

  // Confronto normal.
  if (match.bracket === 'winners') winner.winnersLevel++;
  else winner.losersWins++;
  winner.freeSince = now;

  if (loser.status === 'eliminated') {
    // Eliminado pelo administrador: a derrota já está contabilizada.
  } else {
    loser.losses++;
    if (loser.losses >= 2) eliminate(tournament, loser);
    else loser.freeSince = now;
  }

  const newMatches = scheduleMatches(tournament);
  return {
    affectedPlayerIds,
    newMatches,
    isGrandFinal,
    isTournamentEnd: tournament.phase === 'finished',
  };
}

// ============================================================================
// Gestão de jogos dentro de um confronto (melhor de 3)
// ============================================================================

export function setPlayerReady(
  tournament: Tournament,
  matchId: string,
  playerId: string
): { bothReady: boolean; match: TournamentMatch | null; changed: boolean } {
  const match = tournament.matchById.get(matchId);
  if (!match || match.phase !== 'waiting') return { bothReady: false, match: null, changed: false };

  let changed = false;
  if (match.player1?.id === playerId) {
    changed = !match.player1Ready;
    match.player1Ready = true;
  } else if (match.player2?.id === playerId) {
    changed = !match.player2Ready;
    match.player2Ready = true;
  } else {
    return { bothReady: false, match: null, changed: false };
  }

  return { bothReady: match.player1Ready && match.player2Ready, match, changed };
}

export function startGame(match: TournamentMatch, initialGameState: unknown): void {
  match.phase = 'playing';
  match.gameState = initialGameState;
  match.player1Ready = false;
  match.player2Ready = false;
  match.moves = [];
  match.gameStartedAt = new Date();
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
  match.moves.push({ playerId, move, timestamp: new Date() });
  match.gameState = newGameState;
  match.whoseTurn = nextTurn;
}

export function endGame(
  match: TournamentMatch,
  winnerId: string
): { matchEnded: boolean; matchWinnerId: string | null } {
  const winnerSeat: 'player1' | 'player2' = match.player1?.id === winnerId ? 'player1' : 'player2';
  if (winnerSeat === 'player1') match.score.player1Wins++;
  else match.score.player2Wins++;

  match.games.push({
    number: match.currentGame,
    starter: match.whoStartsCurrentGame,
    winner: winnerSeat,
    startedAt: match.gameStartedAt,
    endedAt: new Date(),
    moves: match.moves.map(entry => toSeatMove(match, entry)),
  });

  const winsNeeded = Math.ceil(match.bestOf / 2);
  if (match.score.player1Wins >= winsNeeded) return { matchEnded: true, matchWinnerId: match.player1!.id };
  if (match.score.player2Wins >= winsNeeded) return { matchEnded: true, matchWinnerId: match.player2!.id };

  match.currentGame++;
  match.phase = 'waiting';
  match.gameState = null;
  match.whoseTurn = null;
  match.moves = [];
  match.gameStartedAt = null;
  return { matchEnded: false, matchWinnerId: null };
}

// ============================================================================
// Conversão para o protocolo
// ============================================================================

export function toProtocolMatch(match: TournamentMatch): Match {
  return {
    id: match.id,
    round: match.round,
    bracket: match.bracket,
    player1: match.player1,
    player2: match.player2,
    score: { ...match.score },
    bestOf: match.bestOf,
    currentGame: match.currentGame,
    whoStartsCurrentGame: match.whoStartsCurrentGame,
    phase: match.phase,
    winnerId: match.winnerId,
    matchNumber: match.matchNumber,
    sourceMatch1: match.sourceMatch1,
    sourceMatch2: match.sourceMatch2,
    sourceLabel1: match.sourceLabel1,
    sourceLabel2: match.sourceLabel2,
    nextMatchIfWin: match.nextMatchIfWin,
    nextMatchIfLose: match.nextMatchIfLose,
    result: match.result,
    player1Ready: match.player1Ready,
    player2Ready: match.player2Ready,
  };
}

export function toTournamentState(tournament: Tournament): TournamentState {
  const champion = tournament.championId ? tournament.playerById.get(tournament.championId) : null;
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

/**
 * Classificação: campeão em 1.º; os restantes pela ordem inversa de
 * eliminação (quem saiu mais tarde fica mais acima). Ainda em prova ficam
 * à frente dos eliminados.
 */
export function computeStandings(tournament: Tournament): Array<{ rank: number; playerId: string; playerName: string }> {
  const ordered = [...tournament.players].sort((a, b) => {
    if (a.id === tournament.championId) return -1;
    if (b.id === tournament.championId) return 1;
    const ea = a.eliminationOrder ?? Number.MAX_SAFE_INTEGER;
    const eb = b.eliminationOrder ?? Number.MAX_SAFE_INTEGER;
    return eb - ea || a.losses - b.losses || a.drawOrder - b.drawOrder;
  });
  return ordered.map((player, index) => ({ rank: index + 1, playerId: player.id, playerName: player.name }));
}

// ============================================================================
// Reconexão e gestão de jogadores
// ============================================================================

export function findPlayerByCode(tournament: Tournament, code: string): TournamentPlayer | null {
  return tournament.playerByCode.get(code.toUpperCase().trim()) ?? null;
}

export function findActiveMatchForPlayer(tournament: Tournament, playerId: string): TournamentMatch | null {
  return allMatches(tournament).find(m =>
    m.phase !== 'finished' && (m.player1?.id === playerId || m.player2?.id === playerId)
  ) ?? null;
}

export function pauseMatch(tournament: Tournament, matchId: string, byPlayerId: string): void {
  const match = tournament.matchById.get(matchId);
  if (!match || match.phase === 'finished') return;
  match.isPaused = true;
  match.pausedAt = new Date();
  match.pausedByPlayerId = byPlayerId;
  // Um jogo por começar volta a pedir «Estou pronto» aos dois depois da pausa.
  if (match.phase === 'waiting') {
    match.player1Ready = false;
    match.player2Ready = false;
  }
}

export function resumeMatch(tournament: Tournament, matchId: string): void {
  const match = tournament.matchById.get(matchId);
  if (!match || !match.isPaused) return;
  match.isPaused = false;
  match.pausedAt = null;
  match.pausedByPlayerId = null;
}

/**
 * Suspende um jogador (desligado mas pode voltar). Se estiver num confronto,
 * o confronto fica em pausa. Jogadores eliminados mantêm o estado.
 */
export function suspendPlayer(tournament: Tournament, playerId: string): { pausedMatchId: string | null } {
  const player = tournament.playerById.get(playerId);
  if (!player) return { pausedMatchId: null };

  player.isConnected = false;
  if (player.status === 'eliminated') return { pausedMatchId: null };
  player.status = 'suspended';
  player.suspendedAt = new Date();

  if (tournament.phase === 'running') {
    const activeMatch = findActiveMatchForPlayer(tournament, playerId);
    if (activeMatch) {
      pauseMatch(tournament, activeMatch.id, playerId);
      player.suspendedMatchId = activeMatch.id;
      return { pausedMatchId: activeMatch.id };
    }
  }
  return { pausedMatchId: null };
}

export function reactivatePlayer(
  tournament: Tournament,
  playerId: string,
  socketId: string
): { resumedMatchId: string | null } {
  const player = tournament.playerById.get(playerId);
  if (!player) return { resumedMatchId: null };

  player.isConnected = true;
  player.socketId = socketId;
  if (player.status === 'eliminated') return { resumedMatchId: null };
  player.status = 'active';
  player.suspendedAt = null;

  const pausedMatchId = player.suspendedMatchId;
  player.suspendedMatchId = null;
  const paused = pausedMatchId ? tournament.matchById.get(pausedMatchId) : null;
  if (paused && paused.phase !== 'finished') {
    resumeMatch(tournament, paused.id);
    return { resumedMatchId: paused.id };
  }
  return { resumedMatchId: null };
}

/** Desligou-se: fica suspenso (o confronto pausa) até voltar. */
export function handlePlayerDisconnect(
  tournament: Tournament,
  playerId: string
): { pausedMatchId: string | null } {
  const player = tournament.playerById.get(playerId);
  if (!player) return { pausedMatchId: null };
  player.socketId = null;
  if (tournament.phase !== 'running') {
    player.isConnected = false;
    if (player.status !== 'eliminated') {
      player.status = 'suspended';
      player.suspendedAt = new Date();
    }
    return { pausedMatchId: null };
  }
  return suspendPlayer(tournament, playerId);
}

/**
 * Elimina um jogador por decisão do administrador. Se estiver num confronto,
 * o adversário vence por falta. A eliminação conta como as derrotas em
 * falta — nunca soma derrotas extra.
 */
export function eliminatePlayer(
  tournament: Tournament,
  playerId: string
): { endedMatches: TournamentMatch[]; newMatches: TournamentMatch[]; isTournamentEnd: boolean } {
  const player = tournament.playerById.get(playerId);
  if (!player || player.status === 'eliminated' || tournament.phase !== 'running') {
    return { endedMatches: [], newMatches: [], isTournamentEnd: false };
  }

  const activeMatch = findActiveMatchForPlayer(tournament, playerId);
  eliminate(tournament, player);
  player.suspendedAt = null;

  if (activeMatch && activeMatch.player1 && activeMatch.player2) {
    const opponentId = activeMatch.player1.id === playerId ? activeMatch.player2.id : activeMatch.player1.id;
    const outcome = processMatchResult(tournament, activeMatch.id, opponentId, { forfeit: true });
    return { endedMatches: [activeMatch], newMatches: outcome.newMatches, isTournamentEnd: outcome.isTournamentEnd };
  }

  const newMatches = scheduleMatches(tournament);
  // scheduleMatches pode terminar o torneio (a fase muda dentro da chamada).
  return { endedMatches: [], newMatches, isTournamentEnd: (tournament.phase as TournamentPhase) === 'finished' };
}

// ============================================================================
// Reinício de jogos/confrontos (recuperação de bloqueios)
// ============================================================================

export function restartCurrentGame(tournament: Tournament, matchId: string): { success: boolean; error?: string } {
  if (tournament.phase !== 'running') return { success: false, error: 'Torneio não está a decorrer' };
  const match = tournament.matchById.get(matchId);
  if (!match) return { success: false, error: 'Match não encontrado' };
  if (match.phase === 'finished') return { success: false, error: 'Match já terminou' };

  match.gameState = null;
  match.whoseTurn = null;
  match.moves = [];
  match.gameStartedAt = null;
  match.player1Ready = false;
  match.player2Ready = false;
  match.phase = 'waiting';
  // Mantém a pausa se algum dos dois continuar desligado.
  const offline = [match.player1?.id, match.player2?.id]
    .map(id => id ? tournament.playerById.get(id) : undefined)
    .find(player => player && !player.isConnected);
  match.isPaused = Boolean(offline);
  match.pausedAt = offline ? (match.pausedAt ?? new Date()) : null;
  match.pausedByPlayerId = offline ? offline.id : null;
  return { success: true };
}

export function restartMatch(tournament: Tournament, matchId: string): { success: boolean; error?: string } {
  if (tournament.phase !== 'running') return { success: false, error: 'Torneio não está a decorrer' };
  const match = tournament.matchById.get(matchId);
  if (!match) return { success: false, error: 'Match não encontrado' };
  if (match.phase === 'finished') return { success: false, error: 'Match já terminou' };

  match.score = { player1Wins: 0, player2Wins: 0 };
  match.currentGame = 1;
  match.whoStartsCurrentGame = 'player1';
  match.gameState = null;
  match.whoseTurn = null;
  match.moves = [];
  match.games = [];
  match.gameStartedAt = null;
  match.player1Ready = false;
  match.player2Ready = false;
  match.phase = 'waiting';
  match.winnerId = null;
  // Mantém a pausa se algum dos dois continuar desligado.
  const offline = [match.player1?.id, match.player2?.id]
    .map(id => id ? tournament.playerById.get(id) : undefined)
    .find(player => player && !player.isConnected);
  match.isPaused = Boolean(offline);
  match.pausedAt = offline ? (match.pausedAt ?? new Date()) : null;
  match.pausedByPlayerId = offline ? offline.id : null;
  return { success: true };
}

/** Confrontos em curso com estado de jogo (modo espectador). */
export function getActiveMatchesWithGameState(
  tournament: Tournament
): Array<{ match: TournamentMatch; gameState: unknown }> {
  return allMatches(tournament)
    .filter(m => m.phase === 'playing' && m.gameState !== null)
    .map(m => ({ match: m, gameState: m.gameState }));
}

// ============================================================================
// Exportação e importação (versão 2, compacta)
// ============================================================================

type ExportedPlayerInfo = { id: string; name: string; classId?: string };

export interface ExportedPlayer {
  id: string;
  name: string;
  classId?: string;
  reconnectionCode: string;
  status: PlayerStatus;
  losses: number;
  winnersLevel: number;
  losersWins: number;
  byes: number;
  drawOrder: number;
  eliminationOrder: number | null;
  freeSince: string | null;
  suspendedAt: string | null;
  suspendedMatchId: string | null;
}

export interface ExportedGame {
  number: number;
  starter: 'player1' | 'player2';
  winner: 'player1' | 'player2';
  startedAt: string | null;
  endedAt: string;
  moves: SeatMove[];
}

export interface ExportedMatch {
  id: string;
  matchNumber: number;
  bracket: BracketType;
  round: number;
  player1: ExportedPlayerInfo | null;
  player2: ExportedPlayerInfo | null;
  score: { player1Wins: number; player2Wins: number };
  bestOf: number;
  currentGame: number;
  whoStartsCurrentGame: 'player1' | 'player2';
  phase: TournamentMatch['phase'];
  winnerId: string | null;
  result: TournamentMatch['result'];
  createdAt: string;
  finishedAt: string | null;
  games: ExportedGame[];
  /** Só em confrontos por terminar (necessário para retomar). */
  player1Ready?: boolean;
  player2Ready?: boolean;
  gameState?: unknown;
  whoseTurn?: 'player1' | 'player2' | null;
  moves?: SeatMove[];
  gameStartedAt?: string | null;
  isPaused?: boolean;
  pausedAt?: string | null;
  pausedByPlayerId?: string | null;
}

export interface TournamentExport {
  version: 2;
  exportedAt: string;
  id: string;
  gameId: GameId;
  phase: TournamentPhase;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  championId: string | null;
  nextMatchNumber: number;
  eliminationCounter: number;
  players: ExportedPlayer[];
  winnersMatches: ExportedMatch[];
  losersMatches: ExportedMatch[];
  grandFinal: ExportedMatch | null;
  grandFinalReset: ExportedMatch | null;
}

const iso = (date: Date | null) => date ? date.toISOString() : null;
const fromIso = (value: string | null | undefined) => value ? new Date(value) : null;

export function exportTournament(tournament: Tournament): TournamentExport {
  const exportMatch = (m: TournamentMatch): ExportedMatch => {
    const base: ExportedMatch = {
      id: m.id,
      matchNumber: m.matchNumber,
      bracket: m.bracket,
      round: m.round,
      player1: m.player1,
      player2: m.player2,
      score: { ...m.score },
      bestOf: m.bestOf,
      currentGame: m.currentGame,
      whoStartsCurrentGame: m.whoStartsCurrentGame,
      phase: m.phase,
      winnerId: m.winnerId,
      result: m.result,
      createdAt: m.createdAt.toISOString(),
      finishedAt: iso(m.finishedAt),
      games: m.games.map(g => ({
        number: g.number,
        starter: g.starter,
        winner: g.winner,
        startedAt: iso(g.startedAt),
        endedAt: g.endedAt.toISOString(),
        moves: g.moves,
      })),
    };
    if (m.phase === 'finished') return base;
    return {
      ...base,
      player1Ready: m.player1Ready,
      player2Ready: m.player2Ready,
      gameState: m.gameState,
      whoseTurn: m.whoseTurn,
      moves: m.moves.map(entry => toSeatMove(m, entry)),
      gameStartedAt: iso(m.gameStartedAt),
      isPaused: m.isPaused,
      pausedAt: iso(m.pausedAt),
      pausedByPlayerId: m.pausedByPlayerId,
    };
  };

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    id: tournament.id,
    gameId: tournament.gameId,
    phase: tournament.phase,
    createdAt: tournament.createdAt.toISOString(),
    startedAt: iso(tournament.startedAt),
    finishedAt: iso(tournament.finishedAt),
    championId: tournament.championId,
    nextMatchNumber: tournament.nextMatchNumber,
    eliminationCounter: tournament.eliminationCounter,
    players: tournament.players.map(p => ({
      id: p.id,
      name: p.name,
      ...(p.classId ? { classId: p.classId } : {}),
      reconnectionCode: p.reconnectionCode,
      status: p.status,
      losses: p.losses,
      winnersLevel: p.winnersLevel,
      losersWins: p.losersWins,
      byes: p.byes,
      drawOrder: p.drawOrder,
      eliminationOrder: p.eliminationOrder,
      freeSince: iso(p.freeSince),
      suspendedAt: iso(p.suspendedAt),
      suspendedMatchId: p.suspendedMatchId,
    })),
    winnersMatches: tournament.winnersMatches.map(exportMatch),
    losersMatches: tournament.losersMatches.map(exportMatch),
    grandFinal: tournament.grandFinal ? exportMatch(tournament.grandFinal) : null,
    grandFinalReset: tournament.grandFinalReset ? exportMatch(tournament.grandFinalReset) : null,
  };
}

/** Reconstrói um torneio a partir de um export v2. Todos ficam desligados. */
export function importTournament(data: TournamentExport): Tournament {
  if (data.version !== 2) throw new Error(`Versão de exportação não suportada: ${String((data as { version?: unknown }).version)}`);

  const tournament = createTournament(data.gameId);
  tournament.id = data.id;
  tournament.phase = data.phase;
  tournament.createdAt = new Date(data.createdAt);
  tournament.startedAt = fromIso(data.startedAt);
  tournament.finishedAt = fromIso(data.finishedAt);
  tournament.championId = data.championId;
  tournament.nextMatchNumber = data.nextMatchNumber;
  tournament.eliminationCounter = data.eliminationCounter;

  for (const p of data.players) {
    const player: TournamentPlayer = {
      id: p.id,
      name: p.name,
      classId: p.classId,
      losses: p.losses,
      isConnected: false,
      socketId: null,
      reconnectionCode: p.reconnectionCode,
      status: p.status === 'eliminated' ? 'eliminated' : 'suspended',
      suspendedAt: p.status === 'eliminated' ? null : (fromIso(p.suspendedAt) ?? new Date()),
      suspendedMatchId: p.suspendedMatchId,
      winnersLevel: p.winnersLevel,
      losersWins: p.losersWins,
      byes: p.byes,
      freeSince: fromIso(p.freeSince),
      eliminationOrder: p.eliminationOrder,
      drawOrder: p.drawOrder,
    };
    tournament.players.push(player);
    tournament.playerById.set(player.id, player);
    tournament.playerByCode.set(player.reconnectionCode, player);
  }

  const importMatch = (m: ExportedMatch): TournamentMatch => {
    const match: TournamentMatch = {
      id: m.id,
      round: m.round,
      bracket: m.bracket,
      player1: m.player1,
      player2: m.player2,
      score: { ...m.score },
      bestOf: m.bestOf,
      currentGame: m.currentGame,
      whoStartsCurrentGame: m.whoStartsCurrentGame,
      phase: m.phase,
      winnerId: m.winnerId,
      player1Ready: m.player1Ready ?? false,
      player2Ready: m.player2Ready ?? false,
      gameState: m.gameState ?? null,
      whoseTurn: m.whoseTurn ?? null,
      moves: (m.moves ?? []).map(entry => ({
        playerId: (entry.by === 1 ? m.player1?.id : m.player2?.id) ?? '',
        move: entry.move,
        timestamp: new Date(),
      })),
      games: m.games.map(g => ({
        number: g.number,
        starter: g.starter,
        winner: g.winner,
        startedAt: fromIso(g.startedAt),
        endedAt: new Date(g.endedAt),
        moves: g.moves,
      })),
      gameStartedAt: fromIso(m.gameStartedAt),
      createdAt: new Date(m.createdAt),
      finishedAt: fromIso(m.finishedAt),
      // Ninguém está ligado depois de importar: confrontos por terminar ficam em pausa até voltarem os dois.
      isPaused: m.phase !== 'finished' ? true : (m.isPaused ?? false),
      pausedAt: m.phase !== 'finished' ? (fromIso(m.pausedAt) ?? new Date()) : fromIso(m.pausedAt),
      pausedByPlayerId: m.pausedByPlayerId ?? null,
      matchNumber: m.matchNumber,
      sourceMatch1: null,
      sourceMatch2: null,
      sourceLabel1: m.player1?.name ?? '',
      sourceLabel2: m.player2?.name ?? '',
      nextMatchIfWin: null,
      nextMatchIfLose: null,
      result: m.result,
    };
    tournament.matchById.set(match.id, match);
    return match;
  };

  tournament.winnersMatches = data.winnersMatches.map(importMatch);
  tournament.losersMatches = data.losersMatches.map(importMatch);
  tournament.grandFinal = data.grandFinal ? importMatch(data.grandFinal) : null;
  tournament.grandFinalReset = data.grandFinalReset ? importMatch(data.grandFinalReset) : null;
  refreshWaitingLists(tournament);
  return tournament;
}
