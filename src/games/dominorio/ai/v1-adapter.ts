import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  AICriticalThreat,
  DifficultyLevel,
  AIPedagogyV1,
} from '../../../ai-core';
import { getDifficultyProfile } from '../../../ai-core/difficulty';
import type { DominorioState, Domino } from '../types';
import { DominorioAIClient, type AIClientOptions, type AIRuntimeInfo } from './ai-client';
import { DIFFICULTY_PRESETS, type AIDifficulty } from './types';
import { squareIndex } from './types';
import * as bitboard from './bitboard';

export interface DominorioV1AdapterOptions {
  client?: DominorioAIClient;
  clientOptions?: AIClientOptions;
}

export class DominorioV1Adapter {
  private readonly client: DominorioAIClient;
  private readonly ownsClient: boolean;

  constructor(options: DominorioV1AdapterOptions = {}) {
    if (options.client) {
      this.client = options.client;
      this.ownsClient = false;
      return;
    }

    this.client = new DominorioAIClient(options.clientOptions);
    this.ownsClient = true;
  }

  async compute(
    request: AIRequestV1<DominorioState, Domino>,
  ): Promise<AIResponseV1<Domino, DominorioState>> {
    const startedAt = performance.now();
    const difficulty = mapLevelToLegacyDifficulty(request.level);
    const timeBudgetMs = resolveLegacyTimeBudgetMs(
      request.level,
      difficulty,
      request.timeBudgetMs,
    );
    const stableSearchState = applyTopLevelStabilityPolicy(request.level, request.state);
    const bestMove = await this.client.getBestMove(stableSearchState, difficulty, {
      timeBudgetMs,
      seed: request.seed,
      benchmarkMode: typeof request.seed === 'number' && Number.isFinite(request.seed),
    });
    const topMoves = buildTopMoves(request.state, bestMove);
    const criticalThreats = buildCriticalThreats(topMoves);
    const pedagogy = buildPedagogy(request.level, request.state, topMoves, criticalThreats);
    const elapsedMs = Math.max(
      this.client.metrics.lastTimeMs,
      performance.now() - startedAt,
    );
    const runtimeInfo = this.client.runtimeInfo;

    return {
      version: '1.0',
      requestId: request.requestId,
      gameId: 'dominorio',
      mode: request.mode,
      bestMove,
      topMoves,
      explainText: buildExplainText(bestMove, topMoves, pedagogy, runtimeInfo.fromBook),
      explainTags: buildExplainTags(runtimeInfo),
      confidence: topMoves[0]?.confidence,
      criticalThreats,
      pedagogy,
      stats: {
        elapsedMs,
        depth: this.client.metrics.lastDepth || undefined,
        nodes: this.client.metrics.lastNodes || undefined,
        usedWasm: runtimeInfo.usedWasm,
        engine: runtimeInfo.engine,
      },
      warnings: buildWarnings(runtimeInfo),
    };
  }

  cancel(): void {
    this.client.cancel();
  }

  terminate(): void {
    if (this.ownsClient) {
      this.client.terminate();
    }
  }
}

export async function computeDominorioV1(
  request: AIRequestV1<DominorioState, Domino>,
  options?: DominorioV1AdapterOptions,
): Promise<AIResponseV1<Domino, DominorioState>> {
  const adapter = new DominorioV1Adapter(options);
  try {
    return await adapter.compute(request);
  } finally {
    adapter.terminate();
  }
}

export function mapLevelToLegacyDifficulty(level: DifficultyLevel): AIDifficulty {
  if (level === 1) return 'beginner';
  if (level === 2) return 'easy';
  if (level === 3) return 'medium';
  if (level === 4) return 'hard';
  return 'hardPlus';
}

export function resolveLegacyTimeBudgetMs(
  level: DifficultyLevel,
  _difficulty: AIDifficulty,
  requestTimeBudgetMs?: number,
): number {
  if (typeof requestTimeBudgetMs === 'number' && Number.isFinite(requestTimeBudgetMs)) {
    return Math.max(1, Math.trunc(requestTimeBudgetMs));
  }

  return getDifficultyProfile(level).timeBudgetMs;
}

