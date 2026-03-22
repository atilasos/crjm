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
  seed: number | null;
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

interface LevelPolicy {
  evalCap: number;
  blunderRate: number;
  safetyLookahead: 0 | 1 | 2;
}

const LEVEL_POLICY: Record<DifficultyLevel, LevelPolicy> = {
  1: { evalCap: 6, blunderRate: 0.55, safetyLookahead: 0 },
  2: { evalCap: 10, blunderRate: 0.35, safetyLookahead: 0 },
  3: { evalCap: 13, blunderRate: 0.2, safetyLookahead: 0 },
  4: { evalCap: 24, blunderRate: 0.08, safetyLookahead: 1 },
  5: { evalCap: 40, blunderRate: 0.02, safetyLookahead: 2 },
};

const T1_MIN_WINRATE_BY_PAIR: Record<string, number> = {
  '2>1': 0.62,
  '3>2': 0.6,
  '4>3': 0.57,
  '5>4': 0.55,
};

function parseCliNumberArg(flag: string): number | null {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === flag);
  if (index === -1) return null;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

function parseOptionalSeed(envName: string): number | null {
  const cliSeed = parseCliNumberArg('--seed');
  if (cliSeed !== null) return cliSeed >>> 0;

  const envSeedRaw = process.env[envName];
  if (envSeedRaw === undefined) return null;
  const envSeed = Number(envSeedRaw);
  if (!Number.isFinite(envSeed)) return null;
  return Math.trunc(envSeed) >>> 0;
}

