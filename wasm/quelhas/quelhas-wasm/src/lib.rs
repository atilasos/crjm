//! Quelhas (misère) WASM Engine
//!
//! - 10x10 board (100 bits) packed into 2×u64
//! - Negamax + alpha-beta + PVS, TT, killers/history
//! - Root randomization for easier difficulties (top_n + score_delta)

use wasm_bindgen::prelude::*;

use quelhas_ai::engine as ai_engine;
use quelhas_ai::tt::TranspositionTable;
use quelhas_ai::zobrist::ZobristKeys;
use quelhas_core::Occupancy;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Date)]
    fn now() -> f64;
}

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct SearchResult {
    pub best_move: i32,
    pub depth_reached: u32,
    pub nodes_searched: u64,
    pub elapsed_ms: f64,
    pub tt_hits: u64,
    pub tt_probes: u64,
    pub score: i32,
}

#[wasm_bindgen]
pub struct QuelhasEngine {
    tt: TranspositionTable,
    zobrist: ZobristKeys,
    age: u8,
}

#[wasm_bindgen]
impl QuelhasEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(tt_size_bits: u32) -> QuelhasEngine {
        let tt_size = 1usize << tt_size_bits.min(20);
        QuelhasEngine {
            tt: TranspositionTable::new(tt_size),
            zobrist: ZobristKeys::new(),
            age: 0,
        }
    }

    pub fn clear_tt(&mut self) {
        self.tt.clear();
        self.age = 0;
    }

    pub fn search(
        &mut self,
        low_lo: u32,
        low_hi: u32,
        high_lo: u32,
        high_hi: u32,
        side: u8,
        time_budget_ms: f64,
        max_depth: u32,
        top_n: u32,
        score_delta: i32,
    ) -> SearchResult {
        let occ = Occupancy::from_u32_parts(low_lo, low_hi, high_lo, high_hi);

        self.age = self.age.wrapping_add(1);
        let deadline = now() + time_budget_ms;

        let mut searcher = ai_engine::Searcher::new(&mut self.tt, &self.zobrist, self.age, deadline, max_depth);
        let result = searcher.iterative_deepening(occ, side, top_n, score_delta, || now());

        SearchResult {
            best_move: result.best_move.map(|m| m as i32).unwrap_or(-1),
            depth_reached: result.depth_reached,
            nodes_searched: result.nodes_searched,
            elapsed_ms: now() - (deadline - time_budget_ms),
            tt_hits: result.tt_hits,
            tt_probes: result.tt_probes,
            score: result.score,
        }
    }
}

