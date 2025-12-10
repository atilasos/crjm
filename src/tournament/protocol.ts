/**
 * Protocolo de comunicação cliente ↔ servidor para o modo campeonato.
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
  classId?: string; // turma
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

export interface Match {
  id: string;
  round: number;
  bracket: BracketType;
  player1: Player | null;
  player2: Player | null;
  score: MatchScore;
  bestOf: number; // normalmente 3
  currentGame: number; // 1, 2 ou 3
  whoStartsCurrentGame: 'player1' | 'player2' | null;
  phase: MatchPhase;
  winnerId: string | null;
}

export interface TournamentState {
  id: string;
  gameId: GameId;
  phase: TournamentPhase;
  players: Player[];
  winnersMatches: Match[];
  losersMatches: Match[];
  grandFinal: Match | null;
  grandFinalReset: Match | null; // se o da losers ganhar a grand final
  championId: string | null;
}

// ============================================================================
// Mensagens do Cliente → Servidor
// ============================================================================

export interface JoinTournamentMessage {
  type: 'join_tournament';
  gameId: GameId;
  playerName: string;
  classId?: string;
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
  tournamentState: TournamentState;
}

export interface TournamentStateUpdateMessage {
  type: 'tournament_state_update';
  tournamentState: TournamentState;
}

export interface MatchAssignedMessage {
  type: 'match_assigned';
  match: Match;
  yourRole: 'player1' | 'player2';
}

export interface GameStartMessage {
  type: 'game_start';
  matchId: string;
  gameNumber: number;
  youStart: boolean;
  initialState: unknown; // estado inicial do jogo
}

export interface GameStateUpdateMessage {
  type: 'game_state_update';
  matchId: string;
  gameNumber: number;
  gameState: unknown;
  yourTurn: boolean;
  lastMove?: unknown;
}

export interface GameEndMessage {
  type: 'game_end';
  matchId: string;
  gameNumber: number;
  winnerId: string;
  finalState: unknown;
}

export interface MatchEndMessage {
  type: 'match_end';
  matchId: string;
  winnerId: string;
  finalScore: MatchScore;
  youWon: boolean;
  nextBracket: BracketType | 'eliminated' | 'champion';
}

export interface TournamentEndMessage {
  type: 'tournament_end';
  championId: string;
  championName: string;
  finalStandings: Array<{ player: Player; position: number }>;
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

