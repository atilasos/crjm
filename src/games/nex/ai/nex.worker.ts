import type { AIRequest, AIResponse, NexAiAction } from './types';
import { DIFFICULTY_PRESETS } from './types';

function post(msg: AIResponse) {
  self.postMessage(msg);
}

type WasmModule = {
  default: (wasmUrl: URL) => Promise<void>;
  choose_move: (board: Uint8Array, toPlay: number, flags: number, msBudget: number, level: number, seed: number) => any;
  debug_eval?: (board: Uint8Array, toPlay: number, flags: number) => any;
};

let wasm: WasmModule | null = null;
let useWasm = false;
let initDone = false;

async function init(): Promise<void> {
  try {
    const wasmModule = (await import('./wasm/pkg/nex_ai.js')) as WasmModule;
    const wasmUrl = new URL('./wasm/pkg/nex_ai_bg.wasm', import.meta.url);
    await wasmModule.default(wasmUrl);
    wasm = wasmModule;
    useWasm = true;
    console.log('[NexAI] WASM engine initialized');
  } catch (e) {
    console.warn('[NexAI] WASM not available, using fallback:', e);
    useWasm = false;
    wasm = null;
  } finally {
    initDone = true;
    post({ type: 'ready', usedWasm: useWasm });
  }
}

const initPromise = init().catch(e => console.error('[NexAI] init failed:', e));

async function handleChoose(req: Extract<AIRequest, { type: 'choose' }>): Promise<void> {
  if (!initDone) await initPromise;

  const preset = DIFFICULTY_PRESETS[req.difficulty];
  const start = performance.now();

  try {
    if (useWasm && wasm) {
      const action = wasm.choose_move(req.state.board, req.state.toPlay, req.state.flags, preset.timeMs, preset.level, req.seed ?? (Date.now() >>> 0)) as NexAiAction;
      post({
        type: 'result',
        id: req.id,
        action: action ?? null,
        elapsedMs: performance.now() - start,
        usedWasm: true,
      });
    } else {
      post({
        type: 'result',
        id: req.id,
        action: null,
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
