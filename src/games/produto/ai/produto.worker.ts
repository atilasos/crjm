import type { AIRequest, AIResponse, ProdutoPackedMove } from './types';
import { DIFFICULTY_PRESETS } from './types';

function post(msg: AIResponse) {
  self.postMessage(msg);
}

type WasmModule = {
  default: (wasmUrl: URL) => Promise<void>;
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
    await wasmModule.default(wasmUrl);
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

function randomFallbackMove(req: Extract<AIRequest, { type: 'choose' }>): ProdutoPackedMove | null {
  // Fallback simples: escolhe posições aleatórias válidas e cores aleatórias.
  // (a UI aplica a jogada e valida a abertura via regras existentes)
  const preset = DIFFICULTY_PRESETS[req.difficulty];
  void preset; // reservado para evoluir a estratégia de fallback

  // Reconstruir lista de vazios a partir das máscaras (61 bits)
  const black = (BigInt(req.state.blackHi) << 32n) | BigInt(req.state.blackLo);
  const white = (BigInt(req.state.whiteHi) << 32n) | BigInt(req.state.whiteLo);
  const occupied = black | white;
  const FULL = (1n << 61n) - 1n;
  const empty = FULL & ~occupied;
  if (empty === 0n) return null;

  const empties: number[] = [];
  for (let i = 0; i < 61; i++) {
    if (((empty >> BigInt(i)) & 1n) === 1n) empties.push(i);
  }
  const rand = () => Math.random();

  const posA = empties[Math.floor(rand() * empties.length)];
  const colorA = (rand() < 0.5 ? 0 : 1) as 0 | 1;

  if (req.state.primeiraJogada) {
    return { posA, colorA, posB: -1, colorB: colorA };
  }

  if (empties.length < 2) return null;
  let posB = empties[Math.floor(rand() * (empties.length - 1))];
  if (posB === posA) posB = empties[empties.length - 1];
  const colorB = (rand() < 0.5 ? 0 : 1) as 0 | 1;
  return { posA, colorA, posB, colorB };
}

const initPromise = init().catch(e => console.error('[ProdutoAI] init failed:', e));

async function handleChoose(req: Extract<AIRequest, { type: 'choose' }>): Promise<void> {
  if (!initDone) await initPromise;

  const preset = DIFFICULTY_PRESETS[req.difficulty];
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
        timeMs: preset.timeMs,
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