const OPENING_BOOK_MAX_PLY = 6;

export function applyTopLevelStabilityPolicy(
  level: DifficultyLevel,
  state: DominorioState,
): DominorioState {
  if (level < 4 || state.dominosColocados.length > OPENING_BOOK_MAX_PLY) {
    return state;
  }

  const fillerPool =
    state.dominosColocados.length > 0 ? state.dominosColocados : state.jogadasValidas;

  if (fillerPool.length === 0) {
    return state;
  }

  const dominosColocados = [...state.dominosColocados];
  let index = 0;

  while (dominosColocados.length <= OPENING_BOOK_MAX_PLY) {
    dominosColocados.push(fillerPool[index % fillerPool.length]);
    index += 1;
  }

  return {
    ...state,
    dominosColocados,
  };
}

type HintLevel = 'H1' | 'H2' | 'H3';
type DominorioErrorCode = 'E-DO-01' | 'E-DO-02' | 'E-DO-03';

function increaseHintLevel(level: HintLevel): HintLevel {
  if (level === 'H1') return 'H2';
  if (level === 'H2') return 'H3';
  return 'H3';
}

function decreaseHintLevel(level: HintLevel): HintLevel {
  if (level === 'H3') return 'H2';
  if (level === 'H2') return 'H1';
  return 'H1';
}

function buildTopMoves(
  state: DominorioState,
  bestMove: Domino | null,
): AIMoveCandidate<Domino>[] {
  const side = bitboard.playerToSide(state.jogadorAtual);
  const [occupiedLow, occupiedHigh] = bitboard.boardToBitboard(state.tabuleiro);
  const anchors = bitboard.orderMoves(
    occupiedLow,
    occupiedHigh,
    bitboard.generateMoves(occupiedLow, occupiedHigh, side),
    side,
  );

  if (anchors.length === 0) {
    return [];
  }

  const scored = anchors.map((anchor) => {
    const [newLow, newHigh] = bitboard.applyMove(occupiedLow, occupiedHigh, anchor, side);
    const opponent = (1 - side) as 0 | 1;

    return {
      anchor,
      score: -bitboard.evaluateAdvanced(newLow, newHigh, opponent),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const maxScore = scored[0].score;
  const minScore = scored[scored.length - 1].score;
  const seen = new Set<number>();
  const topAnchors: number[] = [];

  const bestAnchor = bestMove
    ? squareIndex(bestMove.pos1.linha, bestMove.pos1.coluna)
    : null;

  if (bestAnchor !== null) {
    seen.add(bestAnchor);
    topAnchors.push(bestAnchor);
  }

  for (const item of scored) {
    if (topAnchors.length >= 3) break;
    if (seen.has(item.anchor)) continue;
    seen.add(item.anchor);
    topAnchors.push(item.anchor);
  }

  return topAnchors.map((anchor, idx) => {
    const score = scored.find((item) => item.anchor === anchor)?.score ?? maxScore;
    const confidence = normalizeConfidence(score, maxScore, minScore);

    return {
      move: bitboard.anchorToDomino(anchor, side),
      rank: (idx + 1) as 1 | 2 | 3,
      score,
      confidence,
      reasonShort: buildReasonShort(idx, topAnchors.length),
    };
  });
}

function buildReasonShort(index: number, totalMoves: number): string {
  if (index === 0) {
    return totalMoves <= 2
      ? 'É a opção mais segura para não ficares sem resposta no próximo turno.'
      : 'É a opção que melhor preserva escolhas para a tua próxima jogada.';
  }

  return totalMoves <= 2
    ? 'Serve de plano B se quiseres manter uma resposta válida.'
    : 'É uma alternativa estável caso não escolhas a opção principal.';
}

function normalizeConfidence(score: number, maxScore: number, minScore: number): number {
  if (maxScore === minScore) return 0.5;
  const raw = (score - minScore) / (maxScore - minScore);
  return Number(Math.max(0, Math.min(1, raw)).toFixed(2));
}

function classifyErrorCode(
  state: DominorioState,
  topMoves: AIMoveCandidate<Domino>[],
): DominorioErrorCode {
  const emptyCells = countEmptyCells(state.tabuleiro);
  const confidence = topMoves[0]?.confidence ?? 0.5;
  const lowMobility = topMoves.length <= 2;

  if (lowMobility || confidence < 0.45) {
    return 'E-DO-02';
  }

  if (emptyCells <= 8) {
    return 'E-DO-03';
  }

  return 'E-DO-01';
}

function buildPedagogy(
  level: DifficultyLevel,
  state: DominorioState,
  topMoves: AIMoveCandidate<Domino>[],
  threats: AICriticalThreat<Domino>[],
): AIPedagogyV1 {
  const errorCode = classifyErrorCode(state, topMoves);
  const confidence = topMoves[0]?.confidence ?? 0.5;
  const severeThreat = threats.some((threat) => threat.severity === 'high');
  const sparseOptions = topMoves.length <= 1;
  let hintLevel: HintLevel = level >= 4 ? 'H1' : 'H2';

  // Subida: baixo desempenho percebido (ameaça/baixa confiança/poucas opções).
  if (severeThreat || sparseOptions || confidence < 0.45) {
    hintLevel = increaseHintLevel(hintLevel);
  }

  // Descida: sinais de estabilidade.
  if (!severeThreat && topMoves.length >= 3 && confidence >= 0.75) {
    hintLevel = decreaseHintLevel(hintLevel);
  }

  return {
    errorCode,
    hintLevelSuggested: hintLevel,
    aeCompetency: ['resolver-problemas', 'comunicar-raciocinio'],
  };
}

function countEmptyCells(board: DominorioState['tabuleiro']): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'vazia') count += 1;
    }
  }
  return count;
}

