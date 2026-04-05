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
  // Campos para brackets pré-planeados (herdados de Match, mas declarados explicitamente)
  matchNumber: number;            // Número sequencial da partida
  sourceMatch1: number | null;    // Partida de origem do jogador 1
  sourceMatch2: number | null;    // Partida de origem do jogador 2
  sourceLabel1: string;           // "Vencedor do Jogo #X" ou nome do jogador
  sourceLabel2: string;           // Idem para jogador 2
  nextMatchIfWin: number | null;  // Próxima partida se ganhar
  nextMatchIfLose: number | null; // Próxima partida se perder (winners bracket)
  result: 'normal' | 'bye' | null; // null=não terminado, 'bye'=vitória automática
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

  // Contador para numeração de matches (pré-planeamento)
  nextMatchNumber: number;

  // Mapa de matchNumber para match (lookup rápido)
  matchByNumber: Map<number, TournamentMatch>;
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
    nextMatchNumber: 1,
    matchByNumber: new Map(),
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

interface CreateMatchOptions {
  bracket: BracketType | 'grandFinal' | 'grandFinalReset';
  round: number;
  matchNumber: number;
  player1?: TournamentPlayer | null;
  player2?: TournamentPlayer | null;
  sourceMatch1?: number | null;
  sourceMatch2?: number | null;
  sourceLabel1?: string;
  sourceLabel2?: string;
  nextMatchIfWin?: number | null;
  nextMatchIfLose?: number | null;
}

function createMatch(opts: CreateMatchOptions): TournamentMatch {
  const actualBracket: BracketType = opts.bracket === 'grandFinal' || opts.bracket === 'grandFinalReset'
    ? 'winners'
    : opts.bracket;

  return {
    id: generateId(),
    round: opts.round,
    bracket: actualBracket,
    player1: opts.player1 ? { id: opts.player1.id, name: opts.player1.name, classId: opts.player1.classId } : null,
    player2: opts.player2 ? { id: opts.player2.id, name: opts.player2.name, classId: opts.player2.classId } : null,
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
    // Campos para brackets pré-planeados
    matchNumber: opts.matchNumber,
    sourceMatch1: opts.sourceMatch1 ?? null,
    sourceMatch2: opts.sourceMatch2 ?? null,
    sourceLabel1: opts.sourceLabel1 ?? (opts.player1?.name ?? 'TBD'),
    sourceLabel2: opts.sourceLabel2 ?? (opts.player2?.name ?? 'TBD'),
    nextMatchIfWin: opts.nextMatchIfWin ?? null,
    nextMatchIfLose: opts.nextMatchIfLose ?? null,
    result: null,
  };
}

// ============================================================================
// Pré-planeamento de brackets (Double Elimination)
// ============================================================================

/**
 * Pré-planeia todas as partidas de um torneio de dupla eliminação.
 * Cria a estrutura completa do bracket desde o início.
 */
