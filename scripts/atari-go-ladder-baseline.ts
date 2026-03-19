import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DifficultyLevel } from '../src/ai-core';
import { DIFFICULTY_PROFILES } from '../src/ai-core';
import {
  calcularJogadasValidas,
  colocarPedra,
  criarEstadoInicial,
  encontrarGrupo,
  encontrarGruposEmAtari,
  isJogadaValida,
} from '../src/games/atari-go/logic';
import type { AtariGoState, Posicao } from '../src/games/atari-go/types';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];
const LADDER: Array<[DifficultyLevel, DifficultyLevel]> = [
  [2, 1],
  [3, 2],
  [4, 3],
  [5, 4],
];

interface HarnessOptions {
  gamesPerMirror: number;
  maxPliesPerGame: number;
  budgetScale: number;
}

interface DecisionSample {
  level: DifficultyLevel;
  elapsedMs: number;
  legal: boolean;
}

interface GameRun {
  gameId: string;
  strongerLevel: DifficultyLevel;
  weakerLevel: DifficultyLevel;
  strongerAs: 'jogador1' | 'jogador2';
  winner: 'stronger' | 'weaker' | 'draw-timeout';
  plies: number;
  decisions: DecisionSample[];
}

interface LadderSummary {
  strongerLevel: DifficultyLevel;
  weakerLevel: DifficultyLevel;
  games: number;
  strongerWins: number;
  weakerWins: number;
  draws: number;
  strongerWinrate: number;
  t1Pass: boolean;
}

interface T2Summary {
  p50: number;
  p95: number;
  budgetMs: number;
  t2Pass: boolean;
}

interface AtariGoBaselineResult {
  generatedAt: string;
  options: HarnessOptions;
  totals: {
    games: number;
    decisions: number;
  };
  ladder: LadderSummary[];
  t2ByLevel: Record<DifficultyLevel, T2Summary>;
  nC2: {
    failedPairs: string[];
    passAll: boolean;
  };
  nC3: {
    failedLevels: number[];
    monotonicSteps: Array<{
      fromLevel: DifficultyLevel;
      toLevel: DifficultyLevel;
      fromP50: number;
      toP50: number;
      pass: boolean;
    }>;
    monotonicPassCount: number;
    monotonicPassRequired: number;
    passAll: boolean;
  };
  gameRuns: GameRun[];
}

interface MoveScore {
  move: Posicao;
  baseScore: number;
}

function parseOptions(): HarnessOptions {
  const gamesPerMirror = Number(process.env.ATARIGO_GAMES_PER_MIRROR ?? 5);
  const maxPliesPerGame = Number(process.env.ATARIGO_MAX_PLIES ?? 72);
  const budgetScale = Number(process.env.ATARIGO_BUDGET_SCALE ?? 1);

  return {
    gamesPerMirror: Number.isFinite(gamesPerMirror) && gamesPerMirror > 0 ? Math.trunc(gamesPerMirror) : 5,
    maxPliesPerGame: Number.isFinite(maxPliesPerGame) && maxPliesPerGame > 0 ? Math.trunc(maxPliesPerGame) : 72,
    budgetScale: Number.isFinite(budgetScale) && budgetScale > 0 ? budgetScale : 1,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return Number(sorted[idx].toFixed(2));
}

function getPlayerColor(player: AtariGoState['jogadorAtual']): 'preta' | 'branca' {
  return player === 'jogador1' ? 'preta' : 'branca';
}

function getOpponent(player: AtariGoState['jogadorAtual']): AtariGoState['jogadorAtual'] {
  return player === 'jogador1' ? 'jogador2' : 'jogador1';
}

function simulateMove(
  state: AtariGoState,
  move: Posicao,
  player: AtariGoState['jogadorAtual'],
): {
  next: AtariGoState;
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
    next,
    isWinningCapture: next.estado === playerVictoryState,
    capturedCount: Math.max(0, capturedCount),
    opponentAtariCount,
    ownLiberties,
  };
}

function distanceToCenter(move: Posicao): number {
  const center = 4;
  return Math.abs(move.linha - center) + Math.abs(move.coluna - center);
}

function scoreMoves(state: AtariGoState, player: AtariGoState['jogadorAtual']): MoveScore[] {
  const legalMoves =
    state.jogadasValidas.length > 0
      ? state.jogadasValidas
      : calcularJogadasValidas(state.tabuleiro, player);

  const scored = legalMoves.map((move) => {
    const simulation = simulateMove(state, move, player);
    const baseScore =
      simulation.isWinningCapture * 1000 +
      simulation.capturedCount * 350 +
      simulation.opponentAtariCount * 40 +
      simulation.ownLiberties * 6 -
      distanceToCenter(move);
    return { move, baseScore };
  });

  scored.sort((a, b) => {
    if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
    if (a.move.linha !== b.move.linha) return a.move.linha - b.move.linha;
    return a.move.coluna - b.move.coluna;
  });

  return scored;
}

