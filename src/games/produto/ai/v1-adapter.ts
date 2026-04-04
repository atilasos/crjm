import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  AICriticalThreat,
  AIPedagogyV1,
  DifficultyLevel,
} from '../../../ai-core';
import { calcularPontuacao } from '../logic';
import type { JogadaDupla, Posicao, ProdutoState } from '../types';
import { posToKey } from '../types';
import { ProdutoAIClient, decodeMove, type DecodedMove } from './ai-client';
import type { AIDifficulty, ProdutoPackedMove } from './types';

export interface ProdutoV1AdapterOptions {
  client?: ProdutoV1Client;
}

export interface ProdutoV1Client {
  readonly metrics: {
    lastTimeMs: number;
    usedWasm: boolean;
    lastExplain?: string;
  };
  readonly idxToPos: Posicao[];
  getBestMove(state: ProdutoState, difficulty: AIDifficulty): Promise<ProdutoPackedMove | null>;
  cancel(): void;
  terminate(): void;
}

const LEVEL_MAP: Record<DifficultyLevel, AIDifficulty> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
  4: 'very-hard',
  5: 'max',
};

export class ProdutoV1Adapter {
  private readonly client: ProdutoV1Client;
  private readonly ownsClient: boolean;

  constructor(options: ProdutoV1AdapterOptions = {}) {
    if (options.client) {
      this.client = options.client;
      this.ownsClient = false;
      return;
    }

    this.client = new ProdutoAIClient();
    this.ownsClient = true;
  }

