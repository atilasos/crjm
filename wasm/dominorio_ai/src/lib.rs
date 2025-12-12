//! Dominório (Domineering) AI Engine
//!
//! High-performance AI for 8x8 Domineering using:
//! - Bitboard representation (u64)
//! - Negamax with alpha-beta pruning
//! - Iterative deepening with time control
//! - Zobrist hashing and transposition table
//! - Move ordering heuristics

mod bitboard;
mod engine;
mod eval;
mod tt;
mod zobrist;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
    
    #[wasm_bindgen(js_namespace = Date)]
    fn now() -> f64;
}

/// Initialize panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Search result returned to JavaScript
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
impl SearchResult {
    #[wasm_bindgen(getter)]
    pub fn pv(&self) -> Vec<i32> {
        vec![self.best_move]
    }
    
    #[wasm_bindgen(getter)]
    pub fn tt_hit_rate(&self) -> f64 {
        if self.tt_probes == 0 {
            0.0
        } else {
            self.tt_hits as f64 / self.tt_probes as f64
        }
    }
}

/// The AI engine instance (persistent across calls)
#[wasm_bindgen]
pub struct DominorioEngine {
    tt: tt::TranspositionTable,
    zobrist: zobrist::ZobristKeys,
    search_age: u8,
}

#[wasm_bindgen]
impl DominorioEngine {
    /// Create a new engine with specified TT size (in entries, power of 2)
    #[wasm_bindgen(constructor)]
    pub fn new(tt_size_bits: u32) -> DominorioEngine {
        let tt_size = 1usize << tt_size_bits.min(20); // Max 1M entries
        DominorioEngine {
            tt: tt::TranspositionTable::new(tt_size),
            zobrist: zobrist::ZobristKeys::new(),
            search_age: 0,
        }
    }
    
    /// Clear the transposition table
    pub fn clear_tt(&mut self) {
        self.tt.clear();
        self.search_age = 0;
    }
    
    /// Search for the best move
    ///
    /// # Arguments
    /// * `occupied_low` - Lower 32 bits of occupied squares
    /// * `occupied_high` - Upper 32 bits of occupied squares  
    /// * `side` - Side to move (0 = Vertical, 1 = Horizontal)
    /// * `time_budget_ms` - Time budget in milliseconds
    /// * `max_depth` - Maximum search depth
    /// * `top_n` - Number of top moves for randomization (0 = best only)
    /// * `score_delta` - Score window for move randomization
    pub fn search(
        &mut self,
        occupied_low: u32,
        occupied_high: u32,
        side: u8,
        time_budget_ms: f64,
        max_depth: u32,
        top_n: u32,
        score_delta: i32,
    ) -> SearchResult {
        let occupied = ((occupied_high as u64) << 32) | (occupied_low as u64);
        let side = if side == 0 { bitboard::Side::Vertical } else { bitboard::Side::Horizontal };
        
        self.search_age = self.search_age.wrapping_add(1);
        
        let deadline = now() + time_budget_ms;
        
        let mut searcher = engine::Searcher::new(
            &mut self.tt,
            &self.zobrist,
            self.search_age,
            deadline,
            max_depth,
        );
        
        let result = searcher.iterative_deepening(occupied, side, top_n, score_delta);
        
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
    
    /// Get the number of legal moves for a position
    pub fn count_moves(&self, occupied_low: u32, occupied_high: u32, side: u8) -> u32 {
        let occupied = ((occupied_high as u64) << 32) | (occupied_low as u64);
        let side = if side == 0 { bitboard::Side::Vertical } else { bitboard::Side::Horizontal };
        bitboard::count_moves(occupied, side)
    }
    
    /// Check if position is terminal (side to move has no moves)
    pub fn is_game_over(&self, occupied_low: u32, occupied_high: u32, side: u8) -> bool {
        self.count_moves(occupied_low, occupied_high, side) == 0
    }
    
    /// Evaluate position statically
    pub fn evaluate(&self, occupied_low: u32, occupied_high: u32, side: u8) -> i32 {
        let occupied = ((occupied_high as u64) << 32) | (occupied_low as u64);
        let side = if side == 0 { bitboard::Side::Vertical } else { bitboard::Side::Horizontal };
        eval::evaluate(occupied, side)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_engine_creation() {
        let engine = DominorioEngine::new(16);
        assert_eq!(engine.count_moves(0, 0, 0), 56); // Vertical has 56 moves on empty board
        assert_eq!(engine.count_moves(0, 0, 1), 56); // Horizontal has 56 moves on empty board
    }
    
    #[test]
    fn test_game_over() {
        let engine = DominorioEngine::new(16);
        // Empty board is not game over
        assert!(!engine.is_game_over(0, 0, 0));
        assert!(!engine.is_game_over(0, 0, 1));
    }
}