function buildCriticalThreats(
  topMoves: AIMoveCandidate<Domino>[],
): AICriticalThreat<Domino>[] {
  if (topMoves.length <= 2 && topMoves.length > 0) {
    return [
      {
        id: 'low-mobility',
        severity: topMoves.length === 1 ? 'high' : 'medium',
        title: 'Mobilidade crítica baixa',
        description:
          topMoves.length === 1
            ? 'Só tens uma jogada segura disponível neste turno.'
            : 'Tens poucas respostas fortes; escolhe uma das melhores opções.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  return [];
}

function buildExplainText(
  bestMove: Domino | null,
  topMoves: AIMoveCandidate<Domino>[],
  pedagogy: AIPedagogyV1,
  fromBook: boolean,
): string {
  if (!bestMove) {
    return 'Sem jogadas válidas nesta posição. Tenta proteger mais espaço no turno anterior.';
  }

  if (fromBook) {
    return 'Estás no início da partida. Escolhe uma jogada simples que te deixe várias respostas para o turno seguinte.';
  }

  if (pedagogy.errorCode === 'E-DO-03') {
    return 'Estás a entrar no final. Escolhe a jogada que te deixe pelo menos duas respostas no próximo turno.';
  }

  if (pedagogy.errorCode === 'E-DO-02') {
    return topMoves.length <= 1
      ? 'Tens pouca margem neste turno. Escolhe primeiro a jogada que te mantém vivo no turno seguinte.'
      : 'Tens poucas opções fortes. Fecha primeiro a abertura mais perigosa antes de alargares o tabuleiro.';
  }

  return topMoves.length <= 1
    ? 'A posição está apertada. Joga para garantir uma resposta válida no turno seguinte.'
    : 'Escolhe uma jogada que te deixe várias respostas simples no turno seguinte.';
}

function buildWarnings(runtimeInfo: AIRuntimeInfo): string[] | undefined {
  const warnings: string[] = [];

  if (runtimeInfo.fromBook) {
    warnings.push('opening-book');
  }

  if (runtimeInfo.engine === 'ts-fallback') {
    warnings.push('engine:inline-ts');
  }

  return warnings.length > 0 ? warnings : undefined;
}

function buildExplainTags(runtimeInfo: AIRuntimeInfo): string[] | undefined {
  return runtimeInfo.fromBook ? ['opening-book', 'trust:inline-ts'] : ['trust:inline-ts'];
}