function planBracket(tournament: Tournament): void {
  const players = shuffle([...tournament.players]);
  const n = players.length;

  if (n < 2) return;

  // Calcular tamanho do bracket (próxima potência de 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const numByes = bracketSize - n;
  const winnersRounds = Math.log2(bracketSize);

  // Distribuir byes aleatoriamente
  const playersWithByes: (TournamentPlayer | null)[] = [...players];
  for (let i = 0; i < numByes; i++) {
    // Inserir byes em posições intercaladas para distribuição justa
    playersWithByes.push(null);
  }

  // Reorganizar para que byes fiquem distribuídos (não todos no fim)
  const seededPlayers = seedPlayersWithByes(playersWithByes, bracketSize);

  let matchNumber = 1;
  const allMatches: TournamentMatch[] = [];

  // Mapa para rastrear qual match alimenta qual
  const winnersMatchesByRound: TournamentMatch[][] = [];
  const losersMatchesByRound: TournamentMatch[][] = [];

  // ========================================
  // WINNERS BRACKET
  // ========================================

  // Ronda 1 do Winners
  const winnersR1: TournamentMatch[] = [];
  for (let i = 0; i < seededPlayers.length; i += 2) {
    const p1 = seededPlayers[i];
    const p2 = seededPlayers[i + 1];

    // Se ambos são bye, não criar match (não deveria acontecer com seeding correto)
    if (!p1 && !p2) continue;

    const match = createMatch({
      bracket: 'winners',
      round: 1,
      matchNumber: matchNumber++,
      player1: p1,
      player2: p2,
      sourceLabel1: p1?.name ?? 'BYE',
      sourceLabel2: p2?.name ?? 'BYE',
    });

    // Se um jogador tem bye, o match é automaticamente resolvido
    if (!p1 || !p2) {
      const winner = p1 || p2;
      match.winnerId = winner!.id;
      match.phase = 'finished';
      match.result = 'bye';
      match.score = p1 ? { player1Wins: 2, player2Wins: 0 } : { player1Wins: 0, player2Wins: 2 };
    }

    winnersR1.push(match);
    allMatches.push(match);
  }
  winnersMatchesByRound.push(winnersR1);

  // Rondas seguintes do Winners (R2 até final do winners)
  for (let round = 2; round <= winnersRounds; round++) {
    const prevRoundMatches = winnersMatchesByRound[round - 2];
    const thisRound: TournamentMatch[] = [];

    for (let i = 0; i < prevRoundMatches.length; i += 2) {
      const source1 = prevRoundMatches[i];
      const source2 = prevRoundMatches[i + 1];

      const match = createMatch({
        bracket: 'winners',
        round,
        matchNumber: matchNumber++,
        sourceMatch1: source1?.matchNumber ?? null,
        sourceMatch2: source2?.matchNumber ?? null,
        sourceLabel1: `Vencedor do Jogo #${source1?.matchNumber}`,
        sourceLabel2: source2 ? `Vencedor do Jogo #${source2.matchNumber}` : 'BYE',
      });

      thisRound.push(match);
      allMatches.push(match);

      // Configurar nextMatchIfWin dos matches anteriores
      if (source1) source1.nextMatchIfWin = match.matchNumber;
      if (source2) source2.nextMatchIfWin = match.matchNumber;
    }
    winnersMatchesByRound.push(thisRound);
  }

  // ========================================
  // LOSERS BRACKET
  // ========================================

  // O losers bracket recebe perdedores do winners em diferentes pontos
  // Ronda 1 do Losers: perdedores do Winners R1
  // Ronda 2 do Losers: vencedores de Losers R1 vs perdedores do Winners R2
  // etc.

  // Losers R1: perdedores do Winners R1 (apenas se houver pelo menos 2 matches no Winners R1)
  // Rastrear match ímpar do Winners R1 (sem par no Losers R1)
  let oddWinnersR1Match: TournamentMatch | null = null;

  if (winnersMatchesByRound[0].length >= 2) {
    const losersR1: TournamentMatch[] = [];
    const winnersR1Matches = winnersMatchesByRound[0].filter(m => m.result !== 'bye');

    for (let i = 0; i < winnersR1Matches.length; i += 2) {
      const source1 = winnersR1Matches[i];
      const source2 = winnersR1Matches[i + 1];

      if (!source2) {
        // Número ímpar de matches - rastrear para configurar nextMatchIfLose depois
        oddWinnersR1Match = source1;
        continue;
      }

      const match = createMatch({
        bracket: 'losers',
        round: 1,
        matchNumber: matchNumber++,
        sourceMatch1: source1?.matchNumber ?? null,
        sourceMatch2: source2?.matchNumber ?? null,
        sourceLabel1: `Perdedor do Jogo #${source1?.matchNumber}`,
        sourceLabel2: `Perdedor do Jogo #${source2?.matchNumber}`,
      });

      losersR1.push(match);
      allMatches.push(match);

      // Configurar nextMatchIfLose dos matches do Winners R1
      if (source1) source1.nextMatchIfLose = match.matchNumber;
      if (source2) source2.nextMatchIfLose = match.matchNumber;
    }
    if (losersR1.length > 0) {
      losersMatchesByRound.push(losersR1);
    }
  }

  // Rondas seguintes do Losers
  // Padrão alternado: ronda de consolidação (losers vs losers) + ronda mista (perdedor winners entra)
  let losersRound = losersMatchesByRound.length > 0 ? 2 : 1;
  let winnersRoundForDropdown = 2; // Começa a receber perdedores do Winners R2

  while (winnersRoundForDropdown <= winnersRounds || losersMatchesByRound.length > 0) {
    // Ronda de entrada de perdedores do Winners
    if (winnersRoundForDropdown <= winnersRounds && winnersMatchesByRound[winnersRoundForDropdown - 1]) {
      const winnersDropping = winnersMatchesByRound[winnersRoundForDropdown - 1];
      const prevLosersMatches = losersMatchesByRound[losersMatchesByRound.length - 1] || [];
      const thisRound: TournamentMatch[] = [];

      // Emparelhar perdedores do winners com vencedores do losers
      const numMatchesNeeded = Math.max(winnersDropping.length, prevLosersMatches.length);

      for (let i = 0; i < numMatchesNeeded; i++) {
        const winnersDrop = winnersDropping[i];
        const losersAdvance = prevLosersMatches[i];

        if (!winnersDrop && !losersAdvance && !oddWinnersR1Match) continue; // Only skip if absolutely no source

        // Se não há losersAdvance mas há oddWinnersR1Match, usar o perdedor desse match
        const oddMatchAsSource = !losersAdvance && oddWinnersR1Match ? oddWinnersR1Match : null;

        const match = createMatch({
          bracket: 'losers',
          round: losersRound,
          matchNumber: matchNumber++,
          sourceMatch1: oddMatchAsSource?.matchNumber ?? losersAdvance?.matchNumber ?? null,
          sourceMatch2: winnersDrop?.matchNumber ?? null,
          sourceLabel1: oddMatchAsSource
            ? `Perdedor do Jogo #${oddMatchAsSource.matchNumber}`
            : (losersAdvance ? `Vencedor do Jogo #${losersAdvance.matchNumber}` : 'BYE'),
          sourceLabel2: winnersDrop ? `Perdedor do Jogo #${winnersDrop.matchNumber}` : 'BYE',
        });

        thisRound.push(match);
        allMatches.push(match);

        // Configurar links
        if (losersAdvance) losersAdvance.nextMatchIfWin = match.matchNumber;
        if (oddMatchAsSource) {
          oddMatchAsSource.nextMatchIfLose = match.matchNumber;
          oddWinnersR1Match = null; // Já foi usado, limpar
        }
        if (winnersDrop) winnersDrop.nextMatchIfLose = match.matchNumber;
      }

      if (thisRound.length > 0) {
        losersMatchesByRound.push(thisRound);
        losersRound++;
      }

      winnersRoundForDropdown++;
    }

    // Ronda de consolidação no losers (se necessário)
    const lastLosersRound = losersMatchesByRound[losersMatchesByRound.length - 1];
    if (lastLosersRound && lastLosersRound.length >= 2) {
      const consolidationRound: TournamentMatch[] = [];

      for (let i = 0; i < lastLosersRound.length; i += 2) {
        const source1 = lastLosersRound[i];
        const source2 = lastLosersRound[i + 1];

        if (!source2) continue; // Número ímpar, avança automaticamente

        const match = createMatch({
          bracket: 'losers',
          round: losersRound,
          matchNumber: matchNumber++,
          sourceMatch1: source1?.matchNumber ?? null,
          sourceMatch2: source2?.matchNumber ?? null,
          sourceLabel1: `Vencedor do Jogo #${source1?.matchNumber}`,
          sourceLabel2: `Vencedor do Jogo #${source2?.matchNumber}`,
        });

        consolidationRound.push(match);
        allMatches.push(match);

        if (source1) source1.nextMatchIfWin = match.matchNumber;
        if (source2) source2.nextMatchIfWin = match.matchNumber;
      }

      if (consolidationRound.length > 0) {
        losersMatchesByRound.push(consolidationRound);
        losersRound++;
      }
    }

    // Verificar se já terminamos (1 match no losers e não há mais perdedores a entrar)
    const currentLosers = losersMatchesByRound[losersMatchesByRound.length - 1];
    if (currentLosers && currentLosers.length === 1 && winnersRoundForDropdown > winnersRounds) {
      break;
    }

    // Prevenção de loop infinito
    if (losersMatchesByRound.length > 20) break;
  }

  // ========================================
  // GRAND FINAL
  // ========================================

  const winnersChampionMatch = winnersMatchesByRound[winnersMatchesByRound.length - 1]?.[0];
  const losersChampionMatch = losersMatchesByRound[losersMatchesByRound.length - 1]?.[0];

  if (winnersChampionMatch && losersChampionMatch) {
    const grandFinal = createMatch({
      bracket: 'grandFinal',
      round: 999,
      matchNumber: matchNumber++,
      sourceMatch1: winnersChampionMatch.matchNumber,
      sourceMatch2: losersChampionMatch.matchNumber,
      sourceLabel1: `Vencedor do Jogo #${winnersChampionMatch.matchNumber}`,
      sourceLabel2: `Vencedor do Jogo #${losersChampionMatch.matchNumber}`,
    });

    winnersChampionMatch.nextMatchIfWin = grandFinal.matchNumber;
    losersChampionMatch.nextMatchIfWin = grandFinal.matchNumber;

    tournament.grandFinal = grandFinal;
    allMatches.push(grandFinal);

    // Grand Final Reset (pré-criado mas só usado se necessário)
    const grandFinalReset = createMatch({
      bracket: 'grandFinalReset',
      round: 1000,
      matchNumber: matchNumber++,
      sourceMatch1: grandFinal.matchNumber,
      sourceMatch2: grandFinal.matchNumber,
      sourceLabel1: 'Vencedor da Grand Final',
      sourceLabel2: 'Perdedor da Grand Final',
    });

    grandFinal.nextMatchIfLose = grandFinalReset.matchNumber; // Se winner do winners perder
    tournament.grandFinalReset = grandFinalReset;
    allMatches.push(grandFinalReset);
  } else if (n === 2 && winnersChampionMatch) {
    const grandFinal = createMatch({
      bracket: 'grandFinal',
      round: 999,
      matchNumber: matchNumber++,
      sourceMatch1: winnersChampionMatch.matchNumber,
      sourceMatch2: winnersChampionMatch.matchNumber,
      sourceLabel1: `Vencedor do Jogo #${winnersChampionMatch.matchNumber}`,
      sourceLabel2: `Perdedor do Jogo #${winnersChampionMatch.matchNumber}`,
    });

    winnersChampionMatch.nextMatchIfWin = grandFinal.matchNumber;
    winnersChampionMatch.nextMatchIfLose = grandFinal.matchNumber;

    tournament.grandFinal = grandFinal;
    allMatches.push(grandFinal);

    const grandFinalReset = createMatch({
      bracket: 'grandFinalReset',
      round: 1000,
      matchNumber: matchNumber++,
      sourceMatch1: grandFinal.matchNumber,
      sourceMatch2: grandFinal.matchNumber,
      sourceLabel1: 'Vencedor da Grand Final',
      sourceLabel2: 'Perdedor da Grand Final',
    });

    grandFinal.nextMatchIfLose = grandFinalReset.matchNumber;
    tournament.grandFinalReset = grandFinalReset;
    allMatches.push(grandFinalReset);
  }

  // ========================================
  // Registar todos os matches
  // ========================================

  tournament.winnersMatches = winnersMatchesByRound.flat();
  tournament.losersMatches = losersMatchesByRound.flat();

  for (const match of allMatches) {
    tournament.matchById.set(match.id, match);
    tournament.matchByNumber.set(match.matchNumber, match);
  }

  tournament.nextMatchNumber = matchNumber;

  // Propagar jogadores de matches com bye para os próximos matches
  propagateByeWinners(tournament);

  // Resolver matches do Losers que têm TBD (sem fonte de jogador)
  resolveLosersBracketTBDs(tournament);
}

