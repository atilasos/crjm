import type { AIRequestV1, DifficultyLevel, GameId } from '../src/ai-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readOptionalArg } from './ai-benchmark-cli';
import { DIFFICULTY_PROFILES } from '../src/ai-core';
import { GatosCaesV1Adapter } from '../src/games/gatos-caes/ai';
import { isJogadaValida as isGatosMoveLegal, criarEstadoInicial as criarGatos } from '../src/games/gatos-caes/logic';
import { DominorioV1Adapter } from '../src/games/dominorio/ai';
import { criarEstadoInicial as criarDominorio } from '../src/games/dominorio/logic';
import { QuelhasV1Adapter } from '../src/games/quelhas/ai';
import { criarEstadoInicial as criarQuelhas } from '../src/games/quelhas/logic';
import { ProdutoV1Adapter } from '../src/games/produto/ai/v1-adapter';
import { criarEstadoInicial as criarProduto } from '../src/games/produto/logic';
import { posToKey as produtoPosToKey } from '../src/games/produto/types';
import { AtariGoV1Adapter } from '../src/games/atari-go/ai/v1-adapter';
import { criarEstadoInicial as criarAtari, isJogadaValida as isAtariMoveLegal } from '../src/games/atari-go/logic';
import { NexV1Adapter } from '../src/games/nex/ai/v1-adapter';
import { criarEstadoInicial as criarNex } from '../src/games/nex/logic';
import { isValidAiAction } from '../src/games/nex/ai/types';

const LEVELS: DifficultyLevel[] = [1, 2, 3, 4, 5];

interface Probe {
  gameId: GameId;
  run(level: DifficultyLevel, seed: number): Promise<{
    elapsedMs: number;
    reportedMs: number;
    legal: boolean;
    engine: string;
  }>;
  terminate(): void;
}

export interface LevelLatencySummary {
  budgetMs: number;
  p50Ms: number;
  p95Ms: number;
  illegalMoves: number;
  limitMs: number;
  pass: boolean;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return Number(sorted[index].toFixed(2));
}

export function summarizeLevel(
  budgetMs: number,
  samples: number[],
  illegalMoves: number,
): LevelLatencySummary {
  const p50Ms = percentile(samples, 0.5);
  const p95Ms = percentile(samples, 0.95);
  const limitMs = budgetMs * 2 + 100;
  return {
    budgetMs,
    p50Ms,
    p95Ms,
    illegalMoves,
    limitMs,
    pass: illegalMoves === 0 && p95Ms <= limitMs,
  };
}

function request<State>(gameId: GameId, state: State, level: DifficultyLevel, seed: number): AIRequestV1<State, any> {
  return {
    version: '1.0',
    requestId: `latency-${gameId}-n${level}-${seed}`,
    gameId,
    mode: 'competitive',
    level,
    state,
    timeBudgetMs: DIFFICULTY_PROFILES[level].timeBudgetMs,
    seed,
    locale: 'pt-PT',
  };
}

function sameGridPos(a: { linha: number; coluna: number }, b: { linha: number; coluna: number }): boolean {
  return a.linha === b.linha && a.coluna === b.coluna;
}

