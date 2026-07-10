import type { AIRequestV1, DifficultyLevel, GameId } from '../src/ai-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readOptionalArg } from './ai-benchmark-cli';
import { DIFFICULTY_PROFILES } from '../src/ai-core';
import type { GameStatus, Player } from '../src/types';
import { GatosCaesV1Adapter } from '../src/games/gatos-caes/ai';
import { criarEstadoInicial as criarGatos, isJogadaValida as isGatosLegal, colocarPeca as jogarGatos } from '../src/games/gatos-caes/logic';
import { DominorioV1Adapter } from '../src/games/dominorio/ai';
import { criarEstadoInicial as criarDominorio, colocarDomino as jogarDominorio } from '../src/games/dominorio/logic';
import { QuelhasV1Adapter } from '../src/games/quelhas/ai';
import { criarEstadoInicial as criarQuelhas, colocarSegmento as jogarQuelhas, recusarTroca } from '../src/games/quelhas/logic';
import { ProdutoV1Adapter } from '../src/games/produto/ai/v1-adapter';
import { criarEstadoInicial as criarProduto, colocarPeca as jogarProduto } from '../src/games/produto/logic';
import { posToKey as produtoKey } from '../src/games/produto/types';
import { AtariGoV1Adapter } from '../src/games/atari-go/ai/v1-adapter';
import { criarEstadoInicial as criarAtari, isJogadaValida as isAtariLegal, colocarPedra as jogarAtari } from '../src/games/atari-go/logic';
import { NexV1Adapter } from '../src/games/nex/ai/v1-adapter';
import { criarEstadoInicial as criarNex, executarColocacao, executarSubstituicao, executarSwap, recusarSwap } from '../src/games/nex/logic';
import { isValidAiAction, type NexAiAction } from '../src/games/nex/ai/types';

const LEVEL_PAIRS: Array<[DifficultyLevel, DifficultyLevel]> = [[2, 1], [3, 2], [4, 3], [5, 4]];
const GAME_IDS: GameId[] = ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex'];

type Winner = 'stronger' | 'weaker' | 'draw';

export interface LadderGameDigest {
  winner: Winner;
  illegalMoves: number;
  plies?: number;
  strongerAs?: Player;
}

export interface PairSummary {
  strongerLevel: DifficultyLevel;
  weakerLevel: DifficultyLevel;
  games: number;
  strongerWins: number;
  weakerWins: number;
  draws: number;
  illegalMoves: number;
  score: number;
  threshold: number;
  monotonic: boolean;
  pass: boolean;
}

const CLASSIC = new Set<GameId>(['gatos-caes', 'dominorio', 'quelhas']);

export function getPairThreshold(
  gameId: GameId,
  stronger: DifficultyLevel,
  weaker: DifficultyLevel,
): number {
  const step = `${stronger}>${weaker}`;
  if (CLASSIC.has(gameId)) {
    return ({ '2>1': 0.6, '3>2': 0.58, '4>3': 0.56, '5>4': 0.54 } as Record<string, number>)[step] ?? 0.6;
  }
  return ({ '2>1': 0.62, '3>2': 0.6, '4>3': 0.57, '5>4': 0.55 } as Record<string, number>)[step] ?? 0.6;
}

export function summarizePair(
  gameId: GameId,
  strongerLevel: DifficultyLevel,
  weakerLevel: DifficultyLevel,
  games: LadderGameDigest[],
): PairSummary {
  const strongerWins = games.filter((game) => game.winner === 'stronger').length;
  const weakerWins = games.filter((game) => game.winner === 'weaker').length;
  const draws = games.length - strongerWins - weakerWins;
  const illegalMoves = games.reduce((total, game) => total + game.illegalMoves, 0);
  const score = games.length === 0 ? 0 : Number(((strongerWins + draws * 0.5) / games.length).toFixed(3));
  const threshold = getPairThreshold(gameId, strongerLevel, weakerLevel);
  const monotonic = score >= threshold;
  return {
    strongerLevel,
    weakerLevel,
    games: games.length,
    strongerWins,
    weakerWins,
    draws,
    illegalMoves,
    score,
    threshold,
    monotonic,
    pass: monotonic && illegalMoves === 0,
  };
}

interface Runner {
  gameId: GameId;
  initial(): any;
  normalize(state: any): any;
  compute(state: any, level: DifficultyLevel, budgetMs: number, seed: number): Promise<any>;
  apply(state: any, move: any): { state: any; legal: boolean };
  terminate(): void;
}

function sameGrid(a: { linha: number; coluna: number }, b: { linha: number; coluna: number }): boolean {
  return a.linha === b.linha && a.coluna === b.coluna;
}

