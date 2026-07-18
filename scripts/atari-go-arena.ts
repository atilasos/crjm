/**
 * Arena Atari Go: N6 (serviço de inferência AlphaZero, HTTP) vs motor local
 * (motor Rust/WASM N5 empacotado pelo build de produção).
 *
 * Uso:
 *   bun scripts/atari-go-arena.ts [--games 50] [--base http://127.0.0.1:8100]
 *                                 [--seed 20260717] [--budget 2000]
 *
 * Cores alternadas por jogo. Output: winrate, p95 de latência por lado e
 * contagem de jogadas ilegais (deve ser 0). JSON guardado em
 * artifacts/atari-go-arena/<timestamp>/results.json.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  calcularJogadasValidas,
  colocarPedra,
  criarEstadoInicial,
  isJogadaValida,
} from '../src/games/atari-go/logic';
import type { AtariGoState, Posicao } from '../src/games/atari-go/types';
import { idxToPos } from '../src/games/atari-go/ai/ai-client';
import { packBoard } from '../src/games/atari-go/ai/types';
import {
  best_move as wasmBestMove,
  init as seedWasm,
  initSync as initWasmSync,
  set_position as setWasmPosition,
} from '../src/games/atari-go/ai/wasm/pkg/atari_go_ai.js';

type Side = 'server-n6' | 'local-n5';
type PlayerId = 'jogador1' | 'jogador2';

interface ArenaOptions {
  games: number;
  base: string;
  seed: number;
  budgetMs: number;
}

interface GameRecord {
  gameId: string;
  serverAs: PlayerId;
  winner: Side | 'draw';
  plies: number;
  openingPlies: number;
  illegalBy: Side | null;
}

function parseFlag(name: string): string | null {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= args.length) return null;
  return args[index + 1]!;
}

function parseOptions(): ArenaOptions {
  const games = Number(parseFlag('games') ?? 50);
  const base = parseFlag('base') ?? 'http://127.0.0.1:8100';
  const seed = Number(parseFlag('seed') ?? 20260717);
  const budgetMs = Number(parseFlag('budget') ?? 2000);
  const normalizedGames = Number.isFinite(games) && games > 0 ? Math.trunc(games) : 50;
  if (normalizedGames % 2 !== 0) {
    throw new Error('--games tem de ser par para emparelhar cada abertura com as duas cores');
  }
  return {
    games: normalizedGames,
    base: base.replace(/\/$/, ''),
    seed: Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 20260717,
    budgetMs: Number.isFinite(budgetMs) && budgetMs > 0 ? Math.trunc(budgetMs) : 2000,
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

function createSeededOpening(seed: number, maxPlies = 4): { state: AtariGoState; plies: number } {
  const random = mulberry32(seed);
  let state = criarEstadoInicial('vs-computador');
  let plies = 0;
  while (plies < maxPlies && state.estado === 'a-jogar') {
    const candidates = calcularJogadasValidas(state.tabuleiro, state.jogadorAtual)
      .map((move) => colocarPedra(state, move))
      .filter((next) => next.estado === 'a-jogar');
    if (candidates.length === 0) break;
    state = candidates[Math.floor(random() * candidates.length)]!;
    plies += 1;
  }
  return { state, plies };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return Number(sorted[idx]!.toFixed(2));
}

async function requestServerMove(
  options: ArenaOptions,
  state: AtariGoState,
  seed: number,
): Promise<number> {
  const board = packBoard(state.tabuleiro);
  const response = await fetch(`${options.base}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board: Array.from(board),
      toPlay: state.jogadorAtual === 'jogador1' ? 1 : 2,
      lastMove: state.ultimaJogada
        ? state.ultimaJogada.linha * 9 + state.ultimaJogada.coluna
        : null,
      timeBudgetMs: options.budgetMs,
      seed,
    }),
    signal: AbortSignal.timeout(options.budgetMs + 3000),
  });
  if (!response.ok) {
    throw new Error(`servidor devolveu ${response.status}`);
  }
  const data = (await response.json()) as { move?: number };
  if (typeof data.move !== 'number') {
    throw new Error('resposta do servidor sem jogada');
  }
  return data.move;
}

async function main(): Promise<void> {
  const options = parseOptions();

  const health = await fetch(`${options.base}/health`, {
    signal: AbortSignal.timeout(2000),
  }).catch(() => null);
  if (!health?.ok) {
    console.error(`Serviço indisponível em ${options.base} — arranca o crjm-az-serve primeiro.`);
    process.exit(1);
  }
  const healthInfo = (await health.json()) as { model?: string; device?: string };

  const wasmBytes = await readFile(new URL(
    '../src/games/atari-go/ai/wasm/pkg/atari_go_ai_bg.wasm',
    import.meta.url,
  ));
  initWasmSync({ module: wasmBytes });

  const latencies: Record<Side, number[]> = { 'server-n6': [], 'local-n5': [] };
  const illegal: Record<Side, number> = { 'server-n6': 0, 'local-n5': 0 };
  const wins: Record<Side, number> = { 'server-n6': 0, 'local-n5': 0 };
  let draws = 0;
  const records: GameRecord[] = [];

  for (let g = 0; g < options.games; g += 1) {
    const serverAs: PlayerId = g % 2 === 0 ? 'jogador1' : 'jogador2';
    // Cada par usa a mesma abertura, trocando apenas a cor do servidor.
    const opening = createSeededOpening(options.seed ^ fnv1a32(`opening-${Math.floor(g / 2)}`));
    let state = opening.state;
    let plies = opening.plies;
    let illegalBy: Side | null = null;

    while (state.estado === 'a-jogar' && plies < 81) {
      const side: Side = state.jogadorAtual === serverAs ? 'server-n6' : 'local-n5';
      const moveSeed = (options.seed ^ fnv1a32(`g${g}p${plies}`)) >>> 0;
      const started = performance.now();
      let moveIdx: number | null = null;

      try {
        if (side === 'server-n6') {
          moveIdx = await requestServerMove(options, state, moveSeed);
        } else {
          seedWasm(moveSeed);
          setWasmPosition(
            packBoard(state.tabuleiro),
            state.jogadorAtual === 'jogador1' ? 0 : 1,
          );
          const best = wasmBestMove(options.budgetMs, 4);
          moveIdx = best >= 0 ? best : null;
        }
      } catch (error) {
        console.error(`jogo ${g}: erro do lado ${side}:`, error);
        illegalBy = side;
        break;
      }
      latencies[side].push(performance.now() - started);

      if (moveIdx === null || !isJogadaValida(state, idxToPos(moveIdx))) {
        illegalBy = side;
        break;
      }
      state = colocarPedra(state, idxToPos(moveIdx));
      plies += 1;
    }

    let winner: Side | 'draw';
    if (illegalBy !== null) {
      illegal[illegalBy] += 1;
      winner = illegalBy === 'server-n6' ? 'local-n5' : 'server-n6';
    } else if (state.estado === 'vitoria-jogador1') {
      winner = serverAs === 'jogador1' ? 'server-n6' : 'local-n5';
    } else if (state.estado === 'vitoria-jogador2') {
      winner = serverAs === 'jogador2' ? 'server-n6' : 'local-n5';
    } else {
      winner = 'draw';
    }
    if (winner === 'draw') draws += 1;
    else wins[winner] += 1;

    records.push({
      gameId: `g${g}`,
      serverAs,
      winner,
      plies,
      openingPlies: opening.plies,
      illegalBy,
    });
    console.log(
      `jogo ${g + 1}/${options.games}: servidor=${serverAs} vencedor=${winner} plies=${plies}` +
        (illegalBy ? ` ILEGAL(${illegalBy})` : ''),
    );
  }

  const decided = wins['server-n6'] + wins['local-n5'];
  const summary = {
    generatedAt: new Date().toISOString(),
    options,
    service: healthInfo,
    games: options.games,
    wins,
    draws,
    serverWinrate: decided > 0 ? Number((wins['server-n6'] / decided).toFixed(3)) : null,
    serverWinrateAllGames: Number((wins['server-n6'] / options.games).toFixed(3)),
    illegalMoves: illegal,
    latencyMs: {
      'server-n6': { p50: percentile(latencies['server-n6'], 0.5), p95: percentile(latencies['server-n6'], 0.95) },
      'local-n5': { p50: percentile(latencies['local-n5'], 0.5), p95: percentile(latencies['local-n5'], 0.95) },
    },
    records,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'artifacts', 'atari-go-arena', stamp);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log('\n=== Arena Atari Go — N6 (server-nn) vs N5 (local) ===');
  console.log(`winrate servidor (jogos decididos): ${summary.serverWinrate}`);
  console.log(`vitórias: server=${wins['server-n6']} local=${wins['local-n5']} empates=${draws}`);
  console.log(`jogadas ilegais: server=${illegal['server-n6']} local=${illegal['local-n5']}`);
  console.log(`latência p95 (ms): server=${summary.latencyMs['server-n6'].p95} local=${summary.latencyMs['local-n5'].p95}`);
  console.log(`resultados: ${join(outDir, 'results.json')}`);

  if (illegal['server-n6'] + illegal['local-n5'] > 0) {
    process.exitCode = 1;
  }
}

await main();
