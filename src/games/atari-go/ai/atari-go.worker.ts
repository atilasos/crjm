import type { AIRequest, AIResponse } from './types';
import { DIFFICULTY_PRESETS } from './types';
import { calcularJogadasValidas, jogadaComputador } from '../logic';
import type { Celula, Posicao } from '../types';

function post(msg: AIResponse) {
  self.postMessage(msg);
}

type WasmModule = {
  default: (opts: { module_or_path: URL | string }) => Promise<void>;
  init: (seed: number) => void;
  set_position: (board: Uint8Array, toPlay: number) => void;
  best_move: (timeMs: number, level: number) => number;
  stats: () => any;
};

let wasm: WasmModule | null = null;
let useWasm = false;
let initDone = false;

async function init(): Promise<void> {
  try {
    const wasmModule = (await import('./wasm/pkg/atari_go_ai.js')) as WasmModule;
    const wasmUrl = new URL('./wasm/pkg/atari_go_ai_bg.wasm', import.meta.url);
    await wasmModule.default({ module_or_path: wasmUrl });
    wasmModule.init((Date.now() >>> 0) as number);
    wasm = wasmModule;
    useWasm = true;
    console.log('[AtariGoAI] WASM engine initialized');
  } catch (e) {
    console.warn('[AtariGoAI] WASM not available, using fallback:', e);
    wasm = null;
    useWasm = false;
  } finally {
    initDone = true;
    post({ type: 'ready', usedWasm: useWasm });
  }
}

function unpackBoard(board: Uint8Array): Celula[][] {
  const out: Celula[][] = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 'vazia' as Celula));
  for (let i = 0; i < 81; i++) {
    const v = board[i];
    const linha = Math.floor(i / 9);
    const coluna = i % 9;
    out[linha][coluna] = v === 1 ? 'preta' : v === 2 ? 'branca' : 'vazia';
  }
  return out;
}

function posToIdx(p: Posicao): number {
  return p.linha * 9 + p.coluna;
}

function randomFallbackMove(req: Extract<AIRequest, { type: 'choose' }>): number | null {
  const tabuleiro = unpackBoard(req.state.board);
  const jogador = req.state.toPlay === 0 ? 'jogador1' : 'jogador2';
  const jogadasValidas = calcularJogadasValidas(tabuleiro, jogador);
  if (jogadasValidas.length === 0) return null;

  // Reusar a IA TS existente como fallback (mas a correr no Worker).
  const dummyState: any = {
    tabuleiro,
    modo: 'vs-computador',
    jogadorAtual: jogador,
    estado: 'a-jogar',
    jogadasValidas,
    ultimaJogada: null,
    pedrasCapturadas: { pretas: 0, brancas: 0 },
  };

  const next = jogadaComputador(dummyState) as any;
  const last: Posicao | null = next?.ultimaJogada ?? null;
  return last ? posToIdx(last) : null;
}

const initPromise = init().catch(e => {
  console.error('[AtariGoAI] init failed:', e);
});

async function handleChoose(req: Extract<AIRequest, { type: 'choose' }>): Promise<void> {
  if (!initDone) await initPromise;

  const preset = DIFFICULTY_PRESETS[req.difficulty];
  const start = performance.now();

  try {
    if (useWasm && wasm) {
      const seed = req.seed ?? ((Date.now() >>> 0) as number);
      wasm.init(seed);
      wasm.set_position(req.state.board, req.state.toPlay);
      const mv = wasm.best_move(preset.timeMs, preset.level);
      const stats = wasm.stats?.();
      post({
        type: 'result',
        id: req.id,
        move: mv >= 0 ? mv : null,
        elapsedMs: performance.now() - start,
        usedWasm: true,
        stats,
      });
    } else {
      const mv = randomFallbackMove(req);
      post({
        type: 'result',
        id: req.id,
        move: mv,
        elapsedMs: performance.now() - start,
        usedWasm: false,
      });
    }
  } catch (e) {
    post({
      type: 'error',
      id: req.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

self.onmessage = (event: MessageEvent<AIRequest>) => {
  const req = event.data;
  if (req.type !== 'choose') return;
  void handleChoose(req);
};
