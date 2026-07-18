import { readFile } from 'node:fs/promises';
import {
  calcularJogadasValidas,
  colocarPedra,
  criarEstadoInicial,
  isJogadaValida,
} from '../src/games/atari-go/logic';
import type { AtariGoState } from '../src/games/atari-go/types';
import { idxToPos } from '../src/games/atari-go/ai/ai-client';
import { packBoard } from '../src/games/atari-go/ai/types';
import {
  best_move as wasmBestMove,
  init as seedWasm,
  initSync as initWasmSync,
  set_position as setWasmPosition,
} from '../src/games/atari-go/ai/wasm/pkg/atari_go_ai.js';

function opening(seed: number, plies: number): AtariGoState {
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (randomState + 0x6d2b79f5) >>> 0;
    let value = randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  let state = criarEstadoInicial('vs-computador');
  for (let ply = 0; ply < plies; ply += 1) {
    const candidates = calcularJogadasValidas(state.tabuleiro, state.jogadorAtual)
      .map((move) => colocarPedra(state, move))
      .filter((next) => next.estado === 'a-jogar');
    if (candidates.length === 0) break;
    state = candidates[Math.floor(random() * candidates.length)]!;
  }
  return state;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

async function main(): Promise<void> {
  const wasmBytes = await readFile(new URL(
    '../src/games/atari-go/ai/wasm/pkg/atari_go_ai_bg.wasm',
    import.meta.url,
  ));
  initWasmSync({ module: wasmBytes });

  const budgetMs = 25;
  const toleranceMs = 100;
  const positions = [opening(11, 4), opening(22, 10), opening(33, 18)];
  const elapsedSamples: number[] = [];

  for (const [index, state] of positions.entries()) {
    seedWasm(10_000 + index);
    setWasmPosition(
      packBoard(state.tabuleiro),
      state.jogadorAtual === 'jogador1' ? 0 : 1,
    );
    const started = performance.now();
    const move = wasmBestMove(budgetMs, 4);
    const elapsed = performance.now() - started;
    elapsedSamples.push(elapsed);

    if (move < 0 || !isJogadaValida(state, idxToPos(move))) {
      throw new Error(`posição ${index}: N5 devolveu jogada ilegal ${move}`);
    }
    if (elapsed > budgetMs + toleranceMs) {
      throw new Error(
        `posição ${index}: ${elapsed.toFixed(1)} ms excede budget+tolerância (${budgetMs + toleranceMs} ms)`,
      );
    }
  }

  console.log(
    `[atari-go-wasm-budget] PASS: ${positions.length} posições, ` +
      `budget=${budgetMs}ms, p95=${percentile(elapsedSamples, 0.95).toFixed(1)}ms`,
  );
}

await main();
