//! Search engine: negamax with alpha-beta, iterative deepening, TT

use crate::bitboard::{apply_move, count_moves, generate_moves, Side};
use crate::eval::{evaluate, score_move_for_ordering, INF, MATE_SCORE};
use crate::tt::{TTFlag, TranspositionTable};
use crate::zobrist::ZobristKeys;

/// External time function (from JS)
extern "C" {
    #[allow(improper_ctypes)]
    fn now() -> f64;
}

/// Search result
pub struct SearchResult {
    pub best_move: Option<u8>,
    pub score: i32,
    pub depth_reached: u32,
    pub nodes_searched: u64,
    pub tt_hits: u64,
    pub tt_probes: u64,
}

/// Killer moves storage (2 per ply)
struct KillerMoves {
    moves: [[Option<u8>; 2]; 64],
}

impl KillerMoves {
    fn new() -> Self {
        KillerMoves {
            moves: [[None; 2]; 64],
        }
    }
    
    fn add(&mut self, ply: usize, mv: u8) {
        if ply < 64 {
            if self.moves[ply][0] != Some(mv) {
                self.moves[ply][1] = self.moves[ply][0];
                self.moves[ply][0] = Some(mv);
            }
        }
    }
    
    fn is_killer(&self, ply: usize, mv: u8) -> bool {
        if ply < 64 {
            self.moves[ply][0] == Some(mv) || self.moves[ply][1] == Some(mv)
        } else {
            false
        }
    }
}

/// Searcher state
pub struct Searcher<'a> {
    tt: &'a mut TranspositionTable,
    zobrist: &'a ZobristKeys,
    age: u8,
    deadline: f64,
    max_depth: u32,
    nodes: u64,
    killers: KillerMoves,
    aborted: bool,
}

impl<'a> Searcher<'a> {
    pub fn new(
        tt: &'a mut TranspositionTable,
        zobrist: &'a ZobristKeys,
        age: u8,
        deadline: f64,
        max_depth: u32,
    ) -> Self {
        tt.reset_stats();
        Searcher {
            tt,
            zobrist,
            age,
            deadline,
            max_depth,
            nodes: 0,
            killers: KillerMoves::new(),
            aborted: false,
        }
    }
    
    /// Check if we should abort due to time
    #[inline]
    fn check_time(&mut self) -> bool {
        if self.nodes & 1023 == 0 {
            let current = unsafe { now() };
            if current >= self.deadline {
                self.aborted = true;
                return true;
            }
        }
        false
    }
    
    /// Iterative deepening search
    pub fn iterative_deepening(
        &mut self,
        occupied: u64,
        side: Side,
        top_n: u32,
        score_delta: i32,
    ) -> SearchResult {
        let mut best_move = None;
        let mut best_score = -INF;
        let mut depth_reached = 0;
        
        // Collect all root moves with scores for randomization
        let mut root_moves: Vec<(u8, i32)> = Vec::new();
        
        for depth in 1..=self.max_depth {
            self.aborted = false;
            
            let score = self.search_root(occupied, side, depth, &mut root_moves);
            
            if self.aborted {
                break;
            }
            
            depth_reached = depth;
            best_score = score;
            
            // Get best move from root_moves
            if let Some(&(mv, _)) = root_moves.first() {
                best_move = Some(mv);
            }
        }
        
        // Apply randomization if requested
        if top_n > 0 && !root_moves.is_empty() {
            let candidates: Vec<_> = root_moves
                .iter()
                .take(top_n as usize)
                .filter(|(_, s)| best_score - *s <= score_delta)
                .collect();
            
            if candidates.len() > 1 {
                // Simple random selection using node count as entropy
                let idx = (self.nodes as usize) % candidates.len();
                best_move = Some(candidates[idx].0);
                best_score = candidates[idx].1;
            }
        }
        
        SearchResult {
            best_move,
            score: best_score,
            depth_reached,
            nodes_searched: self.nodes,
            tt_hits: self.tt.hits(),
            tt_probes: self.tt.probes(),
        }
    }
    