function createProbes(): Probe[] {
  const gatos = new GatosCaesV1Adapter();
  const dominorio = new DominorioV1Adapter();
  const quelhas = new QuelhasV1Adapter();
  const produto = new ProdutoV1Adapter();
  const atari = new AtariGoV1Adapter();
  const nex = new NexV1Adapter();

  return [
    {
      gameId: 'gatos-caes',
      async run(level, seed) {
        const state = criarGatos('vs-computador');
        const started = performance.now();
        const response = await gatos.compute(request('gatos-caes', state, level, seed));
        return {
          elapsedMs: performance.now() - started,
          reportedMs: response.stats.elapsedMs,
          legal: response.bestMove !== null && isGatosMoveLegal(state, response.bestMove),
          engine: response.stats.engine,
        };
      },
      terminate: () => gatos.terminate(),
    },
    {
      gameId: 'dominorio',
      async run(level, seed) {
        const state = criarDominorio('vs-computador');
        const started = performance.now();
        const response = await dominorio.compute(request('dominorio', state, level, seed));
        const legal = response.bestMove !== null && state.jogadasValidas.some((move) =>
          (sameGridPos(move.pos1, response.bestMove!.pos1) && sameGridPos(move.pos2, response.bestMove!.pos2)) ||
          (sameGridPos(move.pos1, response.bestMove!.pos2) && sameGridPos(move.pos2, response.bestMove!.pos1))
        );
        return {
          elapsedMs: performance.now() - started,
          reportedMs: response.stats.elapsedMs,
          legal,
          engine: response.stats.engine,
        };
      },
      terminate: () => dominorio.terminate(),
    },
    {
      gameId: 'quelhas',
      async run(level, seed) {
        const state = criarQuelhas('vs-computador');
        const started = performance.now();
        const response = await quelhas.compute(request('quelhas', state, level, seed));
        const legal = response.bestMove !== null && state.jogadasValidas.some((move) =>
          sameGridPos(move.inicio, response.bestMove!.inicio) &&
          move.orientacao === response.bestMove!.orientacao &&
          move.comprimento === response.bestMove!.comprimento
        );
        return {
          elapsedMs: performance.now() - started,
          reportedMs: response.stats.elapsedMs,
          legal,
          engine: response.stats.engine,
        };
      },
      terminate: () => quelhas.terminate(),
    },
    {
      gameId: 'produto',
      async run(level, seed) {
        const state = criarProduto('vs-computador');
        const started = performance.now();
        const response = await produto.compute(request('produto', state, level, seed));
        const move = response.bestMove;
        const legal = move !== null &&
          state.tabuleiro[produtoPosToKey(move.pos1)] === 'vazia' &&
          move.pos2 === null;
        return {
          elapsedMs: performance.now() - started,
          reportedMs: response.stats.elapsedMs,
          legal,
          engine: response.stats.engine,
        };
      },
      terminate: () => produto.terminate(),
    },
    {
      gameId: 'atari-go',
      async run(level, seed) {
        const state = criarAtari('vs-computador');
        const started = performance.now();
        const response = await atari.compute(request('atari-go', state, level, seed));
        return {
          elapsedMs: performance.now() - started,
          reportedMs: response.stats.elapsedMs,
          legal: response.bestMove !== null && isAtariMoveLegal(state, response.bestMove),
          engine: response.stats.engine,
        };
      },
      terminate: () => atari.terminate(),
    },
    {
      gameId: 'nex',
      async run(level, seed) {
        const state = criarNex('vs-computador');
        const started = performance.now();
        const response = await nex.compute(request('nex', state, level, seed));
        return {
          elapsedMs: performance.now() - started,
          reportedMs: response.stats.elapsedMs,
          legal: isValidAiAction(state, response.bestMove),
          engine: response.stats.engine,
        };
      },
      terminate: () => nex.terminate(),
    },
  ];
}

function parseProfile(): 'smoke' | 'classroom' {
  const index = process.argv.indexOf('--profile');
  return process.argv[index + 1] === 'classroom' ? 'classroom' : 'smoke';
}

export async function runLatencyHarness(profile = parseProfile()) {
  const samplesPerLevel = profile === 'classroom' ? 3 : 1;
  const probes = createProbes();
  const games: Record<string, Record<string, LevelLatencySummary & { engines: string[] }>> = {};

  try {
    for (const probe of probes) {
      games[probe.gameId] = {};
      for (const level of LEVELS) {
        const samples: number[] = [];
        let illegalMoves = 0;
        const engines = new Set<string>();
        for (let sample = 0; sample < samplesPerLevel; sample += 1) {
          const result = await probe.run(level, 20260710 + level * 100 + sample);
          samples.push(result.elapsedMs);
          if (!result.legal) illegalMoves += 1;
          engines.add(result.engine);
        }
        games[probe.gameId][`N${level}`] = {
          ...summarizeLevel(DIFFICULTY_PROFILES[level].timeBudgetMs, samples, illegalMoves),
          engines: [...engines],
        };
      }
    }
  } finally {
    for (const probe of probes) probe.terminate();
  }

  const failed = Object.entries(games).flatMap(([gameId, levels]) =>
    Object.entries(levels)
      .filter(([, summary]) => !summary.pass)
      .map(([level]) => `${gameId}:${level}`)
  );
  return {
    generatedAt: new Date().toISOString(),
    profile,
    samplesPerLevel,
    gate: '0 jogadas ilegais; p95 <= 2 × budget + 100 ms',
    pass: failed.length === 0,
    failed,
    games,
  };
}

if (import.meta.main) {
  runLatencyHarness()
    .then(async (result) => {
      const output = readOptionalArg(process.argv, '--output');
      if (output) {
        const path = resolve(process.cwd(), output);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
      }
      console.log(JSON.stringify(result, null, 2));
      if (!result.pass) process.exitCode = 1;
    })
    .catch((error) => {
      console.error('[ai-latency] fatal', error);
      process.exitCode = 1;
    });
}
