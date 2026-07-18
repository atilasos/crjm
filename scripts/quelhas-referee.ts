/**
 * Árbitro exato do Quelhas: mede a qualidade real dos motores (WASM e TS
 * fallback, por nível) contra o solver de finais.
 *
 * Joga partidas motor-vs-motor; em cada posição com poucas jogadas legais,
 * resolve o final por busca completa e classifica a jogada escolhida:
 * - blunder: a posição era teoricamente ganha e a jogada entrega-a;
 * - ótima: preserva o resultado teórico.
 * Regista também o histograma de comprimentos de segmento escolhidos.
 *
 * Uso: bun scripts/quelhas-referee.ts [--games 30] [--levels 3,5]
 *        [--engine wasm|ts] [--solve-moves 14] [--seed 20260718]
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as quelhas from '../src/games/quelhas/logic';
import type { QuelhasState, Segmento } from '../src/games/quelhas/types';
import { searchBestMove, applyDifficultySelection, trySolveEndgameMove } from '../src/games/quelhas/ai/engine';
import { DIFFICULTY_PRESETS } from '../src/games/quelhas/ai/types';
import { mapLevelToQuelhasDifficulty } from '../src/games/quelhas/ai/v1-adapter';
import type { DifficultyLevel } from '../src/ai-core/types';

// ---------- solver exato (mesma lógica de scripts/extract-lessons.ts) ----------

type Status = 'a-jogar' | 'vitoria-jogador1' | 'vitoria-jogador2' | 'empate';

function moves(state: QuelhasState): Segmento[] {
  return quelhas.calcularJogadasValidas(
    state.tabuleiro,
    quelhas.getOrientacaoJogador(state, state.jogadorAtual),
  );
}

function stateKey(state: QuelhasState): string {
  return (
    state.tabuleiro.map((row) => row.map((c) => (c === 'vazia' ? '.' : '#')).join('')).join('|') +
    `:${state.jogadorAtual}:${quelhas.getOrientacaoJogador(state, state.jogadorAtual)}`
  );
}

class SolveBudgetExceeded extends Error {}

function solve(state: QuelhasState, memo: Map<string, boolean>, budget: { nodes: number }): boolean {
  const key = stateKey(state);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  if ((budget.nodes += 1) > 3_000_000) throw new SolveBudgetExceeded();
  const mover = state.jogadorAtual;
  let result = false;
  for (const move of moves(state)) {
    const next = quelhas.colocarSegmento(state, move);
    const status = next.estado as Status;
    const moverWins =
      status === 'a-jogar'
        ? !solve(next, memo, budget)
        : status === (mover === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2');
    if (moverWins) {
      result = true;
      break;
    }
  }
  memo.set(key, result);
  return result;
}

/** Para cada jogada legal, o mover vence após ela? (null se orçamento estourar) */
function solveMoves(state: QuelhasState, legal: Segmento[]): boolean[] | null {
  const memo = new Map<string, boolean>();
  const budget = { nodes: 0 };
  try {
    const mover = state.jogadorAtual;
    return legal.map((move) => {
      const next = quelhas.colocarSegmento(state, move);
      const status = next.estado as Status;
      return status === 'a-jogar'
        ? !solve(next, memo, budget)
        : status === (mover === 'jogador1' ? 'vitoria-jogador1' : 'vitoria-jogador2');
    });
  } catch (error) {
    if (error instanceof SolveBudgetExceeded) return null;
    throw error;
  }
}

// ---------- motores ----------

interface WasmSearchResult {
  best_move: number;
  depth_reached: number;
  score: number;
}

interface WasmEngineInstance {
  search(
    lowLo: number, lowHi: number, highLo: number, highHi: number,
    side: number, timeBudgetMs: number, maxDepth: number, topN: number, scoreDelta: number,
  ): WasmSearchResult;
  clear_tt(): void;
}

let wasmEngine: WasmEngineInstance | null = null;