function rankIndexForLevel(level: DifficultyLevel, total: number): number {
  if (total <= 1) return 0;
  if (level <= 1) return Math.min(total - 1, 3);
  if (level === 2) return Math.min(total - 1, 2);
  if (level === 3) return Math.min(total - 1, 1);
  return 0;
}

function chooseMove(state: AtariGoState, level: DifficultyLevel): Posicao | null {
  const player = state.jogadorAtual;
  const scored = scoreMoves(state, player);
  if (scored.length === 0) return null;

  if (level <= 4) {
    return scored[rankIndexForLevel(level, scored.length)]?.move ?? scored[0].move;
  }

  const opponent = getOpponent(player);
  let best = scored[0];
  let bestSafetyScore = Number.NEGATIVE_INFINITY;

  for (const candidate of scored.slice(0, 4)) {
    const simulation = simulateMove(state, candidate.move, player);
    if (simulation.isWinningCapture) {
      return candidate.move;
    }

    const opponentMoves =
      simulation.next.jogadasValidas.length > 0
        ? simulation.next.jogadasValidas
        : calcularJogadasValidas(simulation.next.tabuleiro, opponent);

    const opponentCanWinImmediately = opponentMoves.some(
      (move) => simulateMove(simulation.next, move, opponent).isWinningCapture,
    );

    const safetyScore = candidate.baseScore - (opponentCanWinImmediately ? 900 : 0);
    if (safetyScore > bestSafetyScore) {
      bestSafetyScore = safetyScore;
      best = candidate;
    }
  }

  return best.move;
}

function winnerForPerspective(
  state: AtariGoState,
  strongerAs: 'jogador1' | 'jogador2',
): 'stronger' | 'weaker' {
  const strongerWon =
    (state.estado === 'vitoria-jogador1' && strongerAs === 'jogador1') ||
    (state.estado === 'vitoria-jogador2' && strongerAs === 'jogador2');
  return strongerWon ? 'stronger' : 'weaker';
}

async function runGame(
  strongerLevel: DifficultyLevel,
  weakerLevel: DifficultyLevel,
  strongerAs: 'jogador1' | 'jogador2',
  gameId: string,
  options: HarnessOptions,
): Promise<GameRun> {
  let state = criarEstadoInicial('dois-jogadores');
  const decisions: DecisionSample[] = [];
  let ply = 0;

  while (state.estado === 'a-jogar' && ply < options.maxPliesPerGame) {
    const isJogador1Turn = state.jogadorAtual === 'jogador1';
    const level =
      (isJogador1Turn && strongerAs === 'jogador1') || (!isJogador1Turn && strongerAs === 'jogador2')
        ? strongerLevel
        : weakerLevel;

    const startedAt = performance.now();
    const bestMove = chooseMove(state, level);
    const elapsedMs = Math.max(0, performance.now() - startedAt);

    const legal = bestMove ? isJogadaValida(state, bestMove) : state.jogadasValidas.length === 0;
    decisions.push({
      level,
      elapsedMs,
      legal,
    });

    if (!legal || !bestMove) {
      break;
    }

    state = colocarPedra(state, bestMove);
    ply += 1;
  }

  const winner =
    state.estado === 'a-jogar'
      ? 'draw-timeout'
      : winnerForPerspective(state, strongerAs);

  return {
    gameId,
    strongerLevel,
    weakerLevel,
    strongerAs,
    winner,
    plies: ply,
    decisions,
  };
}

function summarizeT2(level: DifficultyLevel, samples: number[], options: HarnessOptions): T2Summary {
  const p50 = percentile(samples, 0.5);
  const p95 = percentile(samples, 0.95);
  const budgetMs = Math.max(1, Math.round(DIFFICULTY_PROFILES[level].timeBudgetMs * options.budgetScale));
  const t2Pass = p50 <= budgetMs && p95 <= Math.max(p50 * 3, 1);
  return { p50, p95, budgetMs, t2Pass };
}