/**
 * Distribui jogadores e byes de forma equilibrada no bracket.
 */
function seedPlayersWithByes(
  players: (TournamentPlayer | null)[],
  bracketSize: number
): (TournamentPlayer | null)[] {
  const actualPlayers = players.filter(p => p !== null) as TournamentPlayer[];
  const result: (TournamentPlayer | null)[] = [...actualPlayers];

  while (result.length < bracketSize) {
    result.push(null);
  }

  return result;
}

/**
 * Gera a ordem de seeds para distribuição equilibrada.
 */
function generateSeedOrder(size: number): number[] {
  if (size === 2) return [0, 1];

  const halfSize = size / 2;
  const topHalf = generateSeedOrder(halfSize);
  const bottomHalf = generateSeedOrder(halfSize).map(i => i + halfSize);

  // Intercalar as duas metades
  const result: number[] = [];
  for (let i = 0; i < halfSize; i++) {
    result.push(topHalf[i], bottomHalf[halfSize - 1 - i]);
  }
  return result;
}

/**
 * Resolve matches do Losers Bracket que têm TBD (sem fonte de jogador).
 * Estes são convertidos em byes quando apenas um jogador está presente.
 */
function resolveLosersBracketTBDs(tournament: Tournament): void {
  for (const match of tournament.losersMatches) {
    // Se o match já tem resultado, ignorar
    if (match.result !== null) continue;

    // Se não tem player1 mas tem player2, e sourceMatch1 é null (sem fonte)
    // Então é um bye - o player2 avança
    if (!match.player1 && match.player2 && match.sourceMatch1 === null) {
      match.winnerId = match.player2.id;
      match.phase = 'finished';
      match.result = 'bye';
      match.score = { player1Wins: 0, player2Wins: 2 };
      match.sourceLabel1 = 'BYE';

      // Propagar para o próximo match
      const winnerPlayer = tournament.playerById.get(match.player2.id);
      if (winnerPlayer && match.nextMatchIfWin) {
        const nextMatch = tournament.matchByNumber.get(match.nextMatchIfWin);
        if (nextMatch) {
          assignPlayerToMatch(nextMatch, winnerPlayer, match);
        }
      }
    }

    // Caso inverso: tem player1 mas não tem player2, e sourceMatch2 é null
    if (match.player1 && !match.player2 && match.sourceMatch2 === null) {
      match.winnerId = match.player1.id;
      match.phase = 'finished';
      match.result = 'bye';
      match.score = { player1Wins: 2, player2Wins: 0 };
      match.sourceLabel2 = 'BYE';

      // Propagar para o próximo match
      const winnerPlayer = tournament.playerById.get(match.player1.id);
      if (winnerPlayer && match.nextMatchIfWin) {
        const nextMatch = tournament.matchByNumber.get(match.nextMatchIfWin);
        if (nextMatch) {
          assignPlayerToMatch(nextMatch, winnerPlayer, match);
        }
      }
    }
  }

  // Recursivamente resolver novos TBDs criados pela propagação
  let hasChanges = true;
  let iterations = 0;
  while (hasChanges && iterations < 10) {
    hasChanges = false;
    iterations++;

    for (const match of tournament.losersMatches) {
      if (match.result !== null) continue;

      const hasP1 = match.player1 !== null;
      const hasP2 = match.player2 !== null;

      if (hasP1 !== hasP2) {
        // Verificar se a fonte em falta não vai enviar mais ninguém
        const missingSource = hasP1 ? match.sourceMatch2 : match.sourceMatch1;
        if (missingSource === null) {
          const winner = hasP1 ? match.player1 : match.player2;
          if (winner) {
            match.winnerId = winner.id;
            match.phase = 'finished';
            match.result = 'bye';
            match.score = hasP1 ? { player1Wins: 2, player2Wins: 0 } : { player1Wins: 0, player2Wins: 2 };
            hasChanges = true;

            const winnerPlayer = tournament.playerById.get(winner.id);
            if (winnerPlayer && match.nextMatchIfWin) {
              const nextMatch = tournament.matchByNumber.get(match.nextMatchIfWin);
              if (nextMatch) {
                assignPlayerToMatch(nextMatch, winnerPlayer, match);
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Propaga os vencedores de matches com bye para os próximos matches.
 */
function propagateByeWinners(tournament: Tournament): void {
  const processedMatches = new Set<number>();

  function propagateWinner(match: TournamentMatch): void {
    if (processedMatches.has(match.matchNumber)) return;
    processedMatches.add(match.matchNumber);

    if (match.result !== 'bye' || !match.winnerId) return;

    const winner = tournament.playerById.get(match.winnerId);
    if (!winner) return;

    // Propagar para o próximo match (se existe)
    if (match.nextMatchIfWin) {
      const nextMatch = tournament.matchByNumber.get(match.nextMatchIfWin);
      if (nextMatch) {
        assignPlayerToMatch(nextMatch, winner, match);
        // Se o próximo match também ficar com bye (só 1 jogador), propagar recursivamente
        checkAndResolveBye(tournament, nextMatch);
      }
    }
  }

  // Processar todos os matches com bye
  for (const match of tournament.winnersMatches) {
    propagateWinner(match);
  }
  for (const match of tournament.losersMatches) {
    propagateWinner(match);
  }
}

/**
 * Verifica se um match tem apenas 1 jogador e deve ser resolvido como bye.
 */
function checkAndResolveBye(tournament: Tournament, match: TournamentMatch): void {
  // Se já tem vencedor ou está a jogar, não fazer nada
  if (match.winnerId || match.phase === 'playing') return;

  // Verificar se só tem 1 jogador (o outro é TBD de um bye)
  const hasPlayer1 = match.player1 !== null;
  const hasPlayer2 = match.player2 !== null;

  // Se ambos têm jogador, não é bye - é um match normal
  if (hasPlayer1 && hasPlayer2) return;

  // Se ambos não têm jogador, ainda não há dados suficientes
  if (!hasPlayer1 && !hasPlayer2) return;

  // Caso especial: se a fonte do slot vazio é NULL, significa que nunca vai haver jogador
  // Nesse caso, o jogador existente ganha por bye imediato
  if (!hasPlayer1 && match.sourceMatch1 === null) {
    // Slot 1 nunca terá jogador - player2 ganha por bye
    const winner = match.player2;
    if (winner) {
      match.winnerId = winner.id;
      match.phase = 'finished';
      match.result = 'bye';
      match.score = { player1Wins: 0, player2Wins: 2 };
      match.sourceLabel1 = 'BYE';

      // Propagar para o próximo match
      const winnerPlayer = tournament.playerById.get(winner.id);
      if (winnerPlayer && match.nextMatchIfWin) {
        const nextMatch = tournament.matchByNumber.get(match.nextMatchIfWin);
        if (nextMatch) {
          assignPlayerToMatch(nextMatch, winnerPlayer, match);
          checkAndResolveBye(tournament, nextMatch);
        }
      }
      return;
    }
  }

  if (!hasPlayer2 && match.sourceMatch2 === null) {
    // Slot 2 nunca terá jogador - player1 ganha por bye
    const winner = match.player1;
    if (winner) {
      match.winnerId = winner.id;
      match.phase = 'finished';
      match.result = 'bye';
      match.score = { player1Wins: 2, player2Wins: 0 };
      match.sourceLabel2 = 'BYE';

      // Propagar para o próximo match
      const winnerPlayer = tournament.playerById.get(winner.id);
      if (winnerPlayer && match.nextMatchIfWin) {
        const nextMatch = tournament.matchByNumber.get(match.nextMatchIfWin);
        if (nextMatch) {
          assignPlayerToMatch(nextMatch, winnerPlayer, match);
          checkAndResolveBye(tournament, nextMatch);
        }
      }
      return;
    }
  }

  // Verificar se as fontes têm vencedores que ainda não propagaram
  // Se uma fonte terminou com vencedor mas o slot está vazio, aguardar propagação
  if (!hasPlayer1 && match.sourceMatch1) {
    const src1 = tournament.matchByNumber.get(match.sourceMatch1);
    // Se a fonte ainda não terminou, ou terminou com vencedor (propagação pendente)
    if (src1 && (src1.phase !== 'finished' || src1.winnerId)) return;
  }
  if (!hasPlayer2 && match.sourceMatch2) {
    const src2 = tournament.matchByNumber.get(match.sourceMatch2);
    // Se a fonte ainda não terminou, ou terminou com vencedor (propagação pendente)
    if (src2 && (src2.phase !== 'finished' || src2.winnerId)) return;
  }

  // Só 1 jogador e ambas as fontes terminaram - resolver como bye
  const winner = hasPlayer1 ? match.player1 : match.player2;
  if (!winner) return;

  match.winnerId = winner.id;
  match.phase = 'finished';
  match.result = 'bye';
  match.score = hasPlayer1 ? { player1Wins: 2, player2Wins: 0 } : { player1Wins: 0, player2Wins: 2 };

  // Propagar para o próximo match
  const winnerPlayer = tournament.playerById.get(winner.id);
  if (winnerPlayer && match.nextMatchIfWin) {
    const nextMatch = tournament.matchByNumber.get(match.nextMatchIfWin);
    if (nextMatch) {
      assignPlayerToMatch(nextMatch, winnerPlayer, match);
      checkAndResolveBye(tournament, nextMatch);
    }
  }
}

/**
 * Atribui um jogador a um slot vazio de um match.
 */
function assignPlayerToMatch(
  match: TournamentMatch,
  player: TournamentPlayer,
  sourceMatch: TournamentMatch
): void {
  const playerInfo = { id: player.id, name: player.name, classId: player.classId };

  if (
    match.sourceMatch1 === sourceMatch.matchNumber &&
    match.sourceMatch2 === sourceMatch.matchNumber
  ) {
    if (!match.player1) {
      match.player1 = playerInfo;
      match.sourceLabel1 = `Vencedor: ${sourceMatch.player1?.name ?? player.name} vs ${sourceMatch.player2?.name ?? player.name}`;
      return;
    }
    if (!match.player2 && match.player1.id !== player.id) {
      match.player2 = playerInfo;
      match.sourceLabel2 = `Perdedor: ${sourceMatch.player1?.name ?? player.name} vs ${sourceMatch.player2?.name ?? player.name}`;
      return;
    }
  }

  // Determinar qual slot (player1 ou player2) baseado na fonte
  if (match.sourceMatch1 === sourceMatch.matchNumber) {
    match.player1 = playerInfo;
    // Atualizar label com nomes reais
    if (sourceMatch.player1 && sourceMatch.player2) {
      match.sourceLabel1 = `Vencedor: ${sourceMatch.player1.name} vs ${sourceMatch.player2.name}`;
    } else {
      match.sourceLabel1 = player.name;
    }
  } else if (match.sourceMatch2 === sourceMatch.matchNumber) {
    match.player2 = playerInfo;
    if (sourceMatch.player1 && sourceMatch.player2) {
      match.sourceLabel2 = `Vencedor: ${sourceMatch.player1.name} vs ${sourceMatch.player2.name}`;
    } else {
      match.sourceLabel2 = player.name;
    }
  } else {
    // Fallback: atribuir ao primeiro slot vazio
    if (!match.player1) {
      match.player1 = playerInfo;
      match.sourceLabel1 = player.name;
    } else if (!match.player2) {
      match.player2 = playerInfo;
      match.sourceLabel2 = player.name;
    }
  }
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

  // Pré-planear todas as partidas do torneio
  planBracket(tournament);

  const initialWinners = tournament.winnersMatches.filter((match) => match.round === 1 && match.result !== 'bye');
  const roundOneByeWinners = tournament.winnersMatches
    .filter((match) => match.round === 1 && match.result === 'bye' && match.winnerId)
    .map((match) => match.winnerId!)
    .filter(Boolean);

  tournament.winnersMatches = initialWinners;
  tournament.losersMatches = [];
  tournament.winnersWaiting = [...roundOneByeWinners];
  tournament.losersWaiting = [];
  tournament.grandFinal = null;
  tournament.grandFinalReset = null;

  return true;
}

function isMatchVisible(tournament: Tournament, match: TournamentMatch): boolean {
  return (
    tournament.winnersMatches.some((item) => item.id === match.id) ||
    tournament.losersMatches.some((item) => item.id === match.id) ||
    tournament.grandFinal?.id === match.id ||
    tournament.grandFinalReset?.id === match.id
  );
}

function removeWaitingPlayer(tournament: Tournament, playerId: string): void {
  tournament.winnersWaiting = tournament.winnersWaiting.filter((id) => id !== playerId);
  tournament.losersWaiting = tournament.losersWaiting.filter((id) => id !== playerId);
}

function revealMatch(tournament: Tournament, match: TournamentMatch): void {
  if (isMatchVisible(tournament, match)) return;

  if (match.round === 999) {
    tournament.grandFinal = match;
  } else if (match.round === 1000) {
    tournament.grandFinalReset = match;
  } else if (match.bracket === 'winners') {
    tournament.winnersMatches.push(match);
  } else {
    tournament.losersMatches.push(match);
  }

  if (match.player1?.id) removeWaitingPlayer(tournament, match.player1.id);
  if (match.player2?.id) removeWaitingPlayer(tournament, match.player2.id);
}

// ============================================================================
// Processamento de resultados de match (com brackets pré-planeados)
// ============================================================================

/**
 * Avança um jogador para o próximo match pré-planeado.
 * Atualiza os labels com os nomes reais dos jogadores.
 */
function advancePlayerToNextMatch(
  tournament: Tournament,
  match: TournamentMatch,
  player: TournamentPlayer,
  isWinner: boolean
): TournamentMatch | null {
  const nextMatchNumber = isWinner ? match.nextMatchIfWin : match.nextMatchIfLose;
  if (!nextMatchNumber) return null;

  const nextMatch = tournament.matchByNumber.get(nextMatchNumber);
  if (!nextMatch) return null;

  // Atribuir jogador ao próximo match
  assignPlayerToMatch(nextMatch, player, match);

  // Verificar se o próximo match tem ambos jogadores e pode começar
  // (ou se é um bye automático)
  checkAndResolveBye(tournament, nextMatch);

  if (nextMatch.player1 && nextMatch.player2 && nextMatch.phase === 'waiting') {
    revealMatch(tournament, nextMatch);
  }

  return nextMatch;
}

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

  // Marcar match como terminado
  match.winnerId = winnerId;
  match.phase = 'finished';
  match.result = 'normal';

  const affectedPlayerIds = [winnerId, loserId];
  const matchesNowReady: TournamentMatch[] = [];

  // ========================================
  // Verifica se é Grand Final
  // ========================================
  if (tournament.grandFinal && tournament.grandFinal.id === matchId) {
    // Se o campeão da losers (player2) ganhou, ativar o Grand Final Reset
    if (winnerId === match.player2!.id) {
      const reset =
        tournament.grandFinalReset ??
        (match.nextMatchIfLose ? tournament.matchByNumber.get(match.nextMatchIfLose) ?? null : null);
      if (!reset) {
        return { affectedPlayerIds, newMatches: [], isGrandFinal: true, isTournamentEnd: true };
      }

      // Ativar o Grand Final Reset pré-criado
      reset.player1 = { id: winner.id, name: winner.name, classId: winner.classId };
      reset.player2 = { id: loser.id, name: loser.name, classId: loser.classId };
      reset.sourceLabel1 = winner.name;
      reset.sourceLabel2 = loser.name;
      tournament.grandFinalReset = reset;
      matchesNowReady.push(reset);
      return { affectedPlayerIds, newMatches: matchesNowReady, isGrandFinal: true, isTournamentEnd: false };
    } else {
      // Campeão da winners ganhou - torneio termina
      tournament.championId = winnerId;
      tournament.phase = 'finished';
      tournament.finishedAt = new Date();
      return { affectedPlayerIds, newMatches: [], isGrandFinal: true, isTournamentEnd: true };
    }
  }

  // ========================================
  // Verifica se é Grand Final Reset
  // ========================================
  if (tournament.grandFinalReset && tournament.grandFinalReset.id === matchId) {
    tournament.championId = winnerId;
    tournament.phase = 'finished';
    tournament.finishedAt = new Date();
    return { affectedPlayerIds, newMatches: [], isGrandFinal: true, isTournamentEnd: true };
  }

  // ========================================
  // Match normal: avançar jogadores
  // ========================================
  loser.losses++;

  // Avançar vencedor para o próximo match
  const nextWinMatch = advancePlayerToNextMatch(tournament, match, winner, true);
  if (nextWinMatch && nextWinMatch.player1 && nextWinMatch.player2 && nextWinMatch.phase === 'waiting') {
    matchesNowReady.push(nextWinMatch);
  } else if (match.nextMatchIfWin) {
    tournament.winnersWaiting.push(winnerId);
  }

  // Se é winners bracket, perdedor vai para losers bracket
  if (match.bracket === 'winners' && loser.losses < 2) {
    const nextLoseMatch = advancePlayerToNextMatch(tournament, match, loser, false);
    if (nextLoseMatch && nextLoseMatch.player1 && nextLoseMatch.player2 && nextLoseMatch.phase === 'waiting') {
      // Não duplicar se for o mesmo match
      if (!matchesNowReady.includes(nextLoseMatch)) {
        matchesNowReady.push(nextLoseMatch);
      }
    } else if (match.nextMatchIfLose) {
      tournament.losersWaiting.push(loserId);
    }
  }

  // Se é losers bracket, perdedor é eliminado (já tem 2 derrotas)
  if (match.bracket === 'losers') {
    loser.status = 'eliminated';
  }

  return { affectedPlayerIds, newMatches: matchesNowReady, isGrandFinal: false, isTournamentEnd: false };
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

  // Filtrar matches de BYE do Losers e reajustar labels
  const { filteredLosers, labelRemapping } = filterByeMatches(tournament);

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
    losersMatches: filteredLosers.map(m => toProtocolMatchWithRemapping(m, labelRemapping)),
    grandFinal: tournament.grandFinal ? toProtocolMatch(tournament.grandFinal) : null,
    grandFinalReset: tournament.grandFinalReset ? toProtocolMatch(tournament.grandFinalReset) : null,
    championId: tournament.championId,
    championName: champion?.name ?? null,
  };
}

/**
 * Filtra matches BYE do Losers e cria mapeamento de labels.
 * Matches BYE são aqueles que têm sourceLabel1 === 'BYE' ou sourceLabel2 === 'BYE'.
 */
function filterByeMatches(tournament: Tournament): {
  filteredLosers: TournamentMatch[];
  labelRemapping: Map<number, string>;
} {
  const labelRemapping = new Map<number, string>();
  const byeMatches = new Set<number>();

  // Identificar matches BYE e criar remapeamento
  for (const match of tournament.losersMatches) {
    const isBye1 = match.sourceLabel1 === 'BYE';
    const isBye2 = match.sourceLabel2 === 'BYE';

    if (isBye1 && !isBye2 && match.sourceMatch2) {
      // Slot 1 é BYE, jogador vem do slot 2
      byeMatches.add(match.matchNumber);
      labelRemapping.set(match.matchNumber, match.sourceLabel2);
    } else if (isBye2 && !isBye1 && match.sourceMatch1) {
      // Slot 2 é BYE, jogador vem do slot 1
      byeMatches.add(match.matchNumber);
      labelRemapping.set(match.matchNumber, match.sourceLabel1);
    }
  }

  // Filtrar matches BYE
  const filteredLosers = tournament.losersMatches.filter(m => !byeMatches.has(m.matchNumber));

  return { filteredLosers, labelRemapping };
}

/**
 * Converte match para protocolo, aplicando remapeamento de labels.
 */
function toProtocolMatchWithRemapping(
  match: TournamentMatch,
  labelRemapping: Map<number, string>
): Match {
  let label1 = match.sourceLabel1;
  let label2 = match.sourceLabel2;

  // Remapar labels que apontam para matches BYE
  if (match.sourceMatch1 && labelRemapping.has(match.sourceMatch1)) {
    label1 = labelRemapping.get(match.sourceMatch1) || label1;
  }
  if (match.sourceMatch2 && labelRemapping.has(match.sourceMatch2)) {
    label2 = labelRemapping.get(match.sourceMatch2) || label2;
  }

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
    matchNumber: match.matchNumber,
    sourceMatch1: match.sourceMatch1,
    sourceMatch2: match.sourceMatch2,
    sourceLabel1: label1,
    sourceLabel2: label2,
    nextMatchIfWin: match.nextMatchIfWin,
    nextMatchIfLose: match.nextMatchIfLose,
    result: match.result,
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
    // Campos para brackets pré-planeados
    matchNumber: match.matchNumber,
    sourceMatch1: match.sourceMatch1,
    sourceMatch2: match.sourceMatch2,
    sourceLabel1: match.sourceLabel1,
    sourceLabel2: match.sourceLabel2,
    nextMatchIfWin: match.nextMatchIfWin,
    nextMatchIfLose: match.nextMatchIfLose,
    result: match.result,
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
 * Todos os matches onde o jogador está envolvido recebem vitória automática para o adversário.
 * A vitória é propagada pelos matches pré-planeados.
 */
export function eliminatePlayer(
  tournament: Tournament,
  playerId: string
): { forfeitedMatchIds: string[]; advancedMatches: TournamentMatch[] } {
  const player = tournament.playerById.get(playerId);
  if (!player) return { forfeitedMatchIds: [], advancedMatches: [] };

  player.status = 'eliminated';
  player.losses = 2; // Marcar como eliminado
  player.isConnected = false;
  player.suspendedAt = null;
  player.suspendedMatchId = null;

  const forfeitedMatchIds: string[] = [];
  const advancedMatches: TournamentMatch[] = [];
  const processedMatches = new Set<string>();

  // Encontrar todos os matches onde este jogador está envolvido (incluindo pendentes)
  const allMatches = [...tournament.winnersMatches, ...tournament.losersMatches]
    .concat(tournament.grandFinal ? [tournament.grandFinal] : [])
    .concat(tournament.grandFinalReset ? [tournament.grandFinalReset] : []);

  // Processar matches em ordem de matchNumber para garantir propagação correta
  const matchesToProcess = allMatches
    .filter(m => m.phase !== 'finished' && (m.player1?.id === playerId || m.player2?.id === playerId))
    .sort((a, b) => a.matchNumber - b.matchNumber);

  for (const match of matchesToProcess) {
    if (processedMatches.has(match.id)) continue;
    processedMatches.add(match.id);

    // Forfeit este match e avançar o adversário
    const result = forfeitMatchWithAdvance(tournament, match.id, playerId);
    if (result.winnerId) {
      forfeitedMatchIds.push(match.id);
      if (result.advancedMatch) {
        advancedMatches.push(result.advancedMatch);
      }
    }
  }

  return { forfeitedMatchIds, advancedMatches };
}

/**
 * Forfeit um match e avançar o adversário usando os brackets pré-planeados.
 */
function forfeitMatchWithAdvance(
  tournament: Tournament,
  matchId: string,
  forfeitingPlayerId: string
): { winnerId: string | null; advancedMatch: TournamentMatch | null } {
  const match = tournament.matchById.get(matchId);
  if (!match || match.phase === 'finished') {
    return { winnerId: null, advancedMatch: null };
  }

  // O vencedor é o outro jogador
  const winnerId = match.player1?.id === forfeitingPlayerId
    ? match.player2?.id
    : match.player1?.id;

  if (!winnerId) {
    // Se não há adversário, apenas marcar como terminado sem vencedor
    match.phase = 'finished';
    match.result = 'bye';
    return { winnerId: null, advancedMatch: null };
  }

  const winner = tournament.playerById.get(winnerId);
  if (!winner) {
    return { winnerId: null, advancedMatch: null };
  }

  // Limpar estado de pausa se existia
  match.isPaused = false;
  match.pausedAt = null;
  match.pausedByPlayerId = null;

  // Dá vitória ao outro jogador (2-0 automático)
  match.score = match.player1?.id === winnerId
    ? { player1Wins: 2, player2Wins: 0 }
    : { player1Wins: 0, player2Wins: 2 };

  match.winnerId = winnerId;
  match.phase = 'finished';
  match.result = 'bye';

  // Avançar o vencedor para o próximo match
  let advancedMatch: TournamentMatch | null = null;
  if (match.nextMatchIfWin) {
    const nextMatch = tournament.matchByNumber.get(match.nextMatchIfWin);
    if (nextMatch && nextMatch.phase !== 'finished') {
      assignPlayerToMatch(nextMatch, winner, match);
      checkAndResolveBye(tournament, nextMatch);
      if (nextMatch.player1 && nextMatch.player2 && nextMatch.phase === 'waiting') {
        advancedMatch = nextMatch;
      }
    }
  }

  return { winnerId, advancedMatch };
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
  const result = forfeitMatchWithAdvance(tournament, matchId, forfeitingPlayerId);
  return result.winnerId;
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
  nextMatchNumber: number;
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
    nextMatchNumber: tournament.nextMatchNumber,
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
  const matchByNumber = new Map<number, TournamentMatch>();

  const allMatches = [
    ...winnersMatches,
    ...losersMatches,
    ...(grandFinal ? [grandFinal] : []),
    ...(grandFinalReset ? [grandFinalReset] : []),
  ];

  for (const match of allMatches) {
    matchById.set(match.id, match);
    matchByNumber.set(match.matchNumber, match);
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
    nextMatchNumber: data.nextMatchNumber,
    matchByNumber,
  };
}