    /// Search at root with move sorting
    fn search_root(
        &mut self,
        occupied: u64,
        side: Side,
        depth: u32,
        root_moves: &mut Vec<(u8, i32)>,
    ) -> i32 {
        let moves = generate_moves(occupied, side);
        
        if moves.is_empty() {
            return -MATE_SCORE;
        }
        
        // Score and sort moves
        let mut scored_moves: Vec<(u8, i32)> = moves
            .iter()
            .map(|&mv| (mv, score_move_for_ordering(occupied, mv, side)))
            .collect();
        
        // Use previous iteration ordering if available
        if !root_moves.is_empty() {
            for (i, (mv, _)) in root_moves.iter().enumerate() {
                if let Some(pos) = scored_moves.iter().position(|(m, _)| m == mv) {
                    scored_moves[pos].1 += 1000000 - (i as i32 * 1000);
                }
            }
        }
        
        scored_moves.sort_by(|a, b| b.1.cmp(&a.1));
        
        let mut alpha = -INF;
        let beta = INF;
        let mut best_move = scored_moves[0].0;
        
        root_moves.clear();
        
        for (mv, _) in &scored_moves {
            let new_occupied = apply_move(occupied, *mv, side);
            let hash = self.zobrist.hash(new_occupied, side.opposite());
            
            let score = -self.negamax(new_occupied, side.opposite(), hash, depth - 1, -beta, -alpha, 1);
            
            if self.aborted {
                return alpha;
            }
            
            root_moves.push((*mv, score));
            
            if score > alpha {
                alpha = score;
                best_move = *mv;
            }
        }
        
        // Sort root_moves by score for next iteration
        root_moves.sort_by(|a, b| b.1.cmp(&a.1));
        
        alpha
    }
    
    /// Negamax with alpha-beta pruning
    fn negamax(
        &mut self,
        occupied: u64,
        side: Side,
        hash: u64,
        depth: u32,
        mut alpha: i32,
        beta: i32,
        ply: u32,
    ) -> i32 {
        self.nodes += 1;
        
        if self.check_time() {
            return 0;
        }
        
        // Terminal check
        let my_moves = count_moves(occupied, side);
        if my_moves == 0 {
            return -MATE_SCORE + ply as i32;
        }
        
        // Depth 0: evaluate
        if depth == 0 {
            return evaluate(occupied, side);
        }
        
        // TT probe
        let tt_move = self.tt.get_tt_move(hash);
        if let Some(entry) = self.tt.probe(hash) {
            if entry.depth >= depth as u8 {
                let score = entry.score as i32;
                match entry.flag {
                    TTFlag::Exact => return score,
                    TTFlag::Lower => {
                        if score >= beta {
                            return score;
                        }
                    }
                    TTFlag::Upper => {
                        if score <= alpha {
                            return score;
                        }
                    }
                }
            }
        }
        
        // Generate and order moves
        let moves = generate_moves(occupied, side);
        let ordered_moves = self.order_moves(occupied, &moves, side, tt_move, ply as usize);
        
        let mut best_move = None;
        let mut best_score = -INF;
        let original_alpha = alpha;
        
        for mv in ordered_moves {
            let new_occupied = apply_move(occupied, mv, side);
            let new_hash = self.zobrist.update_hash(hash, mv, side);
            
            let score = -self.negamax(new_occupied, side.opposite(), new_hash, depth - 1, -beta, -alpha, ply + 1);
            
            if self.aborted {
                return 0;
            }
            
            if score > best_score {
                best_score = score;
                best_move = Some(mv);
            }
            
            if score > alpha {
                alpha = score;
            }
            
            if alpha >= beta {
                // Beta cutoff - update killers
                self.killers.add(ply as usize, mv);
                break;
            }
        }
        
        // TT store
        let flag = if best_score <= original_alpha {
            TTFlag::Upper
        } else if best_score >= beta {
            TTFlag::Lower
        } else {
            TTFlag::Exact
        };
        
        self.tt.store(hash, best_move, depth as u8, flag, best_score as i16, self.age);
        
        best_score
    }
    
    /// Order moves for better pruning
    fn order_moves(
        &self,
        occupied: u64,
        moves: &[u8],
        side: Side,
        tt_move: Option<u8>,
        ply: usize,
    ) -> Vec<u8> {
        let mut scored: Vec<(u8, i32)> = moves
            .iter()
            .map(|&mv| {
                let mut score = 0i32;
                
                // TT move gets highest priority
                if tt_move == Some(mv) {
                    score += 10_000_000;
                }
                
                // Killer moves get high priority
                if self.killers.is_killer(ply, mv) {
                    score += 1_000_000;
                }
                
                // Otherwise use heuristic
                if score == 0 {
                    score = score_move_for_ordering(occupied, mv, side);
                }
                
                (mv, score)
            })
            .collect();
        
        scored.sort_by(|a, b| b.1.cmp(&a.1));
        scored.into_iter().map(|(mv, _)| mv).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tt::TranspositionTable;
    use crate::zobrist::ZobristKeys;
    
    // Note: These tests use a mock deadline far in the future
    // In real usage, the deadline comes from JavaScript
    
    #[test]
    fn test_search_finds_winning_move() {
        // This is a basic sanity test
        // Real tests would need more sophisticated setups
        let mut tt = TranspositionTable::new(1024);
        let zobrist = ZobristKeys::new();
        
        // Empty board search should not panic
        let mut searcher = Searcher::new(&mut tt, &zobrist, 1, f64::MAX, 3);
        let result = searcher.iterative_deepening(0, Side::Vertical, 0, 0);
        
        assert!(result.best_move.is_some());
        assert!(result.depth_reached >= 1);
    }
}