async function initWasm(): Promise<void> {
  const pkg = await import('../src/games/quelhas/ai/wasm/pkg/quelhas_wasm.js');
  const bytes = await readFile(new URL('../src/games/quelhas/ai/wasm/pkg/quelhas_wasm_bg.wasm', import.meta.url));
  pkg.initSync({ module: bytes });
  pkg.init();
  wasmEngine = new pkg.QuelhasEngine(18) as unknown as WasmEngineInstance;
}

function boardToU64Parts(tabuleiro: QuelhasState['tabuleiro']) {
  let low = 0n;
  let high = 0n;
  for (let r = 0; r < 10; r += 1) {
    for (let c = 0; c < 10; c += 1) {
      if (tabuleiro[r]?.[c] === 'ocupada') {
        const idx = r * 10 + c;
        if (idx < 64) low |= 1n << BigInt(idx);
        else high |= 1n << BigInt(idx - 64);
      }
    }
  }
  return {
    lowLo: Number(low & 0xffffffffn) >>> 0,
    lowHi: Number((low >> 32n) & 0xffffffffn) >>> 0,
    highLo: Number(high & 0xffffffffn) >>> 0,
    highHi: Number((high >> 32n) & 0xffffffffn) >>> 0,
  };
}

function decodeMove(move: number): Segmento {
  const start = move & 0x7f;
  return {
    inicio: { linha: Math.floor(start / 10), coluna: start % 10 },
    comprimento: (move >> 7) & 0x0f,
    orientacao: ((move >> 11) & 1) === 0 ? 'vertical' : 'horizontal',
  };
}

function engineMove(
  state: QuelhasState,
  level: DifficultyLevel,
  kind: 'wasm' | 'ts',
): { move: Segmento | null; engine: string } {
  const preset = DIFFICULTY_PRESETS[mapLevelToQuelhasDifficulty(level)];
  const orientacao = quelhas.getOrientacaoJogador(state, state.jogadorAtual);

  // Mesmo caminho do worker de produção: níveis fortes resolvem finais.
  if (level >= 4) {
    const solved = trySolveEndgameMove(state.tabuleiro, orientacao);
    if (solved) return { move: solved, engine: 'exact-endgame' };
  }

  if (kind === 'wasm' && wasmEngine) {
    const { lowLo, lowHi, highLo, highHi } = boardToU64Parts(state.tabuleiro);
    const side = orientacao === 'vertical' ? 0 : 1;
    const r = wasmEngine.search(
      lowLo, lowHi, highLo, highHi, side,
      preset.timeBudgetMs, preset.maxDepth, preset.topN, preset.scoreDelta,
    );
    const best = r.best_move >= 0 ? decodeMove(r.best_move) : null;
    return {
      move: applyDifficultySelection(state.tabuleiro, orientacao, best, preset.selectionQuantile ?? 0),
      engine: 'rust-wasm',
    };
  }

  const result = searchBestMove(state.tabuleiro, orientacao, {
    timeBudgetMs: preset.timeBudgetMs,
    maxDepth: preset.maxDepth,
    topN: preset.topN,
    scoreDelta: preset.scoreDelta,
    selectionQuantile: preset.selectionQuantile,
  });
  return { move: result.bestMove, engine: 'ts-fallback' };
}

// ---------- árbitro ----------

function parseFlag(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1]! : fallback;
}

interface LevelStats {
  level: DifficultyLevel;
  engine: string;
  chosenLengths: Record<number, number>;
  judged: number;
  optimal: number;
  blunders: number;
  blunderExamples: Array<{ game: number; ply: number; move: string; winningExisted: number }>;
  wins: number;
  games: number;
}

