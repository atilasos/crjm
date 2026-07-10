import type { AIRequest, AIResponse, ProdutoPackedMove } from './types';
import { DIFFICULTY_PRESETS } from './types';
import { chooseFallbackPackedMove } from './fallback-engine';

function post(msg: AIResponse) {
  self.postMessage(msg);
}

type WasmModule = {
  default: (opts: { module_or_path: URL | string }) => Promise<void>;
  init_ai: (seed: number) => void;
  choose_move: (state: any, cfg: any) => any;
  explain_last: () => string;
};

let wasm: WasmModule | null = null;
let useWasm = false;
let initDone = false;

async function init(): Promise<void> {
  try {
    const wasmModule = (await import('./wasm/pkg/produto_ai.js')) as WasmModule;
    const wasmUrl = new URL('./wasm/pkg/produto_ai_bg.wasm', import.meta.url);
    await wasmModule.default({ module_or_path: wasmUrl });
    wasmModule.init_ai((Date.now() >>> 0) as number);
    wasm = wasmModule;
    useWasm = true;
    console.log('[ProdutoAI] WASM engine initialized');
  } catch (e) {
    console.warn('[ProdutoAI] WASM not available, using fallback:', e);
    useWasm = false;
    wasm = null;
  } finally {
    initDone = true;
    post({ type: 'ready', usedWasm: useWasm });
  }
}

const initPromise = init().catch(e => console.error('[ProdutoAI] init failed:', e));

async function handleChoose(req: Extract<AIRequest, { type: 'choose' }>): Promise<void> {
  if (!initDone) await initPromise;

  const preset = DIFFICULTY_PRESETS[req.difficulty];
  const timeMs =
    typeof req.timeBudgetMs === 'number' && Number.isFinite(req.timeBudgetMs)
      ? Math.max(1, Math.trunc(req.timeBudgetMs))
      : preset.timeMs;
  const start = performance.now();

  try {
    if (useWasm && wasm) {
      const cfg = {
        difficulty:
          req.difficulty === 'easy'
            ? 0
            : req.difficulty === 'medium'
              ? 1
              : req.difficulty === 'hard'
                ? 2
                : req.difficulty === 'very-hard'
                  ? 3
                  : 4,
        timeMs,
        candidateK: preset.candidateK,
        endgameEmptyN: preset.endgameEmptyN,
        seed: req.seed ?? (Date.now() >>> 0),
      };
      const mv = wasm.choose_move(req.state, cfg) as ProdutoPackedMove;
      const explain = wasm.explain_last?.();
      post({
        type: 'result',
        id: req.id,
        move: mv ?? null,
        elapsedMs: performance.now() - start,
        usedWasm: true,
        explain,
      });
    } else {
      const mv = chooseFallbackPackedMove(req.state, req.difficulty, req.seed ?? (Date.now() >>> 0), timeMs);
      post({
        type: 'result',
        id: req.id,
        move: mv,
        elapsedMs: performance.now() - start,
        usedWasm: false,
        explain: mv ? 'Fallback estratégico TypeScript' : 'Sem jogada estratégica disponível',
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
