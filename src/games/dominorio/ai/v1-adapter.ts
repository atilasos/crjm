import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  AICriticalThreat,
  DifficultyLevel,
  AIPedagogyV1,
} from '../../../ai-core';
import type { DominorioState, Domino } from '../types';
import { DominorioAIClient, type AIClientOptions } from './ai-client';
import type { AIDifficulty } from './types';
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
    const bestMove = await this.client.getBestMove(request.state, difficulty, {
      timeBudgetMs: request.timeBudgetMs,
    });
    const topMoves = buildTopMoves(request.state, bestMove);
    const criticalThreats = buildCriticalThreats(topMoves);
    const pedagogy = buildPedagogy(request.level, request.state, topMoves, criticalThreats);
    const elapsedMs = Math.max(
      this.client.metrics.lastTimeMs,
      performance.now() - startedAt,
    );

    return {
      version: '1.0',
      requestId: request.requestId,
      gameId: 'dominorio',
      mode: request.mode,
      bestMove,
      topMoves,
      explainText: buildExplainText(bestMove, topMoves, pedagogy),
      confidence: topMoves[0]?.confidence,
      criticalThreats,
      pedagogy,
      stats: {
        elapsedMs,
        depth: this.client.metrics.lastDepth || undefined,
        nodes: this.client.metrics.lastNodes || undefined,
        usedWasm: false,
        engine: 'ts-fallback',
      },
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
  if (level <= 2) return 'easy';
  if (level === 3) return 'medium';
  return 'hard';
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
      reasonShort:
        idx === 0
          ? 'Mantém mais mobilidade imediata.'
          : 'Alternativa sólida para continuar a pressão.',
    };
  });
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
): string {
  if (!bestMove) {
    return 'Sem jogadas válidas nesta posição. Tenta proteger mais espaço no turno anterior.';
  }

  if (pedagogy.errorCode === 'E-DO-03') {
    return 'Entraste no final com risco alto. Prioriza jogadas que mantenham duas respostas para o próximo turno.';
  }

  if (pedagogy.errorCode === 'E-DO-02') {
    return 'Estás a entregar demasiado corredor ao adversário. Fecha a zona mais aberta antes de expandir.';
  }

  return topMoves.length <= 1
    ? 'A posição ficou apertada para ti. Joga para manter mobilidade no turno seguinte.'
    : 'A paridade desta região pode virar contra ti. Mantém o número de opções equilibrado entre zonas.';
}
