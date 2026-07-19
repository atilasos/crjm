/**
 * Arena Dominório: N5 («hardPlus») vs N4 («hard»), ambos no motor Rust/WASM de
 * produção, com aberturas aleatórias emparelhadas (mesma abertura, papéis
 * trocados). Objetivo: evidência estatística de N5>N4 com seed registada.
 *
 * Uso: bun scripts/dominorio-arena.ts [--games 60] [--seed 20260719]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  calcularJogadasValidas,
  colocarDomino,
  criarEstadoInicial,
  isJogadaValida,
} from '../src/games/dominorio/logic';
import type { Domino, DominorioState } from '../src/games/dominorio/types';
import { DIFFICULTY_PRESETS, type AIDifficulty } from '../src/games/dominorio/ai/types';
import { anchorToDomino } from '../src/games/dominorio/ai/bitboard';

type SideLabel = 'n5' | 'n4';

const LEVEL_DIFFICULTY: Record<SideLabel, AIDifficulty> = { n5: 'hardPlus', n4: 'hard' };

interface WasmEngineInstance {
  search(
    occupiedLow: number, occupiedHigh: number, side: number,
    timeBudgetMs: number, maxDepth: number, topN: number, scoreDelta: number,
  ): { best_move: number };
  clear_tt(): void;
}

let wasmEngine: WasmEngineInstance | null = null;

async function initWasm(): Promise<void> {
  const pkg = await import('../src/games/dominorio/ai/wasm/pkg/dominorio_ai.js');
  const bytes = await readFile(new URL('../src/games/dominorio/ai/wasm/pkg/dominorio_ai_bg.wasm', import.meta.url));
  await pkg.default({ module_or_path: bytes });
  wasmEngine = new pkg.DominorioEngine(18) as unknown as WasmEngineInstance;
}

function occupiedBits(state: DominorioState): { low: number; high: number } {
  let low = 0;
  let high = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if (state.tabuleiro[r]![c] !== 'vazia') {
        const idx = r * 8 + c;
        if (idx < 32) low |= 1 << idx;
        else high |= 1 << (idx - 32);
      }
    }
  }
  return { low: low >>> 0, high: high >>> 0 };
}

function engineMove(state: DominorioState, label: SideLabel): Domino | null {
  if (!wasmEngine) throw new Error('WASM não inicializado');
  const preset = DIFFICULTY_PRESETS[LEVEL_DIFFICULTY[label]];
  const side = state.jogadorAtual === 'jogador1' ? 0 : 1;
  const { low, high } = occupiedBits(state);
  const r = wasmEngine.search(low, high, side, Math.min(preset.timeBudgetMs, 2000), preset.maxDepth, preset.topN, preset.scoreDelta);
  if (r.best_move < 0) return null;
  const d = anchorToDomino(r.best_move, side as 0 | 1);
  return { pos1: d.pos1, pos2: d.pos2, orientacao: d.orientacao };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
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

function seededOpening(seed: number, plies = 2): DominorioState {
  const random = mulberry32(seed >>> 0);
  let state = criarEstadoInicial('vs-computador');
  for (let i = 0; i < plies; i += 1) {
    const legal = calcularJogadasValidas(state.tabuleiro, state.jogadorAtual);
    if (legal.length === 0 || state.estado !== 'a-jogar') break;
    const next = colocarDomino(state, legal[Math.floor(random() * legal.length)]!);
    if (next.estado !== 'a-jogar') break;
    state = next;
  }
  return state;
}

function parseFlag(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1]! : fallback;
}

async function main(): Promise<void> {
  const games = Number(parseFlag('games', '60'));
  const seed = Number(parseFlag('seed', '20260719')) >>> 0;
  if (games % 2 !== 0) throw new Error('--games tem de ser par');

  await initWasm();
  console.log('motor: rust-wasm (N5=hardPlus vs N4=hard, budget cap 2000ms)');

  const wins: Record<SideLabel, number> = { n5: 0, n4: 0 };
  const illegal: Record<SideLabel, number> = { n5: 0, n4: 0 };
  const records: Array<Record<string, unknown>> = [];

  for (let g = 0; g < games; g += 1) {
    const n5As = g % 2 === 0 ? 'jogador1' : 'jogador2';
    let state = seededOpening(seed ^ fnv1a32(`abertura-${Math.floor(g / 2)}`));
    let plies = 0;
    let illegalBy: SideLabel | null = null;
    wasmEngine!.clear_tt();

    while (state.estado === 'a-jogar' && plies < 64) {
      const label: SideLabel = state.jogadorAtual === n5As ? 'n5' : 'n4';
      let move: Domino | null = null;
      try {
        move = engineMove(state, label);
      } catch (error) {
        console.error(`jogo ${g}: erro ${label}:`, (error as Error).message);
        illegalBy = label;
        break;
      }
      if (!move || !isJogadaValida(state, move)) {
        illegalBy = label;
        break;
      }
      state = colocarDomino(state, move);
      plies += 1;
    }

    let winner: SideLabel;
    if (illegalBy) {
      illegal[illegalBy] += 1;
      winner = illegalBy === 'n5' ? 'n4' : 'n5';
    } else {
      const winnerPlayer = state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2';
      winner = winnerPlayer === n5As ? 'n5' : 'n4';
    }
    wins[winner] += 1;
    records.push({ gameId: g, n5As, winner, plies, illegalBy });
    console.log(`jogo ${g + 1}/${games}: n5=${n5As} vencedor=${winner} plies=${plies}${illegalBy ? ` ILEGAL(${illegalBy})` : ''}`);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    options: { games, seed, budgetCapMs: 2000 },
    wins,
    n5Winrate: Number((wins.n5 / games).toFixed(3)),
    illegalMoves: illegal,
    records,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'artifacts', 'dominorio-arena', stamp);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log('\n=== Arena Dominório — N5 (hardPlus) vs N4 (hard) ===');
  console.log(`N5: ${wins.n5}–${wins.n4} (${(summary.n5Winrate * 100).toFixed(1)}%) · ilegais n5=${illegal.n5} n4=${illegal.n4}`);
  console.log(`resultados: ${join(outDir, 'results.json')}`);
}

await main();
