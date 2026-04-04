import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  AICriticalThreat,
  AIPedagogyV1,
  DifficultyLevel,
} from '../../../ai-core';
import { calcularJogadasValidas, colocarPeca } from '../logic';
import type { GatosCaesState, Posicao } from '../types';
import { computeMove } from './ai-client';

export class GatosCaesV1Adapter {
  async compute(
    request: AIRequestV1<GatosCaesState, Posicao>,
  ): Promise<AIResponseV1<Posicao, GatosCaesState>> {
    const legalMoves = resolveLegalMoves(request.state);

    if (legalMoves.length === 0) {
      return {
        version: '1.0',
        requestId: request.requestId,
        gameId: 'gatos-caes',
        mode: request.mode,
        bestMove: null,
        topMoves: [],
        explainText:
          'Sem casas válidas nesta posição. Revê o turno anterior para perceber que mobilidade deixaste ao adversário.',
        confidence: 0.98,
        criticalThreats: [],
        pedagogy: {
          errorCode: 'E-GC-01',
          hintLevelSuggested: 'H3',
          turningPointScore: 0.95,
          aeCompetency: ['contagem de mobilidade', 'gestão do espaço'],
        },
        stats: emptyStats(),
        warnings: ['engine:inline-ts'],
      };
    }

    const { move: bestMove, stats } = await computeMove(request.state, request.level);
    const topMoves = buildTopMoves(request.state, bestMove, legalMoves);
    const criticalThreats = buildCriticalThreats(request.state, topMoves);

    return {
      version: '1.0',
      requestId: request.requestId,
      gameId: 'gatos-caes',
      mode: request.mode,
      bestMove,
      topMoves,
      explainText: buildExplainText(request.state, bestMove, topMoves),
      confidence: topMoves[0]?.confidence ?? 0.5,
      criticalThreats,
      pedagogy: buildPedagogy(request.state, legalMoves.length),
      stats: {
        elapsedMs: stats.timeMs,
        depth: stats.depth,
        nodes: stats.nodes,
        usedWasm: false,
        engine: 'ts-fallback',
      },
      warnings: ['engine:inline-ts'],
    };
  }

  cancel(): void {}

  terminate(): void {}
}

export function mapLevelToDifficulty(level: DifficultyLevel): number {
  return level;
}

function emptyStats() {
  return {
    elapsedMs: 0,
    depth: 0,
    nodes: 0,
    usedWasm: false as const,
    engine: 'ts-fallback' as const,
  };
}

function resolveLegalMoves(state: GatosCaesState): Posicao[] {
  return state.jogadasValidas.length > 0
    ? state.jogadasValidas
    : calcularJogadasValidas(
        state.tabuleiro,
        state.jogadorAtual,
        state.primeiroGatoColocado,
        state.primeiroCaoColocado,
      );
}

function samePos(a: Posicao, b: Posicao): boolean {
  return a.linha === b.linha && a.coluna === b.coluna;
}

function simulateMove(state: GatosCaesState, move: Posicao): GatosCaesState {
  return colocarPeca(state, move);
}

function estimateMoveScore(state: GatosCaesState, move: Posicao): number {
  const simulated = simulateMove(state, move);
  if (simulated.estado !== 'a-jogar') {
    return 10_000;
  }

  const opponentMoves = simulated.jogadasValidas.length;
  const myFutureMoves = calcularJogadasValidas(
    simulated.tabuleiro,
    state.jogadorAtual,
    simulated.primeiroGatoColocado,
    simulated.primeiroCaoColocado,
  ).length;
  const distanceToCenter = Math.abs(move.linha - 3.5) + Math.abs(move.coluna - 3.5);
  const earlyGame = state.totalGatos + state.totalCaes < 10;

  return (
    myFutureMoves * 6 -
    opponentMoves * 5 +
    (earlyGame ? Math.max(0, 10 - distanceToCenter * 2) : 0) -
    edgePenalty(move)
  );
}

function edgePenalty(move: Posicao): number {
  const onEdge = move.linha === 0 || move.linha === 7 || move.coluna === 0 || move.coluna === 7;
  return onEdge ? 3 : 0;
}

