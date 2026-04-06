import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  AICriticalThreat,
  DifficultyLevel,
  AIPedagogyV1,
} from '../../../ai-core';
import type { QuelhasState, Segmento } from '../types';
import { QuelhasAIClient } from './ai-client';
import { DIFFICULTY_PRESETS, type AIDifficulty } from './types';

export interface QuelhasV1AdapterOptions {
  client?: QuelhasAIClient;
}

const LEVEL_MAP: Record<DifficultyLevel, AIDifficulty> = {
  1: 'easy',
  2: 'easy',
  3: 'medium',
  4: 'hard',
  5: 'hard',
};

export class QuelhasV1Adapter {
  private readonly client: QuelhasAIClient;
  private readonly ownsClient: boolean;

  constructor(options: QuelhasV1AdapterOptions = {}) {
    if (options.client) {
      this.client = options.client;
      this.ownsClient = false;
      return;
    }

    this.client = new QuelhasAIClient();
    this.ownsClient = true;
  }

  async compute(
    request: AIRequestV1<QuelhasState, Segmento>,
  ): Promise<AIResponseV1<Segmento, QuelhasState>> {
    const difficulty = mapLevelToQuelhasDifficulty(request.level);
    const timeBudgetMs =
      typeof request.timeBudgetMs === 'number' && Number.isFinite(request.timeBudgetMs)
        ? Math.max(1, Math.trunc(request.timeBudgetMs))
        : DIFFICULTY_PRESETS[difficulty].timeBudgetMs;

    const bestMove = await this.client.getBestMove(request.state, difficulty, {
      timeBudgetMs,
    });
    const topMoves = buildTopMoves(request.state, bestMove);
    const criticalThreats = buildCriticalThreats(request.state, topMoves);
    const pedagogy = buildPedagogy(request.state, topMoves);
    const metrics = this.client.metrics;

    return {
      version: '1.0',
      requestId: request.requestId,
      gameId: 'quelhas',
      mode: request.mode,
      bestMove,
      topMoves,
      explainText: buildExplainText(request.state, bestMove, topMoves),
      confidence: topMoves[0]?.confidence ?? 0.48,
      criticalThreats,
      pedagogy,
      stats: {
        elapsedMs: metrics.lastTimeMs,
        depth: metrics.lastDepth || undefined,
        nodes: metrics.lastNodes || undefined,
        usedWasm: metrics.lastUsedWasm ?? false,
        engine: metrics.lastEngine ?? 'ts-fallback',
      },
      warnings:
        metrics.lastEngine === 'ts-fallback'
          ? ['A análise desta dica usou o fallback TypeScript.']
          : undefined,
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

export function mapLevelToQuelhasDifficulty(level: DifficultyLevel): AIDifficulty {
  return LEVEL_MAP[level];
}

function segmentKey(move: Segmento): string {
  return `${move.inicio.linha}:${move.inicio.coluna}:${move.comprimento}:${move.orientacao}`;
}

function sameSegment(a: Segmento, b: Segmento): boolean {
  return segmentKey(a) === segmentKey(b);
}

function formatSegment(move: Segmento): string {
  return `L${move.inicio.linha + 1} C${move.inicio.coluna + 1}, ${move.orientacao}, ${move.comprimento} casas`;
}

function estimateMovePriority(move: Segmento, state: QuelhasState): number {
  const center = 4.5;
  const startDistance =
    Math.abs(move.inicio.linha - center) + Math.abs(move.inicio.coluna - center);
  const legalMoves = state.jogadasValidas.length;
  const shortSegmentBonus = move.comprimento <= 2 ? 14 : move.comprimento === 3 ? 8 : 2;
  return shortSegmentBonus + legalMoves * 0.5 - startDistance;
}

function buildReasonShort(move: Segmento): string {
  if (move.comprimento <= 2) {
    return 'Fecha poucas casas e mantém mais respostas para o fim.';
  }
  if (move.comprimento >= 4) {
    return 'Avança já nesta faixa, mas sem gastar todo o espaço útil.';
  }
  return 'Equilibra avanço e opções para a próxima sequência.';
}

function buildTopMoves(
  state: QuelhasState,
  bestMove: Segmento | null,
): AIMoveCandidate<Segmento>[] {
  const ranked = [...state.jogadasValidas]
    .sort((a, b) => estimateMovePriority(b, state) - estimateMovePriority(a, state))
    .slice(0, 6);
  const unique: Segmento[] = [];

  if (bestMove) {
    unique.push(bestMove);
  }

  for (const move of ranked) {
    if (!unique.some((candidate) => sameSegment(candidate, move))) {
      unique.push(move);
    }
    if (unique.length >= 3) break;
  }

  return unique.slice(0, 3).map((move, index) => ({
    move,
    rank: (index + 1) as 1 | 2 | 3,
    score: Math.round(estimateMovePriority(move, state) * 10),
    confidence: Math.max(0.35, 0.82 - index * 0.12),
    reasonShort: buildReasonShort(move),
  }));
}

function buildCriticalThreats(
  state: QuelhasState,
  topMoves: AIMoveCandidate<Segmento>[],
): AICriticalThreat<Segmento>[] {
  if (state.jogadasValidas.length === 0 || topMoves.length === 0) {
    return [];
  }

  if (state.jogadasValidas.length === 1) {
    return [
      {
        id: 'forced-last-move',
        severity: 'high',
        title: 'Tens uma única saída',
        description: 'Se fechares esta opção sem plano, podes ficar preso à última jogada.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  if (state.jogadasValidas.length <= 3) {
    return [
      {
        id: 'low-mobility',
        severity: 'medium',
        title: 'Poucas alternativas',
        description: 'Escolhe um segmento curto para não fechar demasiado o tabuleiro já.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  return [];
}

function buildPedagogy(
  state: QuelhasState,
  topMoves: AIMoveCandidate<Segmento>[],
): AIPedagogyV1 {
  if (state.jogadasValidas.length === 0) {
    return {
      errorCode: 'E-QU-02',
      hintLevelSuggested: 'H3',
      turningPointScore: 0.95,
      aeCompetency: ['antecipação', 'planeamento'],
    };
  }

  if (state.jogadasValidas.length <= 2) {
    return {
      errorCode: 'E-QU-01',
      hintLevelSuggested: 'H3',
      turningPointScore: 0.82,
      aeCompetency: ['escolha estratégica', 'gestão do fim de jogo'],
    };
  }

  return {
    errorCode: 'E-QU-03',
    hintLevelSuggested: topMoves[0]?.confidence && topMoves[0].confidence >= 0.72 ? 'H1' : 'H2',
    turningPointScore: state.jogadasValidas.length <= 5 ? 0.72 : 0.48,
    aeCompetency: ['planeamento', 'observação de padrões'],
  };
}

function buildExplainText(
  state: QuelhasState,
  bestMove: Segmento | null,
  topMoves: AIMoveCandidate<Segmento>[],
): string {
  if (state.jogadasValidas.length === 0) {
    return 'Sem jogadas válidas: nesta posição ganhas, porque o adversário foi o último a jogar.';
  }

  const move = bestMove ?? topMoves[0]?.move;
  if (!move) {
    return 'Procura um segmento curto que não feche demasiado o tabuleiro já.';
  }

  if (state.jogadasValidas.length <= 2) {
    return 'Entra no fim com um segmento que te mantenha vivo e não feche a última faixa útil cedo demais.';
  }

  if (move.comprimento <= 2) {
    return 'Dá prioridade a um segmento curto numa faixa ainda aberta; assim guardas mais opções para o final.';
  }

  return 'Avança numa faixa que prolongue o teu plano sem consumir logo demasiadas casas úteis.';
}