  async compute(
    request: AIRequestV1<ProdutoState, JogadaDupla>,
  ): Promise<AIResponseV1<JogadaDupla, ProdutoState>> {
    const difficulty = mapLevelToProdutoDifficulty(request.level);
    const packedMove = await this.client.getBestMove(request.state, difficulty);
    const bestMove = decodePackedMove(packedMove, this.client.idxToPos);
    const topMoves = buildTopMoves(request.state, bestMove);
    const criticalThreats = buildCriticalThreats(request.state, topMoves);
    const pedagogy = buildPedagogy(request.state, topMoves);
    const metrics = this.client.metrics;

    return {
      version: '1.0',
      requestId: request.requestId,
      gameId: 'produto',
      mode: request.mode,
      bestMove,
      topMoves,
      explainText: buildExplainText(request.state, bestMove, topMoves, metrics.lastExplain),
      confidence: topMoves[0]?.confidence ?? 0.48,
      criticalThreats,
      pedagogy,
      stats: {
        elapsedMs: metrics.lastTimeMs,
        usedWasm: metrics.usedWasm,
        engine: metrics.usedWasm ? 'rust-wasm' : 'ts-fallback',
      },
      warnings: metrics.usedWasm ? undefined : ['A análise desta dica usou o fallback atual do Produto.'],
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

export function mapLevelToProdutoDifficulty(level: DifficultyLevel): AIDifficulty {
  return LEVEL_MAP[level];
}

function decodePackedMove(move: ProdutoPackedMove | null, idxToPos: Posicao[]): JogadaDupla | null {
  if (!move) return null;
  const decoded = decodeMove(move, idxToPos);
  return decoded ? decodedToJogada(decoded) : null;
}

function decodedToJogada(move: DecodedMove): JogadaDupla {
  return {
    pos1: move.pos1,
    cor1: move.cor1,
    pos2: move.pos2,
    cor2: move.cor2,
  };
}

function samplePositions(state: ProdutoState): Posicao[] {
  return [...state.casasVazias]
    .sort((a, b) => distanceToCenter(a) - distanceToCenter(b))
    .slice(0, Math.min(8, state.casasVazias.length));
}

function distanceToCenter(pos: Posicao): number {
  return Math.abs(pos.q) + Math.abs(pos.r) + Math.abs(pos.q + pos.r);
}

function getPlayerColors(state: ProdutoState) {
  const own: 'preta' | 'branca' = state.jogadorAtual === 'jogador1' ? 'preta' : 'branca';
  const opponent: 'preta' | 'branca' = own === 'preta' ? 'branca' : 'preta';
  return { own, opponent };
}

function applyMove(state: ProdutoState, move: JogadaDupla): Record<string, 'vazia' | 'preta' | 'branca'> {
  const board = { ...state.tabuleiro };
  board[posToKey(move.pos1)] = move.cor1;
  if (move.pos2 && move.cor2) {
    board[posToKey(move.pos2)] = move.cor2;
  }
  return board;
}

function estimateMoveScore(state: ProdutoState, move: JogadaDupla): number {
  const board = applyMove(state, move);
  const { own, opponent } = getPlayerColors(state);
  const ownScore = calcularPontuacao(board, own);
  const opponentScore = calcularPontuacao(board, opponent);
  let score = ownScore.produto - opponentScore.produto * 1.5;

  if (opponentScore.produto === 0 && opponentScore.maiorGrupo > 0) {
    score += 500;
  }

  if (ownScore.maiorGrupo > 0 && ownScore.segundoMaiorGrupo > 0) {
    const balance =
      Math.min(ownScore.maiorGrupo, ownScore.segundoMaiorGrupo) /
      Math.max(ownScore.maiorGrupo, ownScore.segundoMaiorGrupo);
    score += balance * 50;
  }

  score -= ownScore.totalPecas * 0.1;
  if (state.primeiraJogada && move.pos2 === null) {
    score += Math.max(0, 12 - distanceToCenter(move.pos1) * 2);
  }
  return Number(score.toFixed(2));
}

function buildReason(move: JogadaDupla, state: ProdutoState): string {
  if (state.primeiraJogada || move.pos2 === null) {
    return 'Começa no centro para abrir duas frentes de crescimento.';
  }
  if (move.cor1 !== move.cor2) {
    return 'Usa duas cores para crescer e atrapalhar a estrutura rival no mesmo turno.';
  }
  if (move.cor1 !== (state.jogadorAtual === 'jogador1' ? 'preta' : 'branca')) {
    return 'Sabota o produto rival ao mexer na cor adversária.';
  }
  return 'Fortalece dois grupos sem os fundir cedo demais.';
}

function buildCandidateMoves(state: ProdutoState): JogadaDupla[] {
  const positions = samplePositions(state);

  if (state.primeiraJogada) {
    return positions.slice(0, 4).map((pos, index) => ({
      pos1: pos,
      cor1: index === 0 ? 'preta' : index % 2 === 0 ? 'preta' : 'branca',
      pos2: null,
      cor2: null,
    }));
  }

  const candidates: JogadaDupla[] = [];
  const colors: Array<'preta' | 'branca'> = ['preta', 'branca'];
  for (let i = 0; i < positions.length; i++) {
    const pos1 = positions[i];
    if (!pos1) continue;
    for (let j = i + 1; j < positions.length; j++) {
      const pos2 = positions[j];
      if (!pos2) continue;
      for (const cor1 of colors) {
        for (const cor2 of colors) {
          candidates.push({
            pos1,
            cor1,
            pos2,
            cor2,
          });
          if (candidates.length >= 24) {
            return candidates;
          }
        }
      }
    }
  }
  return candidates;
}

function sameMove(a: JogadaDupla, b: JogadaDupla): boolean {
  return (
    posToKey(a.pos1) === posToKey(b.pos1) &&
    a.cor1 === b.cor1 &&
    ((a.pos2 === null && b.pos2 === null) ||
      (a.pos2 !== null &&
        b.pos2 !== null &&
        posToKey(a.pos2) === posToKey(b.pos2) &&
        a.cor2 === b.cor2))
  );
}

function buildTopMoves(
  state: ProdutoState,
  bestMove: JogadaDupla | null,
): AIMoveCandidate<JogadaDupla>[] {
  const ranked = buildCandidateMoves(state)
    .map((move) => ({ move, score: estimateMoveScore(state, move) }))
    .sort((a, b) => b.score - a.score);

  const selected: Array<{ move: JogadaDupla; score: number }> = [];
  if (bestMove) {
    selected.push({ move: bestMove, score: estimateMoveScore(state, bestMove) });
  }

  for (const entry of ranked) {
    if (selected.length >= 3) break;
    if (selected.some((candidate) => sameMove(candidate.move, entry.move))) continue;
    selected.push(entry);
  }

  const maxScore = selected[0]?.score ?? 1;
  const minScore = selected[selected.length - 1]?.score ?? maxScore;

  return selected.slice(0, 3).map((entry, index) => ({
    move: entry.move,
    rank: (index + 1) as 1 | 2 | 3,
    score: entry.score,
    confidence: normalizeConfidence(entry.score, maxScore, minScore),
    reasonShort: buildReason(entry.move, state),
  }));
}

function normalizeConfidence(score: number, max: number, min: number): number {
  if (max === min) return 0.5;
  return Number((((score - min) / (max - min)) * 0.5 + 0.42).toFixed(2));
}

function buildCriticalThreats(
  state: ProdutoState,
  topMoves: AIMoveCandidate<JogadaDupla>[],
): AICriticalThreat<JogadaDupla>[] {
  const lead = state.pontuacaoBrancas.produto - state.pontuacaoPretas.produto;
  const myScore = state.jogadorAtual === 'jogador1' ? state.pontuacaoPretas : state.pontuacaoBrancas;
  if (myScore.segundoMaiorGrupo === 0 && topMoves[0]) {
    return [
      {
        id: 'single-group-risk',
        severity: 'high',
        title: 'Só tens um grupo relevante',
        description: 'Se não criares já um segundo grupo, o teu produto continua a zero.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  if (lead > 12 && topMoves[0]) {
    return [
      {
        id: 'opponent-product-lead',
        severity: 'medium',
        title: 'O adversário já tem produto forte',
        description: 'Precisas de equilibrar dois grupos teus ou sabotar a segunda cadeia rival.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  return [];
}

function buildPedagogy(
  state: ProdutoState,
  topMoves: AIMoveCandidate<JogadaDupla>[],
): AIPedagogyV1 {
  const ownScore = state.jogadorAtual === 'jogador1' ? state.pontuacaoPretas : state.pontuacaoBrancas;
  if (ownScore.segundoMaiorGrupo === 0) {
    return {
      errorCode: 'E-PR-01',
      hintLevelSuggested: 'H3',
      turningPointScore: 0.86,
      aeCompetency: ['equilíbrio de grupos', 'leitura de produto'],
    };
  }

  return {
    errorCode: state.primeiraJogada ? 'E-PR-02' : 'E-PR-03',
    hintLevelSuggested: topMoves[0]?.confidence && topMoves[0].confidence > 0.72 ? 'H1' : 'H2',
    turningPointScore: state.casasVazias.length < 12 ? 0.78 : 0.56,
    aeCompetency: ['gestão de grupos', 'sabotagem estratégica'],
  };
}

function buildExplainText(
  state: ProdutoState,
  bestMove: JogadaDupla | null,
  topMoves: AIMoveCandidate<JogadaDupla>[],
  workerExplain?: string,
): string {
  const move = bestMove ?? topMoves[0]?.move;
  if (!move) {
    return 'Sem jogada sugerida: compara sempre o teu produto potencial com o do adversário.';
  }

  if (state.primeiraJogada || move.pos2 === null) {
    return `Abre em ${formatPos(move.pos1)}. O objetivo é começares com uma peça central que permita dois grupos fortes mais tarde.`;
  }

  if (workerExplain && workerExplain.trim().length > 0 && workerExplain.length <= 160) {
    return workerExplain.trim();
  }

  if (move.cor1 !== move.cor2) {
    return `Joga em ${formatPos(move.pos1)} e ${formatPos(move.pos2!)} com cores diferentes. Cresces a tua estrutura e atrapalhas a do adversário no mesmo turno.`;
  }

  return `Joga em ${formatPos(move.pos1)} e ${formatPos(move.pos2!)}. Manténs dois grupos úteis em vez de fundir tudo cedo demais.`;
}

function formatPos(pos: Posicao): string {
  return `(${pos.q},${pos.r})`;
}