async function main(): Promise<void> {
  const games = Number(parseFlag('games', '30'));
  const [levelA, levelB] = parseFlag('levels', '3,5').split(',').map(Number) as [DifficultyLevel, DifficultyLevel];
  const engineKind = parseFlag('engine', 'wasm') as 'wasm' | 'ts';
  const solveThreshold = Number(parseFlag('solve-moves', '14'));

  if (engineKind === 'wasm') {
    try {
      await initWasm();
      console.log('motor WASM carregado');
    } catch (error) {
      console.error('falha a carregar WASM; a usar TS fallback:', (error as Error).message);
    }
  }

  const mkStats = (level: DifficultyLevel): LevelStats => ({
    level,
    engine: engineKind === 'wasm' && wasmEngine ? 'rust-wasm' : 'ts-fallback',
    chosenLengths: {},
    judged: 0,
    optimal: 0,
    blunders: 0,
    blunderExamples: [],
    wins: 0,
    games,
  });
  const stats: [LevelStats, LevelStats] = [mkStats(levelA), mkStats(levelB)];

  for (let g = 0; g < games; g += 1) {
    // alternar quem começa
    const first = g % 2;
    let state = quelhas.criarEstadoInicial('vs-computador');
    let ply = 0;

    while (state.estado === 'a-jogar' && ply < 120) {
      const legal = moves(state);
      if (legal.length === 0) break;
      const moverIdx = (ply + first) % 2;
      const moverStats = stats[moverIdx]!;

      const { move } = engineMove(state, moverStats.level, engineKind);
      if (!move) break;

      moverStats.chosenLengths[move.comprimento] = (moverStats.chosenLengths[move.comprimento] ?? 0) + 1;

      if (legal.length <= solveThreshold) {
        const verdicts = solveMoves(state, legal);
        if (verdicts) {
          const winningExisted = verdicts.filter(Boolean).length;
          if (winningExisted > 0) {
            moverStats.judged += 1;
            const chosenIdx = legal.findIndex(
              (m) =>
                m.inicio.linha === move.inicio.linha &&
                m.inicio.coluna === move.inicio.coluna &&
                m.comprimento === move.comprimento &&
                m.orientacao === move.orientacao,
            );
            if (chosenIdx >= 0 && verdicts[chosenIdx]) {
              moverStats.optimal += 1;
            } else {
              moverStats.blunders += 1;
              if (moverStats.blunderExamples.length < 5) {
                moverStats.blunderExamples.push({
                  game: g,
                  ply,
                  move: `(${move.inicio.linha},${move.inicio.coluna}) len${move.comprimento} ${move.orientacao}`,
                  winningExisted,
                });
              }
            }
          }
        }
      }

      state = quelhas.colocarSegmento(state, move);
      ply += 1;
    }

    if (state.estado !== 'a-jogar') {
      // No loop, o mover do ply p é stats[(p + first) % 2]; o jogador1 do
      // estado joga os plies pares, logo o seu índice de stats é `first`.
      const winnerIdx = state.estado === 'vitoria-jogador1' ? first : 1 - first;
      stats[winnerIdx]!.wins += 1;
    }
    console.log(`jogo ${g + 1}/${games}: estado=${state.estado} plies=${ply}`);
  }

  const summary = stats.map((s) => ({
    level: s.level,
    engine: s.engine,
    wins: s.wins,
    games: s.games,
    judgedEndgames: s.judged,
    optimal: s.optimal,
    blunders: s.blunders,
    blunderRate: s.judged > 0 ? Number((s.blunders / s.judged).toFixed(3)) : null,
    chosenLengths: s.chosenLengths,
    blunderExamples: s.blunderExamples,
  }));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'artifacts', 'quelhas-referee', stamp);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'results.json'), `${JSON.stringify({ games, levels: [levelA, levelB], engineKind, summary }, null, 2)}\n`);

  console.log('\n=== Árbitro Quelhas ===');
  for (const s of summary) {
    console.log(
      `N${s.level} (${s.engine}): vitórias ${s.wins}/${s.games} · finais julgados ${s.judgedEndgames} · ` +
        `ótimas ${s.optimal} · blunders ${s.blunders} (${s.blunderRate === null ? '—' : `${(s.blunderRate * 100).toFixed(1)}%`}) · ` +
        `comprimentos ${JSON.stringify(s.chosenLengths)}`,
    );
  }
  console.log(`resultados: ${join(outDir, 'results.json')}`);
}

await main();
