import type { AIRequest, AIResponse } from './types';
import { DIFFICULTY_PRESETS } from './types';
import { searchBestMove } from './engine';

function post(msg: AIResponse) {
  self.postMessage(msg);
}

interface WasmEngine {
  new(tt_size_bits: number): WasmEngine;
  search(
    low_lo: number,
    low_hi: number,
    high_lo: number,
    high_hi: number,
    side: number,
    time_budget_ms: number,
    max_depth: number,
    top_n: number,
    score_delta: number
  ): {
    best_move: number;
    depth_reached: number;
    nodes_searched: bigint;
    elapsed_ms: number;
    tt_hits: bigint;
    tt_probes: bigint;
    score: number;
  };
  clear_tt(): void;
}

let wasmEngine: WasmEngine | null = null;
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

function decodeMoveToSegmento(move: number, orientacaoIA: 'vertical' | 'horizontal') {
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
  try {
    const wasmModule = await import('./wasm/pkg/quelhas_wasm.js');
    await wasmModule.default();
    wasmEngine = new wasmModule.QuelhasEngine(18);
    useWasm = true;
    console.log('[QuelhasAI] WASM engine initialized');
  } catch (e) {
    console.warn('[QuelhasAI] WASM not available, using TypeScript fallback:', e);
    useWasm = false;
  }

  post({ type: 'ready' });
}

self.onmessage = (event: MessageEvent<AIRequest>) => {
  const req = event.data;
  if (req.type !== 'search') return;

  try {
    const preset = DIFFICULTY_PRESETS[req.difficulty];
    const timeBudgetMs = req.timeBudgetMs ?? preset.timeBudgetMs;

    let result:
      | ReturnType<typeof searchBestMove>
      | {
          bestMove: any;
          depthReached: number;
          nodesSearched: number;
          elapsedMs: number;
          ttHitRate: number;
          score: number;
          fromBook: boolean;
        };

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
        timeBudgetMs,
        preset.maxDepth,
        preset.topN,
        preset.scoreDelta
      );
      const ttProbes = Number(r.tt_probes);
      const ttHits = Number(r.tt_hits);
      result = {
        bestMove: r.best_move >= 0 ? decodeMoveToSegmento(r.best_move, req.orientacaoIA) : null,
        depthReached: r.depth_reached,
        nodesSearched: Number(r.nodes_searched),
        elapsedMs: performance.now() - startTime,
        ttHitRate: ttProbes > 0 ? ttHits / ttProbes : 0,
        score: r.score,
        fromBook: false,
      };
    } else {
      result = searchBestMove(req.tabuleiro, req.orientacaoIA, {
        timeBudgetMs,
        maxDepth: preset.maxDepth,
        topN: preset.topN,
        scoreDelta: preset.scoreDelta,
      });
    }

    post({
      type: 'result',
      id: req.id,
      bestMove: result.bestMove,
      depthReached: result.depthReached,
      nodesSearched: result.nodesSearched,
      elapsedMs: result.elapsedMs,
      ttHitRate: result.ttHitRate,
      score: result.score,
      fromBook: result.fromBook,
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
  post({ type: 'ready' });
});
