import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  AICriticalThreat,
  AITurningPoint,
  DifficultyLevel,
} from '../../../ai-core';
import {
  calcularJogadasValidas,
  colocarPedra,
  encontrarGrupo,
  encontrarGruposEmAtari,
} from '../logic';
import type { AtariGoState, Posicao } from '../types';
import { AtariGoAIClient, type AIClientOptions, idxToPos } from './ai-client';
import type { AIDifficulty, AIMetrics } from './types';

export interface AtariGoV1AdapterOptions {
  client?: AtariGoV1Client;
  clientOptions?: AIClientOptions;
}

export interface AtariGoV1Client {
  readonly metrics: AIMetrics;
  getBestMove(state: AtariGoState, difficulty: AIDifficulty): Promise<number | null>;
  cancel(): void;
  terminate(): void;
}

export class AtariGoV1Adapter {
  private readonly client: AtariGoV1Client;
  private readonly ownsClient: boolean;

  constructor(options: AtariGoV1AdapterOptions = {}) {
    if (options.client) {
      this.client = options.client;
      this.ownsClient = false;
      return;
    }

    this.client = new AtariGoAIClient(options.clientOptions);
    this.ownsClient = true;
  }

  async compute(
    request: AIRequestV1<AtariGoState, Posicao>,
  ): Promise<AIResponseV1<Posicao, AtariGoState>> {
    const startedAt = performance.now();
    const difficulty = mapLevelToLegacyDifficulty(request.level);
    const bestMoveIdx = await this.client.getBestMove(request.state, difficulty);
    const bestMove = bestMoveIdx === null ? null : idxToPos(bestMoveIdx);
    const topMoves = buildTopMoves(request.state, bestMove);
    const criticalThreats = buildCriticalThreats(request.state, topMoves);
    const turningPoints = buildTurningPoints(request.state, topMoves, criticalThreats);
    const elapsedMs = Math.max(
      this.client.metrics.lastTimeMs,
      performance.now() - startedAt,
    );

    return {
      version: '1.0',
      requestId: request.requestId,
      gameId: 'atari-go',
      mode: request.mode,
      bestMove,
      topMoves,
      explainText: buildExplainText(bestMove, criticalThreats),
      confidence: topMoves[0]?.confidence,
      criticalThreats,
      turningPoints,
      stats: {
        elapsedMs,
        depth: this.client.metrics.lastStats?.depth,
        nodes: this.client.metrics.lastStats?.nodes,
        usedWasm: this.client.metrics.usedWasm,
        engine: this.client.metrics.usedWasm ? 'rust-wasm' : 'ts-fallback',
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

export function mapLevelToLegacyDifficulty(level: DifficultyLevel): AIDifficulty {
  if (level <= 2) return 'easy';
  if (level === 3) return 'medium';
  if (level === 4) return 'hard';
  return 'very-hard';
}

function buildTopMoves(
  state: AtariGoState,
  bestMove: Posicao | null,
): AIMoveCandidate<Posicao>[] {
  const legalMoves =
    state.jogadasValidas.length > 0
      ? state.jogadasValidas
      : calcularJogadasValidas(state.tabuleiro, state.jogadorAtual);

  if (legalMoves.length === 0) {
    return [];
  }

  const scored = legalMoves.map((move) => {
    const simulation = simulateMove(state, move, state.jogadorAtual);
    return {
      move,
      score:
        simulation.isWinningCapture * 1000 +
        simulation.capturedCount * 350 +
        simulation.opponentAtariCount * 40 +
        simulation.ownLiberties * 6 -
        distanceToCenter(move),
      isWinningCapture: simulation.isWinningCapture,
      putsOpponentInAtari: simulation.opponentAtariCount > 0,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.move.linha !== b.move.linha) return a.move.linha - b.move.linha;
    return a.move.coluna - b.move.coluna;
  });

  const maxScore = scored[0].score;
  const minScore = scored[scored.length - 1].score;
  const selected: typeof scored = [];

  if (bestMove) {
    const best = scored.find((item) => samePos(item.move, bestMove));
    if (best) selected.push(best);
  }

  for (const item of scored) {
    if (selected.length >= 3) break;
    if (selected.some((selectedItem) => samePos(selectedItem.move, item.move))) continue;
    selected.push(item);
  }

  return selected.map((item, index) => ({
    move: item.move,
    rank: (index + 1) as 1 | 2 | 3,
    score: item.score,
    confidence: normalizeConfidence(item.score, maxScore, minScore),
    reasonShort: buildReason(item.isWinningCapture, item.putsOpponentInAtari),
  }));
}

function buildCriticalThreats(
  state: AtariGoState,
  topMoves: AIMoveCandidate<Posicao>[],
): AICriticalThreat<Posicao>[] {
  const opponent = getOpponent(state.jogadorAtual);
  const opponentMoves = calcularJogadasValidas(state.tabuleiro, opponent);
  const immediateWins = opponentMoves.filter((move) =>
    simulateMove(state, move, opponent).isWinningCapture,
  );

  if (immediateWins.length === 0) {
    return [];
  }

  return [
    {
      id: 'opponent-immediate-capture',
      severity: immediateWins.length > 1 ? 'high' : 'medium',
      title: 'Captura imediata do adversário',
      description:
        immediateWins.length > 1
          ? 'O adversário tem várias capturas de vitória no próximo turno.'
          : 'O adversário pode ganhar já no próximo turno com uma captura.',
      counterMove: topMoves[0]?.move,
    },
  ];
}

function buildTurningPoints(
  state: AtariGoState,
  topMoves: AIMoveCandidate<Posicao>[],
  threats: AICriticalThreat<Posicao>[],
): AITurningPoint<Posicao>[] {
  const pivotMove = topMoves[0]?.move;
  if (!pivotMove) return [];

  const occupied = countOccupied(state);

  if (threats.length > 0) {
    return [
      {
        ply: occupied + 1,
        playedMove: pivotMove,
        bestMove: pivotMove,
        explanation: 'Momento-chave: bloquear captura imediata evita derrota no turno seguinte.',
        patternId: 'TP-ATARI-DEFENSE',
      },
    ];
  }

  if ((topMoves[0]?.score ?? 0) - (topMoves[1]?.score ?? 0) >= 120) {
    return [
      {
        ply: occupied + 1,
        playedMove: pivotMove,
        bestMove: pivotMove,
        explanation: 'Momento-chave: esta jogada aumenta a pressão tática e cria vantagem de liberdades.',
        patternId: 'TP-ATARI-PRESSURE',
      },
    ];
  }

  return [];
}

function buildExplainText(
  bestMove: Posicao | null,
  threats: AICriticalThreat<Posicao>[],
): string {
  if (!bestMove) {
    return 'Sem jogadas válidas nesta posição. Tenta manter grupos com mais liberdades no turno anterior.';
  }

  if (threats[0]?.severity === 'high') {
    return 'Prioridade máxima: bloqueia já a captura do adversário para manteres o jogo vivo.';
  }

  if (threats.length > 0) {
    return 'Há risco tático imediato. Defende primeiro e só depois procura ataque.';
  }

  return 'Procura jogadas que aumentem as tuas liberdades e reduzam as respostas do adversário.';
}

function buildReason(isWinningCapture: boolean, putsOpponentInAtari: boolean): string {
  if (isWinningCapture) {
    return 'Captura imediata para fechar a partida.';
  }

  if (putsOpponentInAtari) {
    return 'Pressiona grupos adversários e cria ameaça de captura.';
  }

  return 'Mantém equilíbrio entre defesa local e pressão tática.';
}

function normalizeConfidence(score: number, maxScore: number, minScore: number): number {
  if (maxScore === minScore) return 0.5;
  const raw = (score - minScore) / (maxScore - minScore);
  return Number(Math.max(0, Math.min(1, raw)).toFixed(2));
}

function simulateMove(
  state: AtariGoState,
  move: Posicao,
  player: AtariGoState['jogadorAtual'],
): {
  isWinningCapture: boolean;
  capturedCount: number;
  opponentAtariCount: number;
  ownLiberties: number;
} {
  const validMoves = calcularJogadasValidas(state.tabuleiro, player);
  const simulationState: AtariGoState = {
    ...state,
    jogadorAtual: player,
    jogadasValidas: validMoves,
    estado: 'a-jogar',
  };
  const next = colocarPedra(simulationState, move);
  const playerColor = getPlayerColor(player);
  const opponentColor = playerColor === 'preta' ? 'branca' : 'preta';
  const capturedCount =
    playerColor === 'preta'
      ? next.pedrasCapturadas.brancas - state.pedrasCapturadas.brancas
      : next.pedrasCapturadas.pretas - state.pedrasCapturadas.pretas;
  const opponentAtariCount = encontrarGruposEmAtari(next.tabuleiro, opponentColor).length;
  const ownGroup = encontrarGrupo(next.tabuleiro, move);
  const ownLiberties = ownGroup?.liberdades.length ?? 0;
  const playerVictoryState =
    player === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2';

  return {
    isWinningCapture: next.estado === playerVictoryState,
    capturedCount: Math.max(0, capturedCount),
    opponentAtariCount,
    ownLiberties,
  };
}

function countOccupied(state: AtariGoState): number {
  let count = 0;
  for (const row of state.tabuleiro) {
    for (const cell of row) {
      if (cell !== 'vazia') count += 1;
    }
  }
  return count;
}

function getPlayerColor(player: AtariGoState['jogadorAtual']): 'preta' | 'branca' {
  return player === 'jogador1' ? 'preta' : 'branca';
}

function getOpponent(player: AtariGoState['jogadorAtual']): AtariGoState['jogadorAtual'] {
  return player === 'jogador1' ? 'jogador2' : 'jogador1';
}

function samePos(a: Posicao, b: Posicao): boolean {
  return a.linha === b.linha && a.coluna === b.coluna;
}

function distanceToCenter(move: Posicao): number {
  const center = 4;
  return Math.abs(move.linha - center) + Math.abs(move.coluna - center);
}
