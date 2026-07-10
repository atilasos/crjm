import type {
  AIRequestV1,
  AIResponseV1,
  AIMoveCandidate,
  AICriticalThreat,
  AIPedagogyV1,
  DifficultyLevel,
} from '../../../ai-core';
import { getDifficultyProfile } from '../../../ai-core/difficulty';
import {
  calcularDistanciaMinima,
  executarColocacao,
  executarSubstituicao,
  executarSwap,
  getCorJogador,
  podeColocar,
  podeSubstituir,
  recusarSwap,
  verificarVitoria,
} from '../logic';
import type { NexState, Posicao } from '../types';
import { posToKey } from '../types';
import { NexAIClient } from './ai-client';
import type { AIDifficulty, NexAiAction } from './types';

export interface NexV1AdapterOptions {
  client?: NexAIClient;
}

const LEVEL_MAP: Record<DifficultyLevel, AIDifficulty> = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
  4: 'master',
  5: 'champion',
};

export class NexV1Adapter {
  private readonly client: NexAIClient;
  private readonly ownsClient: boolean;

  constructor(options: NexV1AdapterOptions = {}) {
    if (options.client) {
      this.client = options.client;
      this.ownsClient = false;
      return;
    }

    this.client = new NexAIClient();
    this.ownsClient = true;
  }

