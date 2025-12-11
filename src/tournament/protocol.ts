/**
 * Protocolo de comunicação cliente ↔ servidor para o modo campeonato.
 * 
 * Alinhado com CLIENT-INTEGRATION_NEW.md
 * 
 * O campeonato usa dupla eliminação:
 * - Todos começam na Winners Bracket
 * - 1ª derrota → Losers Bracket
 * - 2ª derrota → Eliminado
 * - Final: vencedor Winners vs vencedor Losers (com possível "reset" se o da Losers ganhar)
 * 
 * Cada confronto é "melhor de 3" jogos, alternando quem começa.
 */

// ============================================================================
// Tipos base
// ============================================================================

export type GameId = 'gatos-caes' | 'dominorio' | 'quelhas' | 'produto' | 'atari-go' | 'nex';

export const GAME_NAMES: Record<GameId, string> = {
  'gatos-caes': 'Gatos & Cães',
  'dominorio': 'Dominório',
  'quelhas': 'Quelhas',
  'produto': 'Produto',
  'atari-go': 'Atari Go',
  'nex': 'Nex',
};

export interface Player {
  id: string;
  name: string;
  classId?: string;
  isOnline: boolean;
  isBot?: boolean;
}

export type BracketType = 'winners' | 'losers';

export type TournamentPhase = 
  | 'registration'  // inscrições abertas
  | 'running'       // campeonato a decorrer
  | 'finished';     // campeonato terminado

export type MatchPhase =
  | 'waiting'       // à espera que ambos jogadores estejam prontos
  | 'playing'       // jogo a decorrer
  | 'finished';     // confronto terminado

export interface MatchScore {
  player1Wins: number;
  player2Wins: number;
}

/** Sumário de match para listagem (usado em tournament_state_update) */
export interface MatchSummary {
  id: string;
  round: number;
  bracket: BracketType;
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
  score: MatchScore;
  phase: MatchPhase;
  winnerId: string | null;
}

/** Match completo (usado em match_assigned) */
export interface Match {
  id: string;
  round: number;
  bracket: BracketType;
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
  score: MatchScore;
  phase: MatchPhase;
  winnerId: string | null;
}

/** Estado do torneio conforme CLIENT-INTEGRATION_NEW */
export interface TournamentState {
  tournamentId: string;
  gameId: GameId;
  phase: TournamentPhase;
  players: Player[];
  winnersMatches: MatchSummary[];
  losersMatches: MatchSummary[];
  grandFinal: MatchSummary | null;
  grandFinalReset: MatchSummary | null;
  championId: string | null;
  championName: string | null;
}

// ============================================================================
// Mensagens do Cliente → Servidor
// ============================================================================

export interface JoinTournamentMessage {
  type: 'join_tournament';
  gameId: GameId;
  playerName: string;
  classId?: string;
  playerId?: string; // Para reconexão
}

export interface ReadyForMatchMessage {
  type: 'ready_for_match';
  matchId: string;
}

/** Jogada genérica – o payload depende do jogo */
export interface SubmitMoveMessage {
  type: 'submit_move';
  matchId: string;
  gameNumber: number;
  move: unknown; // cada jogo define o seu tipo de jogada
}

export interface LeaveTournamentMessage {
  type: 'leave_tournament';
}

export type ClientMessage =
  | JoinTournamentMessage
  | ReadyForMatchMessage
  | SubmitMoveMessage
  | LeaveTournamentMessage;

// ============================================================================
// Mensagens do Servidor → Cliente
// ============================================================================

export interface WelcomeMessage {
  type: 'welcome';
  playerId: string;
  playerName: string;
  tournamentId: string;
  tournamentState: TournamentState;
}

export interface TournamentStateUpdateMessage {
  type: 'tournament_state_update';
  tournamentId: string;
  gameId: GameId;
  phase: TournamentPhase;
  players: Player[];
  winnersMatches: MatchSummary[];
  losersMatches: MatchSummary[];
  grandFinal: MatchSummary | null;
  grandFinalReset: MatchSummary | null;
  championId: string | null;
  championName: string | null;
}

export interface MatchAssignedMessage {
  type: 'match_assigned';
  match: Match;
  yourRole: 'player1' | 'player2';
  opponentName: string;
}

export interface GameStartMessage {
  type: 'game_start';
  matchId: string;
  gameNumber: number;
  youStart: boolean;
  initialState: unknown;
  yourRole: 'player1' | 'player2';
}

export interface GameStateUpdateMessage {
  type: 'game_state_update';
  matchId: string;
  gameNumber: number;
  gameState: unknown;
  yourTurn: boolean;
  lastMove?: unknown;
  lastMoveBy?: 'player1' | 'player2';
}

export interface GameEndMessage {
  type: 'game_end';
  matchId: string;
  gameNumber: number;
  winnerId: string | null;
  winnerRole: 'player1' | 'player2' | null;
  isDraw: boolean;
  finalState: unknown;
  matchScore: MatchScore;
}

export interface MatchEndMessage {
  type: 'match_end';
  matchId: string;
  winnerId: string;
  winnerName: string;
  finalScore: MatchScore;
  youWon: boolean;
  nextMatchId?: string;
  eliminatedFromTournament: boolean;
}

export interface TournamentEndMessage {
  type: 'tournament_end';
  tournamentId: string;
  championId: string;
  championName: string;
  finalStandings: Array<{
    rank: number;
    playerId: string;
    playerName: string;
  }>;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface InfoMessage {
  type: 'info';
  message: string;
}

export type ServerMessage =
  | WelcomeMessage
  | TournamentStateUpdateMessage
  | MatchAssignedMessage
  | GameStartMessage
  | GameStateUpdateMessage
  | GameEndMessage
  | MatchEndMessage
  | TournamentEndMessage
  | ErrorMessage
  | InfoMessage;

// ============================================================================
// Helpers para converter entre formatos
// ============================================================================

/** Converte TournamentStateUpdateMessage em TournamentState */
export function tournamentStateFromUpdate(msg: TournamentStateUpdateMessage): TournamentState {
  return {
    tournamentId: msg.tournamentId,
    gameId: msg.gameId,
    phase: msg.phase,
    players: msg.players,
    winnersMatches: msg.winnersMatches,
    losersMatches: msg.losersMatches,
    grandFinal: msg.grandFinal,
    grandFinalReset: msg.grandFinalReset,
    championId: msg.championId,
    championName: msg.championName,
  };
}
