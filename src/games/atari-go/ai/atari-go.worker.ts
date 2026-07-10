import type { AIRequest, AIResponse } from './types';
import { DIFFICULTY_PRESETS } from './types';
import { chooseFallbackMoveIndexFromPacked } from './fallback-engine';

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

const initPromise = init().catch(e => {
  console.error('[AtariGoAI] init failed:', e);
});

async function handleChoose(req: Extract<AIRequest, { type: 'choose' }>): Promise<void> {
  if (!initDone) await initPromise;

  const preset = DIFFICULTY_PRESETS[req.difficulty];
  const timeBudgetMs =
    typeof req.timeBudgetMs === 'number' && Number.isFinite(req.timeBudgetMs)
      ? Math.max(1, Math.trunc(req.timeBudgetMs))
      : preset.timeMs;
  const start = performance.now();

  try {
    if (useWasm && wasm) {
      const seed = req.seed ?? ((Date.now() >>> 0) as number);
      wasm.init(seed);
      wasm.set_position(req.state.board, req.state.toPlay);
      const mv = wasm.best_move(timeBudgetMs, preset.level);
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
      const mv = chooseFallbackMoveIndexFromPacked(req.state, {
        level: req.coreLevel,
        seed: req.seed,
        timeBudgetMs,
      });
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