  async compute(
    request: AIRequestV1<NexState, NexAiAction>,
  ): Promise<AIResponseV1<NexAiAction, NexState>> {
    const difficulty = mapLevelToNexDifficulty(request.level);
    const bestMove = await this.client.getBestAction(request.state, difficulty, {
      timeBudgetMs: request.timeBudgetMs ?? getDifficultyProfile(request.level).timeBudgetMs,
      seed: request.seed,
    });
    const topMoves = buildTopMoves(request.state, bestMove);
    const criticalThreats = buildCriticalThreats(request.state, topMoves);
    const pedagogy = buildPedagogy(request.state, topMoves);
    const metrics = this.client.metrics;

    return {
      version: '1.0',
      requestId: request.requestId,
      gameId: 'nex',
      mode: request.mode,
      bestMove,
      topMoves,
      explainText: buildExplainText(request.state, bestMove, topMoves),
      confidence: topMoves[0]?.confidence ?? 0.48,
      criticalThreats,
      pedagogy,
      stats: {
        elapsedMs: metrics.lastTimeMs,
        usedWasm: metrics.usedWasm,
        engine: metrics.usedWasm ? 'rust-wasm' : 'ts-fallback',
      },
      warnings: metrics.usedWasm ? undefined : ['A análise desta dica usou o fallback atual do Nex.'],
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

export function mapLevelToNexDifficulty(level: DifficultyLevel): AIDifficulty {
  return LEVEL_MAP[level];
}

function listEmptyCells(state: NexState): Posicao[] {
  const empties: Posicao[] = [];
  for (let x = 0; x < state.tabuleiro.length; x++) {
    const row = state.tabuleiro[x];
    if (!row) continue;
    for (let y = 0; y < row.length; y++) {
      if (row[y] === 'vazia') {
        empties.push({ x, y });
      }
    }
  }
  return empties;
}

function listNeutralCells(state: NexState): Posicao[] {
  const cells: Posicao[] = [];
  for (let x = 0; x < state.tabuleiro.length; x++) {
    const row = state.tabuleiro[x];
    if (!row) continue;
    for (let y = 0; y < row.length; y++) {
      if (row[y] === 'neutra') {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function listOwnCells(state: NexState): Posicao[] {
  const ownColor = getCorJogador(state, state.jogadorAtual);
  const cells: Posicao[] = [];
  for (let x = 0; x < state.tabuleiro.length; x++) {
    const row = state.tabuleiro[x];
    if (!row) continue;
    for (let y = 0; y < row.length; y++) {
      if (row[y] === ownColor) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function sampleByCenter(cells: Posicao[], limit: number): Posicao[] {
  const center = 5;
  return [...cells]
    .sort(
      (a, b) =>
        Math.abs(a.x - center) + Math.abs(a.y - center) - (Math.abs(b.x - center) + Math.abs(b.y - center)),
    )
    .slice(0, Math.min(limit, cells.length));
}

function applyAction(state: NexState, action: NexAiAction): NexState {
  if (action.type === 'swap') return executarSwap(state);
  if (action.type === 'recusar_swap') return recusarSwap(state);
  if (action.type === 'colocar') {
    return executarColocacao(state, {
      tipo: 'colocacao',
      posPropria: action.own,
      posNeutra: action.neutral,
    });
  }
  return executarSubstituicao(state, {
    tipo: 'substituicao',
    neutrasParaProprias: [action.n1, action.n2],
    propriaParaNeutra: action.sacrifice,
  });
}

function estimateActionScore(state: NexState, action: NexAiAction): number {
  const simulated = applyAction(state, action);
  const ownColor = getCorJogador(state, state.jogadorAtual);
  const opponentColor = ownColor === 'preta' ? 'branca' : 'preta';

  if (simulated.estado !== 'a-jogar' || verificarVitoria(simulated.tabuleiro, ownColor)) {
    return 10_000;
  }

  const ownDistance = calcularDistanciaMinima(simulated.tabuleiro, ownColor);
  const opponentDistance = calcularDistanciaMinima(simulated.tabuleiro, opponentColor);
  let score = (opponentDistance - ownDistance) * 10;

  if (action.type === 'swap') score += 12;
  if (action.type === 'colocar') score += 2;
  if (action.type === 'substituir') score -= 1;
  return Number(score.toFixed(2));
}

function samePos(a: Posicao, b: Posicao): boolean {
  return a.x === b.x && a.y === b.y;
}

function sameAction(a: NexAiAction, b: NexAiAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'swap' || a.type === 'recusar_swap') return true;
  if (a.type === 'colocar' && b.type === 'colocar') {
    return samePos(a.own, b.own) && samePos(a.neutral, b.neutral);
  }
  if (a.type === 'substituir' && b.type === 'substituir') {
    return (
      samePos(a.n1, b.n1) &&
      samePos(a.n2, b.n2) &&
      samePos(a.sacrifice, b.sacrifice)
    );
  }
  return false;
}

function buildCandidateActions(state: NexState): NexAiAction[] {
  if (state.swapDisponivel) {
    return [{ type: 'swap' }, { type: 'recusar_swap' }];
  }

  const candidates: NexAiAction[] = [];

  if (podeColocar(state.tabuleiro)) {
    const empties = sampleByCenter(listEmptyCells(state), 8);
    for (let i = 0; i < empties.length; i++) {
      const own = empties[i];
      if (!own) continue;
      for (let j = 0; j < empties.length; j++) {
        const neutral = empties[j];
        if (!neutral) continue;
        if (i === j) continue;
        candidates.push({
          type: 'colocar',
          own,
          neutral,
        });
        if (candidates.length >= 18) {
          return candidates;
        }
      }
    }
  }

  if (podeSubstituir(state.tabuleiro, state.jogadorAtual, state.swapEfetuado)) {
    const neutrals = sampleByCenter(listNeutralCells(state), 6);
    const ownCells = sampleByCenter(listOwnCells(state), 4);
    for (let i = 0; i < neutrals.length; i++) {
      const n1 = neutrals[i];
      if (!n1) continue;
      for (let j = i + 1; j < neutrals.length; j++) {
        const n2 = neutrals[j];
        if (!n2) continue;
        for (const own of ownCells) {
          candidates.push({
            type: 'substituir',
            n1,
            n2,
            sacrifice: own,
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

function buildReason(action: NexAiAction, state: NexState): string {
  if (action.type === 'swap') {
    return 'Troca de cor porque a abertura rival te oferece ligação melhor.';
  }
  if (action.type === 'recusar_swap') {
    return 'Mantém a cor atual porque a abertura ainda te favorece.';
  }
  if (action.type === 'substituir') {
    return 'Converte duas neutras críticas em ligação própria e reabre uma peça tua.';
  }
  if (state.swapDisponivel) {
    return 'Decide primeiro a melhor cor para este tabuleiro.';
  }
  return 'Liga a tua rede e usa a neutra para atrasar o melhor caminho adversário.';
}

function buildTopMoves(
  state: NexState,
  bestMove: NexAiAction | null,
): AIMoveCandidate<NexAiAction>[] {
  const ranked = buildCandidateActions(state)
    .map((move) => ({ move, score: estimateActionScore(state, move) }))
    .sort((a, b) => b.score - a.score);

  const selected: Array<{ move: NexAiAction; score: number }> = [];
  if (bestMove) {
    selected.push({ move: bestMove, score: estimateActionScore(state, bestMove) });
  }

  for (const entry of ranked) {
    if (selected.length >= 3) break;
    if (selected.some((candidate) => sameAction(candidate.move, entry.move))) continue;
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
  state: NexState,
  topMoves: AIMoveCandidate<NexAiAction>[],
): AICriticalThreat<NexAiAction>[] {
  const ownColor = getCorJogador(state, state.jogadorAtual);
  const opponentColor = ownColor === 'preta' ? 'branca' : 'preta';
  const opponentDistance = calcularDistanciaMinima(state.tabuleiro, opponentColor);

  if (state.swapDisponivel && topMoves[0]) {
    return [
      {
        id: 'swap-decision',
        severity: 'medium',
        title: 'Decisão crítica de swap',
        description: 'Este turno decide se jogas com a cor mais promissora da abertura.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  if (opponentDistance <= 2 && topMoves[0]) {
    return [
      {
        id: 'opponent-connection-threat',
        severity: 'high',
        title: 'Ligação adversária muito perto',
        description: 'Usa a tua jogada para cortar já o caminho rival ou perdes a corrida.',
        counterMove: topMoves[0].move,
      },
    ];
  }

  return [];
}

function buildPedagogy(
  state: NexState,
  topMoves: AIMoveCandidate<NexAiAction>[],
): AIPedagogyV1 {
  if (state.swapDisponivel) {
    return {
      errorCode: 'E-NX-01',
      hintLevelSuggested: 'H3',
      turningPointScore: 0.88,
      aeCompetency: ['aberturas', 'regra da torta'],
    };
  }

  return {
    errorCode: 'E-NX-02',
    hintLevelSuggested: topMoves[0]?.confidence && topMoves[0].confidence > 0.72 ? 'H1' : 'H2',
    turningPointScore: 0.7,
    aeCompetency: ['ligação', 'bloqueio com neutras'],
  };
}

function buildExplainText(
  state: NexState,
  bestMove: NexAiAction | null,
  topMoves: AIMoveCandidate<NexAiAction>[],
): string {
  const move = bestMove ?? topMoves[0]?.move;
  if (!move) {
    return 'Compara sempre a tua distância de ligação com a do adversário antes de agir.';
  }

  if (move.type === 'swap') {
    return 'A abertura favorece a cor rival. Confirma se trocar te dá o caminho mais curto entre margens.';
  }
  if (move.type === 'recusar_swap') {
    return 'A tua cor atual ainda conserva a rota mais limpa. Confirma se o swap só ajudaria o adversário.';
  }
  if (move.type === 'substituir') {
    return 'Procura uma substituição que encurte a tua ligação sem abrir de imediato a ponte rival.';
  }
  return 'Procura uma colocação em que a tua peça avance a ligação e a neutra corte a rota rival mais curta.';
}

function formatPos(pos: Posicao): string {
  return `(${pos.x + 1},${pos.y + 1})`;
}