function summarize(results: GameRun[], options: HarnessOptions): AtariGoBaselineResult {
  const ladder: LadderSummary[] = [];
  const elapsedByLevel: Record<DifficultyLevel, number[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
  };

  let totalDecisions = 0;

  for (const run of results) {
    for (const decision of run.decisions) {
      if (!decision.legal) continue;
      totalDecisions += 1;
      elapsedByLevel[decision.level].push(decision.elapsedMs);
    }
  }

  for (const [strongerLevel, weakerLevel] of LADDER) {
    const subset = results.filter(
      (run) => run.strongerLevel === strongerLevel && run.weakerLevel === weakerLevel,
    );
    const strongerWins = subset.filter((run) => run.winner === 'stronger').length;
    const weakerWins = subset.filter((run) => run.winner === 'weaker').length;
    const draws = subset.filter((run) => run.winner === 'draw-timeout').length;
    const strongerWinrate = subset.length === 0 ? 0 : strongerWins / subset.length;

    ladder.push({
      strongerLevel,
      weakerLevel,
      games: subset.length,
      strongerWins,
      weakerWins,
      draws,
      strongerWinrate: Number(strongerWinrate.toFixed(4)),
      t1Pass: strongerWinrate >= 0.55,
    });
  }

  const t2ByLevel = {
    1: summarizeT2(1, elapsedByLevel[1], options),
    2: summarizeT2(2, elapsedByLevel[2], options),
    3: summarizeT2(3, elapsedByLevel[3], options),
    4: summarizeT2(4, elapsedByLevel[4], options),
    5: summarizeT2(5, elapsedByLevel[5], options),
  } as Record<DifficultyLevel, T2Summary>;

  const failedPairs = ladder
    .filter((row) => !row.t1Pass)
    .map((row) => `N${row.strongerLevel}>N${row.weakerLevel}`);

  const failedLevels = LEVELS
    .filter((level) => !t2ByLevel[level].t2Pass)
    .map((level) => Number(level));

  const monotonicSteps = ([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
  ] as Array<[DifficultyLevel, DifficultyLevel]>).map(([fromLevel, toLevel]) => {
    const fromP50 = t2ByLevel[fromLevel].p50;
    const toP50 = t2ByLevel[toLevel].p50;
    return {
      fromLevel,
      toLevel,
      fromP50,
      toP50,
      pass: toP50 >= fromP50,
    };
  });

  const monotonicPassCount = monotonicSteps.filter((step) => step.pass).length;
  const monotonicPassRequired = Math.max(1, monotonicSteps.length - 1);

  return {
    generatedAt: new Date().toISOString(),
    options,
    totals: {
      games: results.length,
      decisions: totalDecisions,
    },
    ladder,
    t2ByLevel,
    nC2: {
      failedPairs,
      passAll: failedPairs.length === 0,
    },
    nC3: {
      failedLevels,
      monotonicSteps,
      monotonicPassCount,
      monotonicPassRequired,
      passAll: failedLevels.length === 0 && monotonicPassCount >= monotonicPassRequired,
    },
    gameRuns: results,
  };
}

async function saveArtifacts(result: AtariGoBaselineResult): Promise<void> {
  const stamp = result.generatedAt.replace(/[:]/g, '-').replace(/\..+$/, '');
  const outputDir = join(import.meta.dir, '..', 'artifacts', 'atari-go-baseline', stamp);
  const latestDir = join(import.meta.dir, '..', 'artifacts', 'atari-go-baseline', 'latest');
  await mkdir(outputDir, { recursive: true });
  await mkdir(latestDir, { recursive: true });

  const json = `${JSON.stringify(result, null, 2)}\n`;
  await writeFile(join(outputDir, 'baseline.json'), json, 'utf8');
  await writeFile(join(latestDir, 'baseline.json'), json, 'utf8');

  console.log(`[atari-go-baseline] artifacts written to ${outputDir}`);
  console.log(`[atari-go-baseline] latest snapshot updated at ${latestDir}`);
}

async function main(): Promise<void> {
  const options = parseOptions();
  console.log('[atari-go-baseline] starting', options);

  const runs: GameRun[] = [];
  for (const [strongerLevel, weakerLevel] of LADDER) {
    for (let i = 0; i < options.gamesPerMirror; i += 1) {
      runs.push(
        await runGame(strongerLevel, weakerLevel, 'jogador1', `${strongerLevel}v${weakerLevel}-A-${i + 1}`, options),
      );
      runs.push(
        await runGame(strongerLevel, weakerLevel, 'jogador2', `${strongerLevel}v${weakerLevel}-B-${i + 1}`, options),
      );
    }
  }

  const baseline = summarize(runs, options);
  await saveArtifacts(baseline);

  console.log(
    `[atari-go-baseline] done: games=${baseline.totals.games}, decisions=${baseline.totals.decisions}, nC2Pass=${baseline.nC2.passAll}, nC3Pass=${baseline.nC3.passAll}`,
  );
}

main().catch((error) => {
  console.error('[atari-go-baseline] fatal', error);
  process.exit(1);
});
