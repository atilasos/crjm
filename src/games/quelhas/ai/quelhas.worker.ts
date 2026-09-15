import type { QuelhasEngine } from './wasm/pkg/quelhas_wasm.js';
import type { Segmento } from '../types';
import type { AIRequest, AIResponse } from './types';
import { DIFFICULTY_PRESETS } from './types';
import { applyDifficultySelection, searchBestMove, trySolveEndgameMove } from './engine';

function post(msg: AIResponse) {
  self.postMessage(msg);
}

let wasmEngine: QuelhasEngine | null = null;
let useWasm = false;

function boardToU64Parts(tabuleiro: ('vazia' | 'ocupada')[][]): {
  lowLo: number;
  lowHi: number;
  highLo: number;
  highHi: number;
} {
  let low = 0n;
  let high = 0n;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
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

function decodeMoveToSegmento(move: number): Segmento {
  // Move encoding: start | (len<<7) | (orient<<11)
  const start = move & 0x7f;
  const comprimento = (move >> 7) & 0x0f;
  const orientBit = (move >> 11) & 1;
  const orientacao = orientBit === 0 ? 'vertical' : 'horizontal';

  // Segurança: o engine devolve a orientação embutida, mas a UI espera coerência com o turno.
  // Se houver mismatch por qualquer motivo, confiar no move.
  return {
    inicio: { linha: Math.floor(start / 10), coluna: start % 10 },
    comprimento,
    orientacao,
  };
}

async function init(): Promise<void> {
  let wasmUrl: URL | null = null;
  try {
    const wasmModule = await import('./wasm/pkg/quelhas_wasm.js');
    // wasm-bindgen foi gerado com `--omit-default-module-path`, por isso temos de
    // indicar explicitamente onde está o .wasm.
    wasmUrl = new URL('./wasm/pkg/quelhas_wasm_bg.wasm', import.meta.url);
    // Use new wasm-bindgen init syntax (object parameter instead of URL directly)
    await wasmModule.default({ module_or_path: wasmUrl });
    wasmEngine = new wasmModule.QuelhasEngine(18);
    useWasm = true;
    console.log('[QuelhasAI] WASM engine initialized');
  } catch (e) {
    console.warn('[QuelhasAI] WASM not available, using TypeScript fallback:', e);
    if (wasmUrl) {
      try {
        const resp = await fetch(wasmUrl);
        const ct = resp.headers.get('content-type') ?? '';
        const buf = new Uint8Array(await resp.arrayBuffer());
        const magic = buf.length >= 4 ? Array.from(buf.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ') : '';
        console.warn('[QuelhasAI] WASM diagnostics:', {
          wasmUrl: wasmUrl.href,
          ok: resp.ok,
          status: resp.status,
          contentType: ct,
          magic,
        });
      } catch (diagErr) {
        console.warn('[QuelhasAI] WASM diagnostics failed:', diagErr);
      }
    }
    useWasm = false;
  }
}

// Signal ready imediatamente: o worker pode sempre responder via TS fallback,
// e ativa WASM assim que estiver disponível.
post({ type: 'ready' });

self.onmessage = (event: MessageEvent<AIRequest>) => {
  const req = event.data;
  if (req.type !== 'search') return;

  try {
    const preset = DIFFICULTY_PRESETS[req.difficulty];
    const timeBudgetMs = req.timeBudgetMs ?? preset.timeBudgetMs;
    const requestStarted = performance.now();

    // Níveis fortes: nos finais pequenos, resolver por busca completa e
    // jogar de forma comprovadamente ótima (gestão exata da paridade).
    if (req.difficulty === 'hard' || req.difficulty === 'master') {
      const solved = trySolveEndgameMove(req.tabuleiro, req.orientacaoIA, Math.min(50, timeBudgetMs * 0.1));
      if (solved) {
        post({
          type: 'result',
          id: req.id,
          bestMove: solved,
          depthReached: 0,
          nodesSearched: 0,
          elapsedMs: performance.now() - requestStarted,
          ttHitRate: 0,
          score: 0,
          fromBook: false,
          engine: 'exact-endgame',
          usedWasm: false,
        });
        return;
      }
    }

    let result: ReturnType<typeof searchBestMove>;
    const remainingMs = Math.max(1, timeBudgetMs - (performance.now() - requestStarted));

    if (useWasm && wasmEngine) {
      const { lowLo, lowHi, highLo, highHi } = boardToU64Parts(req.tabuleiro);
      const side = req.orientacaoIA === 'vertical' ? 0 : 1;
      const startTime = performance.now();
      const r = wasmEngine.search(
        lowLo,
        lowHi,
        highLo,
        highHi,
        side,
        remainingMs,
        preset.maxDepth,
        preset.topN,
        preset.scoreDelta
      );
      const ttProbes = Number(r.tt_probes);
      const ttHits = Number(r.tt_hits);
      result = {
        bestMove: applyDifficultySelection(
          req.tabuleiro,
          req.orientacaoIA,
          r.best_move >= 0 ? decodeMoveToSegmento(r.best_move) : null,
          preset.selectionQuantile,
        ),
        depthReached: r.depth_reached,
        nodesSearched: Number(r.nodes_searched),
        elapsedMs: performance.now() - startTime,
        ttHitRate: ttProbes > 0 ? ttHits / ttProbes : 0,
        score: r.score,
        fromBook: false,
      };
    } else {
      result = searchBestMove(req.tabuleiro, req.orientacaoIA, {
        timeBudgetMs: remainingMs,
        maxDepth: preset.maxDepth,
        topN: preset.topN,
        scoreDelta: preset.scoreDelta,
        selectionQuantile: preset.selectionQuantile,
      });
    }

    post({
      type: 'result',
      id: req.id,
      bestMove: result.bestMove,
      depthReached: result.depthReached,
      nodesSearched: result.nodesSearched,
      elapsedMs: performance.now() - requestStarted,
      ttHitRate: result.ttHitRate,
      score: result.score,
      fromBook: result.fromBook,
      engine: useWasm ? 'rust-wasm' : 'ts-fallback',
      usedWasm: useWasm,
    });
  } catch (e) {
    post({
      type: 'error',
      id: req.id,
      message: e instanceof Error ? e.message : String(e),
    });
  }
};

init().catch(e => {
  console.error('[QuelhasAI] Initialization failed:', e);
});
