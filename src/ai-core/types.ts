export type GameId =
  | 'gatos-caes'
  | 'dominorio'
  | 'quelhas'
  | 'produto'
  | 'atari-go'
  | 'nex';

export type TutorMode = 'competitive' | 'tutor';

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface AIRequestV1<State, Move = unknown> {
  version: '1.0';
  requestId: string;
  gameId: GameId;
  mode: TutorMode;
  level: DifficultyLevel;
  state: State;
  legalMoves?: Move[];
  timeBudgetMs?: number;
  seed?: number;
  locale?: 'pt-PT';
}

export interface AIMoveCandidate<Move> {
  move: Move;
  rank: 1 | 2 | 3;
  score?: number;
  confidence?: number;
  reasonShort?: string;
}

export interface AICriticalThreat<Move = unknown> {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  counterMove?: Move;
  cells?: number[];
}

export interface AITurningPoint<Move> {
  ply: number;
  playedMove: Move;
  bestMove?: Move;
  swing?: number;
  explanation: string;
  patternId?: string;
}

export interface AIStatsV1 {
  elapsedMs: number;
  depth?: number;
  nodes?: number;
  simulations?: number;
  usedWasm: boolean;
  engine: 'rust-wasm' | 'ts-fallback' | 'server-nn';
}

export interface AIPedagogyV1 {
  errorCode?: string;
  hintLevelSuggested?: 'H0' | 'H1' | 'H2' | 'H3';
  turningPointScore?: number;
  aeCompetency?: string[];
}

export interface AIResponseV1<Move, State = unknown> {
  version: '1.0';
  requestId: string;
  gameId: GameId;
  mode: TutorMode;
  bestMove: Move | null;
  topMoves: AIMoveCandidate<Move>[];
  principalVariation?: Move[];
  explainText: string;
  explainTags?: string[];
  criticalThreats?: AICriticalThreat<Move>[];
  confidence?: number;
  turningPoints?: AITurningPoint<Move>[];
  predictedState?: State;
  pedagogy?: AIPedagogyV1;
  stats: AIStatsV1;
  warnings?: string[];
}

export interface AIErrorV1 {
  type: 'error';
  requestId: string;
  message: string;
  recoverable: boolean;
}

export interface AIReadyV1 {
  type: 'ready';
  engine: 'rust-wasm' | 'ts-fallback';
}

export type AIWorkerRequestMessage<State = unknown, Move = unknown> =
  | { type: 'compute'; payload: AIRequestV1<State, Move> }
  | { type: 'cancel'; requestId: string }
  | { type: 'ping'; timestamp: number };

export type AIWorkerResponseMessage<Move = unknown, State = unknown> =
  | { type: 'result'; payload: AIResponseV1<Move, State> }
  | AIErrorV1
  | AIReadyV1
  | { type: 'pong'; timestamp: number };