function createRunners(): Runner[] {
  const gatos = new GatosCaesV1Adapter();
  const dominorio = new DominorioV1Adapter();
  const quelhas = new QuelhasV1Adapter();
  const produto = new ProdutoV1Adapter();
  const atari = new AtariGoV1Adapter();
  const nex = new NexV1Adapter();
  const compute = (adapter: { compute(request: any): Promise<any> }, gameId: GameId) =>
    (state: any, level: DifficultyLevel, budgetMs: number, seed: number) => adapter.compute({
      version: '1.0',
      requestId: `ladder-${gameId}-${level}-${seed}`,
      gameId,
      mode: 'competitive',
      level,
      state,
      timeBudgetMs: budgetMs,
      seed,
      locale: 'pt-PT',
    } satisfies AIRequestV1<any, any>);

  return [
    {
      gameId: 'gatos-caes',
      initial: () => criarGatos('vs-computador'),
      normalize: (state) => state,
      compute: compute(gatos, 'gatos-caes'),
      apply(state, move) {
        const legal = !!move && isGatosLegal(state, move);
        return { state: legal ? jogarGatos(state, move) : state, legal };
      },
      terminate: () => gatos.terminate(),
    },
    {
      gameId: 'dominorio',
      initial: () => criarDominorio('vs-computador'),
      normalize: (state) => state,
      compute: compute(dominorio, 'dominorio'),
      apply(state, move) {
        const legal = !!move && state.jogadasValidas.some((candidate: any) =>
          (sameGrid(candidate.pos1, move.pos1) && sameGrid(candidate.pos2, move.pos2)) ||
          (sameGrid(candidate.pos1, move.pos2) && sameGrid(candidate.pos2, move.pos1))
        );
        return { state: legal ? jogarDominorio(state, move) : state, legal };
      },
      terminate: () => dominorio.terminate(),
    },
    {
      gameId: 'quelhas',
      initial: () => criarQuelhas('vs-computador'),
      normalize: (state) => state.trocaDisponivel ? recusarTroca(state) : state,
      compute: compute(quelhas, 'quelhas'),
      apply(state, move) {
        const legal = !!move && state.jogadasValidas.some((candidate: any) =>
          sameGrid(candidate.inicio, move.inicio) &&
          candidate.orientacao === move.orientacao &&
          candidate.comprimento === move.comprimento
        );
        return { state: legal ? jogarQuelhas(state, move) : state, legal };
      },
      terminate: () => quelhas.terminate(),
    },
    {
      gameId: 'produto',
      initial: () => criarProduto('vs-computador'),
      normalize: (state) => state,
      compute: compute(produto, 'produto'),
      apply(state, move) {
        const firstLegal = !!move && state.tabuleiro[produtoKey(move.pos1)] === 'vazia';
        const secondLegal = state.primeiraJogada
          ? move?.pos2 === null
          : !!move?.pos2 && produtoKey(move.pos1) !== produtoKey(move.pos2) && state.tabuleiro[produtoKey(move.pos2)] === 'vazia';
        const legal = firstLegal && secondLegal;
        if (!legal) return { state, legal: false };
        let next = jogarProduto(state, move.pos1, move.cor1);
        if (move.pos2 && move.cor2) next = jogarProduto(next, move.pos2, move.cor2);
        return { state: next, legal: true };
      },
      terminate: () => produto.terminate(),
    },
    {
      gameId: 'atari-go',
      initial: () => criarAtari('vs-computador'),
      normalize: (state) => state,
      compute: compute(atari, 'atari-go'),
      apply(state, move) {
        const legal = !!move && isAtariLegal(state, move);
        return { state: legal ? jogarAtari(state, move) : state, legal };
      },
      terminate: () => atari.terminate(),
    },
    {
      gameId: 'nex',
      initial: () => criarNex('vs-computador'),
      normalize: (state) => state,
      compute: compute(nex, 'nex'),
      apply(state, move: NexAiAction | null) {
        const legal = isValidAiAction(state, move);
        if (!legal || !move) return { state, legal: false };
        if (move.type === 'swap') return { state: executarSwap(state), legal: true };
        if (move.type === 'recusar_swap') return { state: recusarSwap(state), legal: true };
        if (move.type === 'colocar') {
          return { state: executarColocacao(state, { tipo: 'colocacao', posPropria: move.own, posNeutra: move.neutral }), legal: true };
        }
        return {
          state: executarSubstituicao(state, {
            tipo: 'substituicao',
            neutrasParaProprias: [move.n1, move.n2],
            propriaParaNeutra: move.sacrifice,
          }),
          legal: true,
        };
      },
      terminate: () => nex.terminate(),
    },
  ];
}

function winnerPlayer(status: GameStatus): Player | null {
  if (status === 'vitoria-jogador1') return 'jogador1';
  if (status === 'vitoria-jogador2') return 'jogador2';
  return null;
}