function getLadderThreshold(strongerLevel: DifficultyLevel, weakerLevel: DifficultyLevel): number {
  const key = `${strongerLevel}>${weakerLevel}`;
  return T1_MIN_WINRATE_BY_PAIR[key] ?? 0.6;
}

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deriveSeed(baseSeed: number | null, key: string): number | null {
  if (baseSeed === null) return null;
  return (baseSeed ^ fnv1a32(key)) >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRandom(seed: number | null): () => number {
  if (seed === null) return Math.random;
  return mulberry32(seed);
}

function parseOptions(): HarnessOptions {
  const gamesPerMirror = Number(process.env.ATARIGO_GAMES_PER_MIRROR ?? 10);
  const maxPliesPerGame = Number(process.env.ATARIGO_MAX_PLIES ?? 72);
  const budgetScale = Number(process.env.ATARIGO_BUDGET_SCALE ?? 1);
  const seed = parseOptionalSeed('ATARIGO_SEED');

  return {
    gamesPerMirror: Number.isFinite(gamesPerMirror) && gamesPerMirror > 0 ? Math.trunc(gamesPerMirror) : 10,
    maxPliesPerGame: Number.isFinite(maxPliesPerGame) && maxPliesPerGame > 0 ? Math.trunc(maxPliesPerGame) : 72,
    budgetScale: Number.isFinite(budgetScale) && budgetScale > 0 ? budgetScale : 1,
    seed,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
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

function scoreMoves(
  state: AtariGoState,
  player: AtariGoState['jogadorAtual'],
  evalCapInput: number,
): MoveScore[] {
  const legalMoves =
    state.jogadasValidas.length > 0
      ? state.jogadasValidas
      : calcularJogadasValidas(state.tabuleiro, player);

  const evalCap = Math.max(1, Math.min(legalMoves.length, evalCapInput));

  const scored = legalMoves.map((move, index) => {
    if (index >= evalCap) {
      return { move, baseScore: Number.NEGATIVE_INFINITY };
    }
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

function rankIndexForLevel(
  level: DifficultyLevel,
  total: number,
  random: () => number,
): number {
  if (total <= 1) return 0;
  const policy = LEVEL_POLICY[level];

  if (random() >= policy.blunderRate) {
    return 0;
  }

  const mistakeWindow = level <= 1 ? 4 : level === 2 ? 3 : level === 3 ? 2 : 1;
  const maxMistakeRank = Math.min(total - 1, mistakeWindow);
  if (maxMistakeRank <= 0) return 0;
  return 1 + Math.floor(random() * maxMistakeRank);
}

function evaluateCandidateSafety(
  state: AtariGoState,
  player: AtariGoState['jogadorAtual'],
  level: DifficultyLevel,
  candidate: MoveScore,
  lookahead: 0 | 1 | 2,
  random: () => number,
): number {
  const simulation = simulateMove(state, candidate.move, player);
  if (simulation.isWinningCapture) {
    return 100_000;
  }

  if (lookahead === 0) {
    return candidate.baseScore;
  }

  const opponent = getOpponent(player);
  const opponentMoves =
    simulation.next.jogadasValidas.length > 0
      ? simulation.next.jogadasValidas
      : calcularJogadasValidas(simulation.next.tabuleiro, opponent);

  if (opponentMoves.length === 0) {
    return candidate.baseScore + 60;
  }

  const opponentScored =
    lookahead === 2
      ? scoreMoves(
          simulation.next,
          opponent,
          Math.min(LEVEL_POLICY[level].evalCap, 8),
        )
      : opponentMoves.map((move) => ({ move, baseScore: 0 }));
  const opponentFrontier = opponentScored.slice(0, Math.min(opponentScored.length, lookahead === 2 ? 4 : 6));

  let worstLineForUs = Number.POSITIVE_INFINITY;

  for (const opponentCandidate of opponentFrontier) {
    const opponentSimulation = simulateMove(simulation.next, opponentCandidate.move, opponent);
    if (opponentSimulation.isWinningCapture) {
      worstLineForUs = Math.min(worstLineForUs, candidate.baseScore - 900);
      continue;
    }

    if (lookahead === 1) {
      const lineScore = candidate.baseScore - opponentSimulation.capturedCount * 180;
      worstLineForUs = Math.min(worstLineForUs, lineScore);
      continue;
    }

    const ourReplyScores = scoreMoves(
      opponentSimulation.next,
      player,
      Math.min(LEVEL_POLICY[level].evalCap, 12),
    );
    const bestReply = ourReplyScores[0]?.baseScore ?? (candidate.baseScore - 120);
    const lineScore = bestReply - opponentSimulation.capturedCount * 120;
    worstLineForUs = Math.min(worstLineForUs, lineScore);
  }

  if (!Number.isFinite(worstLineForUs)) {
    return candidate.baseScore;
  }

  return worstLineForUs + random() * 0.001;
}

function chooseMove(
  state: AtariGoState,
  level: DifficultyLevel,
  random: () => number,
): Posicao | null {
  const player = state.jogadorAtual;
  const policy = LEVEL_POLICY[level];
  const scored = scoreMoves(state, player, policy.evalCap);
  if (scored.length === 0) return null;

  if (policy.safetyLookahead === 0) {
    const targetRank = rankIndexForLevel(level, scored.length, random);
    const targetScore = scored[targetRank]?.baseScore ?? scored[0].baseScore;
    const tiedCandidates = scored.filter((entry) => entry.baseScore === targetScore);
    if (tiedCandidates.length === 0) {
      return scored[targetRank]?.move ?? scored[0].move;
    }
    const index = Math.floor(random() * tiedCandidates.length);
    return tiedCandidates[index]?.move ?? tiedCandidates[0].move;
  }

  let best = scored[0];
  let bestSafetyScore = Number.NEGATIVE_INFINITY;
  const frontier = scored.slice(0, Math.min(scored.length, level >= 5 ? 8 : 6));

  for (const candidate of frontier) {
    const safetyScore = evaluateCandidateSafety(
      state,
      player,
      level,
      candidate,
      policy.safetyLookahead,
      random,
    );
    if (safetyScore > bestSafetyScore) {
      bestSafetyScore = safetyScore;
      best = candidate;
    } else if (Math.abs(safetyScore - bestSafetyScore) < 1e-9 && random() < 0.5) {
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
  const baseSeedKey = `${gameId}:${strongerLevel}:${weakerLevel}:${strongerAs}`;
  const randomJ1 = createRandom(deriveSeed(options.seed, `${baseSeedKey}:j1`));
  const randomJ2 = createRandom(deriveSeed(options.seed, `${baseSeedKey}:j2`));
  let state = criarEstadoInicial('dois-jogadores');
  const decisions: DecisionSample[] = [];
  let ply = 0;

  while (state.estado === 'a-jogar' && ply < options.maxPliesPerGame) {
    const isJogador1Turn = state.jogadorAtual === 'jogador1';
    const level =
      (isJogador1Turn && strongerAs === 'jogador1') || (!isJogador1Turn && strongerAs === 'jogador2')
        ? strongerLevel
        : weakerLevel;

    const random = isJogador1Turn ? randomJ1 : randomJ2;
    const startedAt = performance.now();
    const bestMove = chooseMove(state, level, random);
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

  let winner: 'stronger' | 'weaker' | 'draw-timeout';
  if (state.estado === 'a-jogar') {
    const strongerCaptures =
      strongerAs === 'jogador1'
        ? state.pedrasCapturadas.brancas
        : state.pedrasCapturadas.pretas;
    const weakerCaptures =
      strongerAs === 'jogador1'
        ? state.pedrasCapturadas.pretas
        : state.pedrasCapturadas.brancas;
    if (strongerCaptures > weakerCaptures) {
      winner = 'stronger';
    } else if (weakerCaptures > strongerCaptures) {
      winner = 'weaker';
    } else {
      winner = 'stronger';
    }
  } else {
    winner = winnerForPerspective(state, strongerAs);
  }

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
      t1Pass: strongerWinrate >= getLadderThreshold(strongerLevel, weakerLevel),
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
