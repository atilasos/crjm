import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  DifficultyLevel,
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
    const bestMove = await this.client.getBestMove(request.state, difficulty);
    const topMoves = buildTopMoves(request.state, bestMove);
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
      explainText: buildExplainText(bestMove, topMoves),
      confidence: topMoves[0]?.confidence,
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

function buildExplainText(
  bestMove: Domino | null,
  topMoves: AIMoveCandidate<Domino>[],
): string {
  if (!bestMove) {
    return 'Sem jogadas válidas nesta posição.';
  }

  if (topMoves.length <= 1) {
    return 'Esta é a opção mais estável para manter o controlo da posição.';
  }

  return 'Esta jogada reduz respostas imediatas do adversário e preserva opções no turno seguinte.';
}
