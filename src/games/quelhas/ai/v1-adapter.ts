import { selectReviewPattern } from '../../../ai-core/review-patterns';
import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  AICriticalThreat,
  AIPedagogyV1,
} from '../../../ai-core';
import { getDifficultyProfile, type ExtendedDifficultyLevel } from '../../../ai-core/difficulty';
import type { QuelhasState, Segmento } from '../types';
import { QuelhasAIClient } from './ai-client';
import type { AIDifficulty } from './types';
import { analyzeTurnCounts } from './engine';
import { colocarSegmento, getOrientacaoJogador } from '../logic';

type AnalysisClient = Pick<QuelhasAIClient, 'getBestMove' | 'metrics' | 'cancel' | 'terminate'>;

export interface QuelhasV1AdapterOptions {
  client?: AnalysisClient;
}

const LEVEL_MAP: Record<ExtendedDifficultyLevel, AIDifficulty> = {
  1: 'beginner',
  2: 'easy',
  3: 'medium',
  4: 'hard',
  5: 'master',
  6: 'master',
};

export class QuelhasV1Adapter {
  private readonly client: AnalysisClient;
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
    const difficulty = request.mode === 'tutor' ? 'master' : mapLevelToQuelhasDifficulty(request.level);
    const timeBudgetMs =
      typeof request.timeBudgetMs === 'number' && Number.isFinite(request.timeBudgetMs)
        ? Math.max(1, Math.trunc(request.timeBudgetMs))
        : getDifficultyProfile(request.level).timeBudgetMs;

    const bestMove = await this.client.getBestMove(request.state, difficulty, {
      timeBudgetMs,
    });
    const metrics = this.client.metrics;
    const explanation = bestMove ? describeMove(request.state, bestMove) : null;
    // Only the searched action is ranked. Geometric alternatives were never
    // searched and must not appear as the second/third best moves.
    const topMoves: AIMoveCandidate<Segmento>[] = bestMove && explanation ? [{
      move: bestMove, rank: 1, score: metrics.lastScore,
      confidence: metrics.lastEngine === 'exact-endgame' ? 1 : 0.6,
      reasonShort: explanation.counts,
    }] : [];
    const criticalThreats = buildCriticalThreats(request.state, topMoves);
    const pedagogy = buildPedagogy(request.state, topMoves);

    return {
      version: '1.0',
      requestId: request.requestId,
      gameId: 'quelhas',
      mode: request.mode,
      bestMove,
      topMoves,
      explainText: explanation?.explanation ?? 'Sem jogadas válidas: nesta posição ganhas, porque o adversário foi o último a jogar.',
      confidence: topMoves[0]?.confidence ?? 0.48,
      criticalThreats,
      reviewPatternId: selectReviewPattern('quelhas', { criticalThreats }).id,
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

export function mapLevelToQuelhasDifficulty(level: ExtendedDifficultyLevel): AIDifficulty {
  return LEVEL_MAP[level];
}

function describeMove(state: QuelhasState, move: Segmento) {
  const next = colocarSegmento(state, move);
  const turns = analyzeTurnCounts(next.tabuleiro);
  const my = turns[getOrientacaoJogador(state, state.jogadorAtual)];
  const opponent = turns[getOrientacaoJogador(state, state.jogadorAtual === 'jogador1' ? 'jogador2' : 'jogador1')];
  const counts = `Após esta jogada: tu, ${my.min} a ${my.max} turnos; adversário, ${opponent.min} a ${opponent.max}.`;
  let explanation: string;
  if (opponent.max === 0) {
    explanation = 'Esta jogada deixa o adversário sem jogadas e dá-lhe a vitória.';
  } else if (my.max === 0) {
    explanation = 'Esgotas as tuas faixas. O adversário ainda tem de jogar; depois ganhas por não teres jogada.';
  } else {
    explanation = 'Compara o mínimo e o máximo de turnos de cada lado. Se o adversário cortar uma faixa, a contagem muda. Quem pode ficar primeiro sem jogar?';
  }
  return { counts, explanation };
}

function buildCriticalThreats(
  state: QuelhasState,
  topMoves: AIMoveCandidate<Segmento>[],
): AICriticalThreat<Segmento>[] {
  const best = topMoves[0];
  if (state.jogadasValidas.length === 0 || !best) {
    return [];
  }

  if (state.jogadasValidas.length === 1) {
    return [
      {
        id: 'forced-last-move',
        severity: 'high',
        title: 'Tens uma única saída',
        description: 'Se fechares esta opção sem plano, podes ficar preso à última jogada.',
        counterMove: best.move,
      },
    ];
  }

  if (state.jogadasValidas.length <= 3) {
    return [
      {
        id: 'low-mobility',
        severity: 'medium',
        title: 'Poucas alternativas',
        description: 'Compara segmentos de comprimentos diferentes e prevê quem ficará sem jogadas primeiro.',
        counterMove: best.move,
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
