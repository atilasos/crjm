//! Position evaluation heuristics

use crate::bitboard::{count_moves, Side};

/// Infinity score for winning positions
pub const INF: i32 = 30000;

/// Mate score base (actual mate score is INF - ply)
pub const MATE_SCORE: i32 = 29000;

/// Evaluate a position from the perspective of the side to move
/// Positive = good for side to move
pub fn evaluate(occupied: u64, side: Side) -> i32 {
    let my_moves = count_moves(occupied, side) as i32;
    let opp_moves = count_moves(occupied, side.opposite()) as i32;
    
    // Terminal check
    if my_moves == 0 {
        return -MATE_SCORE;
    }
    if opp_moves == 0 {
        return MATE_SCORE;
    }
    
    // Mobility difference (opponent weighted more heavily)
    let mobility = my_moves * 10 - opp_moves * 15;
    
    // Safe moves (guaranteed available moves in runs)
    let my_safe = count_safe_moves(occupied, side) as i32;
    let opp_safe = count_safe_moves(occupied, side.opposite()) as i32;
    let safe = my_safe * 20 - opp_safe * 25;
    
    // Control bonus (penalize leaving opponent with corridors)
    let corridor_penalty = count_corridors(occupied, side.opposite()) as i32 * 10;
    
    mobility + safe - corridor_penalty
}

/// Count "safe" moves - runs of 2+ empty squares in orientation
/// Each run of length N gives floor(N/2) guaranteed moves
fn count_safe_moves(occupied: u64, side: Side) -> u32 {
    let mut safe = 0;
    
    match side {
        Side::Vertical => {
            // Check each column
            for col in 0..8 {
                let mut run_length = 0;
                for row in 0..8 {
                    let bit = 1u64 << (row * 8 + col);
                    if occupied & bit == 0 {
                        run_length += 1;
                    } else {
                        safe += run_length / 2;
                        run_length = 0;
                    }
                }
                safe += run_length / 2;
            }
        }
        Side::Horizontal => {
            // Check each row
            for row in 0..8 {
                let mut run_length = 0;
                for col in 0..8 {
                    let bit = 1u64 << (row * 8 + col);
                    if occupied & bit == 0 {
                        run_length += 1;
                    } else {
                        safe += run_length / 2;
                        run_length = 0;
                    }
                }
                safe += run_length / 2;
            }
        }
    }
    
    safe
}

/// Count corridors that benefit the opponent
/// A corridor is a run of 3+ empty squares perpendicular to opponent's orientation
fn count_corridors(occupied: u64, opponent_side: Side) -> u32 {
    let mut corridors = 0;
    
    match opponent_side {
        Side::Vertical => {
            // Vertical opponent benefits from long columns
            for col in 0..8 {
                let mut run_length = 0;
                for row in 0..8 {
                    let bit = 1u64 << (row * 8 + col);
                    if occupied & bit == 0 {
                        run_length += 1;
                    } else {
                        if run_length >= 3 {
                            corridors += run_length - 2;
                        }
                        run_length = 0;
                    }
                }
                if run_length >= 3 {
                    corridors += run_length - 2;
                }
            }
        }
        Side::Horizontal => {
            // Horizontal opponent benefits from long rows
            for row in 0..8 {
                let mut run_length = 0;
                for col in 0..8 {
                    let bit = 1u64 << (row * 8 + col);
                    if occupied & bit == 0 {
                        run_length += 1;
                    } else {
                        if run_length >= 3 {
                            corridors += run_length - 2;
                        }
                        run_length = 0;
                    }
                }
                if run_length >= 3 {
                    corridors += run_length - 2;
                }
            }
        }
    }
    
    corridors
}

/// Score a move for move ordering (higher = search first)
pub fn score_move_for_ordering(occupied: u64, anchor: u8, side: Side) -> i32 {
    let new_occupied = crate::bitboard::apply_move(occupied, anchor, side);
    let opp_side = side.opposite();
    
    // Count opponent moves after this move
    let opp_moves_after = count_moves(new_occupied, opp_side) as i32;
    
    // Immediate win
    if opp_moves_after == 0 {
        return 100000;
    }
    
    // Our moves after
    let my_moves_after = count_moves(new_occupied, side) as i32;
    
    // Minimize opponent mobility, maximize ours
    let mut score = -opp_moves_after * 100 + my_moves_after * 50;
    
    // Centrality bonus for early game
    let row = anchor / 8;
    let col = anchor % 8;
    let center_dist = ((row as i32 - 3).abs() + (col as i32 - 4).abs()) as i32;
    score -= center_dist * 5;
    
    score
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_empty_board_eval() {
        let score = evaluate(0, Side::Vertical);
        // Should be roughly even (slight advantage to mover due to turn)
        assert!(score.abs() < 100);
    }
    
    #[test]
    fn test_winning_position() {
        // Create a position where vertical has no moves
        // Fill all columns with gaps of 1 only
        // Actually, this is complex. Let's just test the mate detection
        let occupied = !0u64; // All filled = no moves for anyone
        
        let score = evaluate(occupied, Side::Vertical);
        assert!(score <= -MATE_SCORE + 100);
    }
    
    #[test]
    fn test_safe_moves() {
        // Empty board should have maximum safe moves
        let vertical_safe = count_safe_moves(0, Side::Vertical);
        let horizontal_safe = count_safe_moves(0, Side::Horizontal);
        
        // Each column has 8 empty squares = 4 safe moves per column = 32 total vertical
        assert_eq!(vertical_safe, 32);
        // Each row has 8 empty squares = 4 safe moves per row = 32 total horizontal
        assert_eq!(horizontal_safe, 32);
    }
}


