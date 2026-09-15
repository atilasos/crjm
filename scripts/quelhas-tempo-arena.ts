/** Reproducible N5 before/after gate. Run alone: timed engines share the CPU.
 * Baseline directory: engine.ts plus quelhas_wasm.js and quelhas_wasm_bg.wasm
 * saved before the change. Each opening is played twice with roles exchanged.
 * bun scripts/quelhas-tempo-arena.ts --baseline /tmp/crjm-quelhas-before --games 60 --budget 200 --seed 20260915
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { calcularJogadasValidas, criarEstadoInicial, colocarSegmento, getOrientacaoJogador } from '../src/games/quelhas/logic';
import type { QuelhasState, Segmento } from '../src/games/quelhas/types';
import { trySolveEndgameMove, analyzeTurnCounts } from '../src/games/quelhas/ai/engine';
import * as candidateWasm from '../src/games/quelhas/ai/wasm/pkg/quelhas_wasm.js';

function flag(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1] ?? fallback;
}
function integer(name: string, fallback: number) {
  const value = Number(flag(name, String(fallback)));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid --${name}`);
  return value;
}
const games = integer('games', 60);
const budgetMs = integer('budget', 200);
const seed = integer('seed', 20260915);
const baselineDir = resolve(flag('baseline', '/tmp/crjm-quelhas-before'));
const output = resolve(flag('out', 'artifacts/quelhas-tempo/arena.json'));
if (games < 50 || games % 2 !== 0) throw new Error('At least 50 games, an even number, required for a strength gate.');
const baselineWasm: typeof candidateWasm = await import(pathToFileURL(join(baselineDir, 'quelhas_wasm.js')).href);
const baselineEngine: { trySolveEndgameMove: typeof trySolveEndgameMove } = await import(pathToFileURL(join(baselineDir, 'engine.ts')).href);
const oldBytes = await readFile(join(baselineDir, 'quelhas_wasm_bg.wasm'));
const newBytes = await readFile('src/games/quelhas/ai/wasm/pkg/quelhas_wasm_bg.wasm');
baselineWasm.initSync({ module: oldBytes });
candidateWasm.initSync({ module: newBytes });
const engines = { before: new baselineWasm.QuelhasEngine(18), after: new candidateWasm.QuelhasEngine(18) };
type Contender = keyof typeof engines;
function randomSource(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let z = Math.imul(value ^ value >>> 15, 1 | value);
    z ^= z + Math.imul(z ^ z >>> 7, 61 | z);
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
}
function opening(pair: number) {
  const random = randomSource(seed + pair * 997);
  let state = criarEstadoInicial('vs-computador');
  for (let ply = 0; ply < 4; ply++) {
    const next = colocarSegmento(state, state.jogadasValidas[Math.floor(random() * state.jogadasValidas.length)]!);
    if (next.estado !== 'a-jogar') break;
    state = next;
  }
  return state;
}
function decode(encoded: number): Segmento | null {
  if (encoded < 0) return null;
  const start = encoded & 127;
  return { inicio: { linha: Math.floor(start / 10), coluna: start % 10 }, comprimento: encoded >> 7 & 15, orientacao: encoded >> 11 & 1 ? 'horizontal' : 'vertical' };
}
function key(move: Segmento) { return `${move.inicio.linha}:${move.inicio.coluna}:${move.comprimento}:${move.orientacao}`; }
function choose(state: QuelhasState, contender: Contender) {
  const start = performance.now();
  const orientation = getOrientacaoJogador(state, state.jogadorAtual);
  const solved = contender === 'before'
    ? baselineEngine.trySolveEndgameMove(state.tabuleiro, orientation)
    : trySolveEndgameMove(state.tabuleiro, orientation, Math.min(50, budgetMs * 0.1));
  if (solved) return { move: solved, elapsedMs: performance.now() - start, source: 'exact-endgame', depth: 0 };
  let occupied = 0n;
  state.tabuleiro.flat().forEach((cell, index) => { if (cell === 'ocupada') occupied |= 1n << BigInt(index); });
  const u32 = (shift: bigint) => Number(occupied >> shift & 0xffffffffn);
  // Same N5 parameters. The exact-solver allowance belongs to the move budget.
  const result = engines[contender].search(u32(0n), u32(32n), u32(64n), u32(96n), orientation === 'vertical' ? 0 : 1,
    Math.max(1, budgetMs - (performance.now() - start)), 18, 0, 0);
  return { move: decode(result.best_move), elapsedMs: performance.now() - start, source: 'rust-wasm', depth: result.depth_reached };
}
const stats = () => ({ wins: 0, illegal: 0, lengths: {} as Record<number, number>, latencies: [] as number[], overBudget: 0 });
const totals = { before: stats(), after: stats() };
const records = [];
for (let game = 0; game < games; game++) {
  engines.before.clear_tt(); engines.after.clear_tt();
  let state = opening(Math.floor(game / 2));
  const initialBoard = state.tabuleiro.map(r => r.map(c => c === 'vazia' ? '.' : '#').join('')).join('\n');
  const afterAs = game % 2 === 0 ? 'jogador1' : 'jogador2';
  const moves = [];
  let illegalBy: Contender | null = null;
  while (state.estado === 'a-jogar' && moves.length < 100) {
    const contender = state.jogadorAtual === afterAs ? 'after' : 'before';
    const result = choose(state, contender);
    const tally = totals[contender];
    tally.latencies.push(result.elapsedMs);
    if (result.elapsedMs > budgetMs + 100) tally.overBudget++;
    const legal = calcularJogadasValidas(state.tabuleiro, getOrientacaoJogador(state, state.jogadorAtual));
    if (!result.move || !legal.some(m => key(m) === key(result.move!))) { tally.illegal++; illegalBy = contender; break; }
    tally.lengths[result.move.comprimento] = (tally.lengths[result.move.comprimento] ?? 0) + 1;
    moves.push({ contender, ...result, counts: analyzeTurnCounts(state.tabuleiro) });
    state = colocarSegmento(state, result.move);
  }
  if (!illegalBy && state.estado === 'a-jogar') throw new Error('Unfinished game');
  const winner: Contender = illegalBy ? (illegalBy === 'after' ? 'before' : 'after')
    : (state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2') === afterAs ? 'after' : 'before';
  totals[winner].wins++;
  records.push({ game, pair: Math.floor(game / 2), afterAs, initialBoard, winner, illegalBy, moves });
  console.log(JSON.stringify({ game: game + 1, games, winner, plies: moves.length, wins: { before: totals.before.wins, after: totals.after.wins } }));
}
function summary(contender: Contender) {
  const t = totals[contender]; const ordered = [...t.latencies].sort((a,b) => a-b);
  return { wins: t.wins, illegal: t.illegal, lengths: t.lengths, overBudget: t.overBudget,
    latencyMs: { p50: ordered[Math.floor(ordered.length * .5)], p95: ordered[Math.floor(ordered.length * .95)], max: ordered.at(-1) } };
}
const report = { generatedAt: new Date().toISOString(), games, budgetMs, seed, openingPlies: 4, baselineDir,
  wasmSha256: { before: createHash('sha256').update(oldBytes).digest('hex'), after: createHash('sha256').update(newBytes).digest('hex') },
  summary: { before: summary('before'), after: summary('after') }, records };
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ summary: report.summary, output }, null, 2));