async function playGame(
  runner: Runner,
  strongerLevel: DifficultyLevel,
  weakerLevel: DifficultyLevel,
  strongerAs: Player,
  maxPlies: number,
  budgetScale: number,
  baseSeed: number,
): Promise<LadderGameDigest> {
  let state = runner.initial();
  let illegalMoves = 0;
  let plies = 0;
  while (state.estado === 'a-jogar' && plies < maxPlies) {
    state = runner.normalize(state);
    const currentIsStronger = state.jogadorAtual === strongerAs;
    const level = currentIsStronger ? strongerLevel : weakerLevel;
    const budgetMs = Math.max(1, Math.round(DIFFICULTY_PROFILES[level].timeBudgetMs * budgetScale));
    const response = await runner.compute(state, level, budgetMs, baseSeed + plies * 17 + level);
    const applied = runner.apply(state, response.bestMove);
    if (!applied.legal) {
      illegalMoves += 1;
      break;
    }
    state = applied.state;
    plies += 1;
  }
  const winner = winnerPlayer(state.estado);
  return {
    winner: winner === null ? 'draw' : winner === strongerAs ? 'stronger' : 'weaker',
    illegalMoves,
    plies,
    strongerAs,
  };
}

function parseProfile(): 'smoke' | 'classroom' {
  const index = process.argv.indexOf('--profile');
  return process.argv[index + 1] === 'classroom' ? 'classroom' : 'smoke';
}

function numericArg(flag: string): number | null {
  const index = process.argv.indexOf(flag);
  const value = Number(process.argv[index + 1]);
  return index >= 0 && Number.isFinite(value) && value > 0 ? value : null;
}

export async function runLadder(profile = parseProfile()) {
  const gameArgIndex = process.argv.indexOf('--game');
  const requestedGame = process.argv[gameArgIndex + 1] as GameId | undefined;
  const defaults = profile === 'classroom'
    ? { gamesPerMirror: 1, maxPlies: 80, budgetScale: 0.1 }
    : { gamesPerMirror: 1, maxPlies: 64, budgetScale: 0.02 };
  const options = {
    gamesPerMirror: Math.trunc(numericArg('--games-per-mirror') ?? defaults.gamesPerMirror),
    maxPlies: Math.trunc(numericArg('--max-plies') ?? defaults.maxPlies),
    budgetScale: numericArg('--budget-scale') ?? defaults.budgetScale,
  };
  const allRunners = createRunners();
  const runners = GAME_IDS.includes(requestedGame as GameId)
    ? allRunners.filter((runner) => runner.gameId === requestedGame)
    : allRunners;
  const games: Record<string, { pairs: PairSummary[]; monotonicPairs: number; allPairsMonotonic: boolean }> = {};
  const details: Array<LadderGameDigest & { gameId: GameId; strongerLevel: DifficultyLevel; weakerLevel: DifficultyLevel }> = [];

  try {
    for (const runner of runners) {
      const pairs: PairSummary[] = [];
      for (const [stronger, weaker] of LEVEL_PAIRS) {
        const pairGames: LadderGameDigest[] = [];
        for (let sample = 0; sample < options.gamesPerMirror; sample += 1) {
          for (const strongerAs of ['jogador1', 'jogador2'] as Player[]) {
            const game = await playGame(
              runner,
              stronger,
              weaker,
              strongerAs,
              options.maxPlies,
              options.budgetScale,
              20260710 + sample * 1000 + stronger * 100 + (strongerAs === 'jogador1' ? 1 : 2),
            );
            pairGames.push(game);
            details.push({ ...game, gameId: runner.gameId, strongerLevel: stronger, weakerLevel: weaker });
          }
        }
        pairs.push(summarizePair(runner.gameId, stronger, weaker, pairGames));
      }
      const monotonicPairs = pairs.filter((pair) => pair.monotonic).length;
      games[runner.gameId] = {
        pairs,
        monotonicPairs,
        allPairsMonotonic: monotonicPairs === pairs.length,
      };
    }
  } finally {
    for (const runner of allRunners) runner.terminate();
  }

  const illegalMoves = details.reduce((total, game) => total + game.illegalMoves, 0);
  const failedPairs = GAME_IDS.flatMap((gameId) =>
    (games[gameId]?.pairs ?? []).filter((pair) => !pair.pass).map((pair) => `${gameId}:N${pair.strongerLevel}>N${pair.weakerLevel}`)
  );
  return {
    generatedAt: new Date().toISOString(),
    profile,
    options,
    requestedGame: requestedGame && GAME_IDS.includes(requestedGame) ? requestedGame : null,
    games,
    totals: { games: details.length, illegalMoves },
    pass: illegalMoves === 0 && failedPairs.length === 0,
    failedPairs,
    details,
  };
}

if (import.meta.main) {
  runLadder()
    .then(async (result) => {
      const output = readOptionalArg(process.argv, '--output');
      if (output) {
        const path = resolve(process.cwd(), output);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
      }
      console.log(JSON.stringify(result, null, 2));
      // A non-monotonic ladder is a calibration result, not a harness crash.
      if (result.totals.illegalMoves > 0) process.exitCode = 1;
    })
    .catch((error) => {
      console.error('[ai-ladder] fatal', error);
      process.exitCode = 1;
    });
}
