/**
 * Arena Produto: Rust/WASM N5 contra o fallback TypeScript N5.
 * Usa aberturas emparelhadas e troca o motor que controla cada jogador.
 * Requer `bun run build` antes da execução.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeMove } from '../src/games/produto/ai/ai-client';
import { chooseFallbackMoveFromState } from '../src/games/produto/ai/fallback-engine';
import { buildIndexMaps, packState } from '../src/games/produto/ai/types';
import { criarEstadoInicial, colocarPeca } from '../src/games/produto/logic';
import type { JogadaDupla, ProdutoState } from '../src/games/produto/types';
import { gerarPosicoesValidas, posToKey } from '../src/games/produto/types';
import {
  choose_move as wasmChooseMove,
  init_ai as seedWasm,
  initSync as initWasmSync,
} from '../src/games/produto/ai/wasm/pkg/produto_ai.js';

type Side = 'wasm-n5' | 'ts-n5';
type PlayerId = 'jogador1' | 'jogador2';

interface Options {
  games: number;
  seed: number;
  budgetMs: number;
  endgameEmptyN: number;
}

interface GameRecord {
  gameId: string;
  wasmAs: PlayerId;
  winner: Side | 'draw';
  turns: number;
  illegalBy: Side | null;
  finalScore: {
    black: number;
    white: number;
    blackStones: number;
    whiteStones: number;
  };
}

const INDEX_MAPS = buildIndexMaps(gerarPosicoesValidas, posToKey);

function parseFlag(name: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1]! : null;
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function parseOptions(): Options {
  const games = positiveInt(parseFlag('games'), 20);
  if (games % 2 !== 0) throw new Error('--games tem de ser par');
  return {
    games,
    seed: positiveInt(parseFlag('seed'), 20260718) >>> 0,
    budgetMs: positiveInt(parseFlag('budget'), 100),
    endgameEmptyN: Math.max(0, Math.min(8, Math.trunc(Number(parseFlag('endgame') ?? 8)))),
  };
}

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function opening(seed: number): ProdutoState {
  const positions = INDEX_MAPS.idxToPos;
  const pos = positions[seed % positions.length]!;
  const color = (seed >>> 8) % 2 === 0 ? 'preta' : 'branca';
  return colocarPeca(criarEstadoInicial('vs-computador'), pos, color);
}

function isLegalMove(state: ProdutoState, move: JogadaDupla | null): move is JogadaDupla {
  if (!move) return false;
  if (state.tabuleiro[posToKey(move.pos1)] !== 'vazia') return false;
  if (state.primeiraJogada) return move.pos2 === null && move.cor2 === null;
  if (!move.pos2 || !move.cor2) return false;
  if (posToKey(move.pos1) === posToKey(move.pos2)) return false;
  return state.tabuleiro[posToKey(move.pos2)] === 'vazia';
}

function applyTurn(state: ProdutoState, move: JogadaDupla): ProdutoState {
  let next = colocarPeca(state, move.pos1, move.cor1);
  if (move.pos2 && move.cor2) next = colocarPeca(next, move.pos2, move.cor2);
  return next;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!.toFixed(2));
}

function wasmMove(state: ProdutoState, seed: number, options: Options): JogadaDupla | null {
  seedWasm(seed);
  const packed = packState(state, INDEX_MAPS.keyToIdx);
  const raw = wasmChooseMove(packed, {
    difficulty: 4,
    timeMs: options.budgetMs,
    candidateK: 28,
    endgameEmptyN: options.endgameEmptyN,
    seed,
  });
  return decodeMove(raw, INDEX_MAPS.idxToPos);
}

async function main(): Promise<void> {
  const options = parseOptions();
  const wasmBytes = await readFile(new URL(
    '../src/games/produto/ai/wasm/pkg/produto_ai_bg.wasm',
    import.meta.url,
  ));
  initWasmSync({ module: wasmBytes });

  const wins: Record<Side, number> = { 'wasm-n5': 0, 'ts-n5': 0 };
  const illegal: Record<Side, number> = { 'wasm-n5': 0, 'ts-n5': 0 };
  const latencies: Record<Side, number[]> = { 'wasm-n5': [], 'ts-n5': [] };
  const wasmWinsByPlayer: Record<PlayerId, number> = { jogador1: 0, jogador2: 0 };
  const wasmGamesByPlayer: Record<PlayerId, number> = { jogador1: 0, jogador2: 0 };
  const records: GameRecord[] = [];
  let draws = 0;

  for (let game = 0; game < options.games; game += 1) {
    const wasmAs: PlayerId = game % 2 === 0 ? 'jogador1' : 'jogador2';
    wasmGamesByPlayer[wasmAs] += 1;
    let state = opening(options.seed ^ fnv1a32(`opening-${Math.floor(game / 2)}`));
    let turns = 1;
    let illegalBy: Side | null = null;

    while (state.estado === 'a-jogar' && turns <= 31) {
      const side: Side = state.jogadorAtual === wasmAs ? 'wasm-n5' : 'ts-n5';
      const moveSeed = (
        options.seed ^ fnv1a32(`pair${Math.floor(game / 2)}t${turns}-${side}`)
      ) >>> 0;
      const started = performance.now();
      const move = side === 'wasm-n5'
        ? wasmMove(state, moveSeed, options)
        : chooseFallbackMoveFromState(state, 'max', moveSeed, options.budgetMs);
      latencies[side].push(performance.now() - started);

      if (!isLegalMove(state, move)) {
        illegalBy = side;
        illegal[side] += 1;
        break;
      }
      state = applyTurn(state, move);
      turns += 1;
    }

    let winner: Side | 'draw';
    if (illegalBy) {
      winner = illegalBy === 'wasm-n5' ? 'ts-n5' : 'wasm-n5';
    } else if (state.estado === 'vitoria-jogador1') {
      winner = wasmAs === 'jogador1' ? 'wasm-n5' : 'ts-n5';
    } else if (state.estado === 'vitoria-jogador2') {
      winner = wasmAs === 'jogador2' ? 'wasm-n5' : 'ts-n5';
    } else {
      winner = 'draw';
    }
    if (winner === 'draw') draws += 1;
    else {
      wins[winner] += 1;
      if (winner === 'wasm-n5') wasmWinsByPlayer[wasmAs] += 1;
    }

    records.push({
      gameId: `g${game}`,
      wasmAs,
      winner,
      turns,
      illegalBy,
      finalScore: {
        black: state.pontuacaoPretas.produto,
        white: state.pontuacaoBrancas.produto,
        blackStones: state.pontuacaoPretas.totalPecas,
        whiteStones: state.pontuacaoBrancas.totalPecas,
      },
    });
    console.log(
      `jogo ${game + 1}/${options.games}: wasm=${wasmAs} vencedor=${winner} ` +
        `score=${state.pontuacaoPretas.produto}-${state.pontuacaoBrancas.produto}`,
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    options,
    games: options.games,
    wins,
    draws,
    wasmScore: Number(((wins['wasm-n5'] + draws * 0.5) / options.games).toFixed(3)),
    wasmByPlayer: {
      jogador1: `${wasmWinsByPlayer.jogador1}/${wasmGamesByPlayer.jogador1}`,
      jogador2: `${wasmWinsByPlayer.jogador2}/${wasmGamesByPlayer.jogador2}`,
    },
    illegalMoves: illegal,
    latencyMs: {
      'wasm-n5': {
        p50: percentile(latencies['wasm-n5'], 0.5),
        p95: percentile(latencies['wasm-n5'], 0.95),
      },
      'ts-n5': {
        p50: percentile(latencies['ts-n5'], 0.5),
        p95: percentile(latencies['ts-n5'], 0.95),
      },
    },
    records,
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'artifacts', 'produto-arena', stamp);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log('\n=== Arena Produto — WASM N5 vs TS N5 ===');
  console.log(`score WASM=${summary.wasmScore} vitórias=${wins['wasm-n5']}-${wins['ts-n5']} empates=${draws}`);
  console.log(`WASM por jogador: J1=${summary.wasmByPlayer.jogador1} J2=${summary.wasmByPlayer.jogador2}`);
  console.log(`ilegais WASM=${illegal['wasm-n5']} TS=${illegal['ts-n5']}`);
  console.log(`p95 WASM=${summary.latencyMs['wasm-n5'].p95}ms TS=${summary.latencyMs['ts-n5'].p95}ms`);
  console.log(`resultados: ${join(outDir, 'results.json')}`);

  if (illegal['wasm-n5'] + illegal['ts-n5'] > 0) process.exitCode = 1;
}

await main();