function buildReason(state: GatosCaesState, move: Posicao): string {
  const simulated = simulateMove(state, move);
  if (simulated.estado !== 'a-jogar') {
    return 'Fecha já a partida: o adversário fica sem resposta.';
  }
  if (state.totalGatos + state.totalCaes < 6) {
    return 'Guarda o centro e mantém mais casas legais para os próximos turnos.';
  }
  if (simulated.jogadasValidas.length <= 2) {
    return 'Reduz as saídas do adversário sem te fechar demasiado.';
  }
  return 'Mantém mobilidade tua e limita as respostas do adversário.';
}

function buildTopMoves(
  state: GatosCaesState,
  bestMove: Posicao | null,
  legalMoves: Posicao[],
): AIMoveCandidate<Posicao>[] {
  const ranked = [...legalMoves]
    .map((move) => ({ move, score: estimateMoveScore(state, move) }))
    .sort((a, b) => b.score - a.score);

  const selected: Array<{ move: Posicao; score: number }> = [];
  if (bestMove) {
    const bestEntry = ranked.find((entry) => samePos(entry.move, bestMove));
    if (bestEntry) {
      selected.push(bestEntry);
    } else {
      selected.push({ move: bestMove, score: estimateMoveScore(state, bestMove) });
    }
  }

  for (const entry of ranked) {
    if (selected.length >= 3) break;
    if (selected.some((item) => samePos(item.move, entry.move))) continue;
    selected.push(entry);
  }

  const maxScore = selected[0]?.score ?? 1;
  const minScore = selected[selected.length - 1]?.score ?? maxScore;

  return selected.slice(0, 3).map((entry, index) => ({
    move: entry.move,
    rank: (index + 1) as 1 | 2 | 3,
    score: entry.score,
    confidence: normalizeConfidence(entry.score, maxScore, minScore),
    reasonShort: buildReason(state, entry.move),
  }));
}

function normalizeConfidence(score: number, max: number, min: number): number {
  if (max === min) return 0.5;
  return Number((((score - min) / (max - min)) * 0.5 + 0.45).toFixed(2));
}

function buildCriticalThreats(
  state: GatosCaesState,
  topMoves: AIMoveCandidate<Posicao>[],
): AICriticalThreat<Posicao>[] {
  if (state.jogadasValidas.length <= 1 && topMoves[0]) {
    return [
      {
        id: 'forced-square',
        severity: 'high',
        title: 'Resta-te uma única casa segura',
        description: 'Se falhares esta casa, o adversário controla o último turno.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  if (state.jogadasValidas.length <= 3 && topMoves[0]) {
    return [
      {
        id: 'low-mobility',
        severity: 'medium',
        title: 'Mobilidade curta',
        description: 'Escolhe uma casa que mantenha duas respostas ou mais para o próximo ciclo.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  return [];
}

function buildPedagogy(state: GatosCaesState, legalMoveCount: number): AIPedagogyV1 {
  const earlyGame = state.totalGatos + state.totalCaes < 6;
  if (legalMoveCount <= 1) {
    return {
      errorCode: 'E-GC-02',
      hintLevelSuggested: 'H3',
      turningPointScore: 0.9,
      aeCompetency: ['contagem de respostas', 'finalização'],
    };
  }

  return {
    errorCode: earlyGame ? 'E-GC-03' : 'E-GC-04',
    hintLevelSuggested: earlyGame ? 'H2' : 'H1',
    turningPointScore: earlyGame ? 0.58 : 0.74,
    aeCompetency: ['mobilidade', 'controlo do centro'],
  };
}

function buildExplainText(
  state: GatosCaesState,
  bestMove: Posicao | null,
  topMoves: AIMoveCandidate<Posicao>[],
): string {
  const move = bestMove ?? topMoves[0]?.move;
  if (!move) {
    return 'Procura a casa que preserve mais respostas do que as que entregas ao adversário.';
  }

  const simulated = simulateMove(state, move);
  if (simulated.estado !== 'a-jogar') {
    return `Joga em L${move.linha + 1} C${move.coluna + 1}. O adversário fica sem qualquer casa válida.`;
  }

  if (state.totalGatos + state.totalCaes < 6) {
    return `Joga em L${move.linha + 1} C${move.coluna + 1}. Guardas o centro e manténs várias saídas para o ciclo seguinte.`;
  }

  return `Joga em L${move.linha + 1} C${move.coluna + 1}. Assim reduzes as respostas do adversário sem perder mobilidade própria.`;
}
