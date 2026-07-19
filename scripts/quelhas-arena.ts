/**
 * Arena Quelhas: rede az-quelhas (serviço HTTP, porta 8101) vs motor local
 * de produção (WASM N5 + solver exato de finais — o mesmo caminho do worker).
 *
 * Aberturas aleatórias emparelhadas com seed (cada par joga a mesma abertura
 * com os papéis trocados). Regista winrate, latências e o histograma de
 * comprimentos de segmento por lado — a pergunta central: a rede descobre
 * comprimentos melhores do que o «quase sempre 2» do motor clássico?
 *
 * Uso: bun scripts/quelhas-arena.ts [--games 40] [--base http://127.0.0.1:8101]
 *        [--seed 20260719] [--budget 2000]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  calcularJogadasValidas,
  colocarSegmento,
  criarEstadoInicial,
  getOrientacaoJogador,
} from '../src/games/quelhas/logic';
import type { QuelhasState, Segmento } from '../src/games/quelhas/types';
import { searchBestMove, trySolveEndgameMove, applyDifficultySelection } from '../src/games/quelhas/ai/engine';
import { DIFFICULTY_PRESETS } from '../src/games/quelhas/ai/types';
import { readFile as readFileNode } from 'node:fs/promises';

interface WasmEngineInstance {
  search(
    lowLo: number, lowHi: number, highLo: number, highHi: number,
    side: number, timeBudgetMs: number, maxDepth: number, topN: number, scoreDelta: number,
  ): { best_move: number };
}

let wasmEngine: WasmEngineInstance | null = null;

async function initWasm(): Promise<void> {
  const pkg = await import('../src/games/quelhas/ai/wasm/pkg/quelhas_wasm.js');
  const bytes = await readFileNode(new URL('../src/games/quelhas/ai/wasm/pkg/quelhas_wasm_bg.wasm', import.meta.url));
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

function decodeWasmMove(move: number): Segmento {
  const start = move & 0x7f;
  return {
    inicio: { linha: Math.floor(start / 10), coluna: start % 10 },
    comprimento: (move >> 7) & 0x0f,
    orientacao: ((move >> 11) & 1) === 0 ? 'vertical' : 'horizontal',
  };
}

const SIZE = 10;

type Side = 'server-nn' | 'local-n5';

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

function actionId(move: Segmento): number {
  return (move.inicio.linha * SIZE + move.inicio.coluna) * 9 + (move.comprimento - 2);
}

function actionToSegmento(action: number, toPlay: 'jogador1' | 'jogador2'): Segmento {
  const start = Math.floor(action / 9);
  return {
    inicio: { linha: Math.floor(start / SIZE), coluna: start % SIZE },
    comprimento: (action % 9) + 2,
    orientacao: toPlay === 'jogador1' ? 'vertical' : 'horizontal',
  };
}

function parseFlag(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1]! : fallback;
}

function seededOpening(seed: number, maxPlies = 4): { state: QuelhasState; plies: number } {
  const random = mulberry32(seed);
  let state = criarEstadoInicial('vs-computador');
  let plies = 0;
  while (plies < maxPlies && state.estado === 'a-jogar') {
    const legal = calcularJogadasValidas(state.tabuleiro, getOrientacaoJogador(state, state.jogadorAtual));
    if (legal.length === 0) break;
    const next = colocarSegmento(state, legal[Math.floor(random() * legal.length)]!);
    if (next.estado !== 'a-jogar') break;
    state = next;
    plies += 1;
  }
  return { state, plies };
}

async function serverMove(base: string, state: QuelhasState, budgetMs: number, seed: number): Promise<Segmento> {
  const board = state.tabuleiro.flat().map((c) => (c === 'vazia' ? 0 : 1));
  const response = await fetch(`${base}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board,
      toPlay: state.jogadorAtual === 'jogador1' ? 1 : 2,
      timeBudgetMs: budgetMs,
      seed,
    }),
    signal: AbortSignal.timeout(budgetMs + 3000),
  });
  if (!response.ok) throw new Error(`servidor devolveu ${response.status}`);
  const data = (await response.json()) as { move?: number };
  if (typeof data.move !== 'number') throw new Error('resposta sem jogada');
  return actionToSegmento(data.move, state.jogadorAtual);
}

function localMove(state: QuelhasState, budgetMs: number): Segmento | null {
  const orientacao = getOrientacaoJogador(state, state.jogadorAtual);
  const solved = trySolveEndgameMove(state.tabuleiro, orientacao);
  if (solved) return solved;
  const preset = DIFFICULTY_PRESETS.master;
  if (wasmEngine) {
    const { lowLo, lowHi, highLo, highHi } = boardToU64Parts(state.tabuleiro);
    const side = orientacao === 'vertical' ? 0 : 1;
    const r = wasmEngine.search(lowLo, lowHi, highLo, highHi, side, budgetMs, preset.maxDepth, preset.topN, preset.scoreDelta);
    const best = r.best_move >= 0 ? decodeWasmMove(r.best_move) : null;
    return applyDifficultySelection(state.tabuleiro, orientacao, best, 0);
  }
  const result = searchBestMove(state.tabuleiro, orientacao, {
    timeBudgetMs: budgetMs,
    maxDepth: preset.maxDepth,
    topN: preset.topN,
    scoreDelta: preset.scoreDelta,
    selectionQuantile: 0,
  });
  return result.bestMove;
}

async function main(): Promise<void> {
  const games = Number(parseFlag('games', '40'));
  const base = parseFlag('base', 'http://127.0.0.1:8101').replace(/\/$/, '');
  const seed = Number(parseFlag('seed', '20260719')) >>> 0;
  const budgetMs = Number(parseFlag('budget', '2000'));
  if (games % 2 !== 0) throw new Error('--games tem de ser par para emparelhar aberturas');

  try {
    await initWasm();
    console.log('N5 local: rust-wasm + solver de finais');
  } catch (error) {
    console.error('WASM indisponível, N5 local usa TS fallback:', (error as Error).message);
  }

  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
  if (!health?.ok) {
    console.error(`Serviço indisponível em ${base} — arranca o serve.py do quelhas primeiro.`);
    process.exit(1);
  }
  const healthInfo = (await health.json()) as { model?: string; device?: string };

  const wins: Record<Side, number> = { 'server-nn': 0, 'local-n5': 0 };
  const illegal: Record<Side, number> = { 'server-nn': 0, 'local-n5': 0 };
  const latencies: Record<Side, number[]> = { 'server-nn': [], 'local-n5': [] };
  const lengths: Record<Side, Record<number, number>> = { 'server-nn': {}, 'local-n5': {} };
  const records: Array<Record<string, unknown>> = [];

  for (let g = 0; g < games; g += 1) {
    const serverAs = g % 2 === 0 ? 'jogador1' : 'jogador2';
    const opening = seededOpening(seed ^ fnv1a32(`abertura-${Math.floor(g / 2)}`));
    let state = opening.state;
    let plies = opening.plies;
    let illegalBy: Side | null = null;

    while (state.estado === 'a-jogar' && plies < 120) {
      const side: Side = state.jogadorAtual === serverAs ? 'server-nn' : 'local-n5';
      const started = performance.now();
      let move: Segmento | null = null;
      try {
        move =
          side === 'server-nn'
            ? await serverMove(base, state, budgetMs, (seed ^ fnv1a32(`g${g}p${plies}`)) >>> 0)
            : localMove(state, budgetMs);
      } catch (error) {
        console.error(`jogo ${g}: erro ${side}:`, (error as Error).message);
        illegalBy = side;
        break;
      }
      latencies[side].push(performance.now() - started);
      const legal = calcularJogadasValidas(state.tabuleiro, getOrientacaoJogador(state, state.jogadorAtual));
      const isLegal = move !== null && legal.some((m) => actionId(m) === actionId(move!));
      if (!isLegal) {
        illegalBy = side;
        break;
      }
      lengths[side][move!.comprimento] = (lengths[side][move!.comprimento] ?? 0) + 1;
      state = colocarSegmento(state, move!);
      plies += 1;
    }

    let winner: Side;
    if (illegalBy) {
      illegal[illegalBy] += 1;
      winner = illegalBy === 'server-nn' ? 'local-n5' : 'server-nn';
    } else {
      const winnerPlayer = state.estado === 'vitoria-jogador1' ? 'jogador1' : 'jogador2';
      winner = winnerPlayer === serverAs ? 'server-nn' : 'local-n5';
    }
    wins[winner] += 1;
    records.push({ gameId: g, serverAs, winner, plies, openingPlies: opening.plies, illegalBy });
    console.log(`jogo ${g + 1}/${games}: servidor=${serverAs} vencedor=${winner} plies=${plies}${illegalBy ? ` ILEGAL(${illegalBy})` : ''}`);
  }

  const p = (values: number[], q: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return Number(sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!.toFixed(1));
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    options: { games, base, seed, budgetMs },
    service: healthInfo,
    wins,
    winrateServer: Number((wins['server-nn'] / games).toFixed(3)),
    illegalMoves: illegal,
    latencyMs: {
      'server-nn': { p50: p(latencies['server-nn'], 0.5), p95: p(latencies['server-nn'], 0.95) },
      'local-n5': { p50: p(latencies['local-n5'], 0.5), p95: p(latencies['local-n5'], 0.95) },
    },
    chosenLengths: lengths,
    records,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'artifacts', 'quelhas-arena', stamp);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log('\n=== Arena Quelhas — az-quelhas (server-nn) vs N5 local ===');
  console.log(`winrate servidor: ${summary.winrateServer} (${wins['server-nn']}–${wins['local-n5']})`);
  console.log(`ilegais: server=${illegal['server-nn']} local=${illegal['local-n5']}`);
  console.log(`comprimentos servidor: ${JSON.stringify(lengths['server-nn'])}`);
  console.log(`comprimentos local:    ${JSON.stringify(lengths['local-n5'])}`);
  console.log(`resultados: ${join(outDir, 'results.json')}`);
}

await main();
