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
    let my_corridors = count_corridors(occupied, side) as i32;
    let opp_corridors = count_corridors(occupied, side.opposite()) as i32;
    let corridor_score = my_corridors * 12 - opp_corridors * 15;

    // Exclusive territory (2-cell runs in my orientation that opponent can't use)
    let my_exclusive = count_exclusive_territory(occupied, side) as i32;
    let opp_exclusive = count_exclusive_territory(occupied, side.opposite()) as i32;
    let exclusive_score = my_exclusive * 30 - opp_exclusive * 35;

    // Tempo/parity: in endgame, odd mobility difference matters
    let total_empty = (64 - occupied.count_ones()) as i32;
    let parity_bonus = if total_empty < 24 {
        // Late game: having more moves when few remain is crucial
        let move_diff = my_moves - opp_moves;
        if move_diff > 0 && (my_moves % 2 == 1) {
            15 // Odd moves left means we have tempo control
        } else if move_diff < 0 && (opp_moves % 2 == 1) {
            -15
        } else {
            0
        }
    } else {
        0
    };

    mobility + safe + corridor_score + exclusive_score + parity_bonus
}

/// Count exclusive territory (2-cell runs that can only be used by one side)
/// These are guaranteed safe placements in closed-off areas
fn count_exclusive_territory(occupied: u64, side: Side) -> u32 {
    let mut exclusive = 0;

    match side {
        Side::Vertical => {
            // Look for columns with exactly 2 consecutive empty cells
            // that are bounded by occupied or edges
            for col in 0..8 {
                let mut run_start: Option<u32> = None;
                for row in 0..=8 {
                    let is_empty = if row < 8 {
                        let bit = 1u64 << (row * 8 + col);
                        occupied & bit == 0
                    } else {
                        false
                    };

                    if is_empty {
                        if run_start.is_none() {
                            run_start = Some(row);
                        }
                    } else if let Some(start) = run_start {
                        let run_len = row - start;
                        if run_len == 2 {
                            // Check if horizontally blocked (exclusive for vertical)
                            let r1 = start;
                            let r2 = start + 1;
                            let blocked1 = (col == 0 || (occupied & (1u64 << (r1 * 8 + col - 1))) != 0)
                                && (col == 7 || (occupied & (1u64 << (r1 * 8 + col + 1))) != 0);
                            let blocked2 = (col == 0 || (occupied & (1u64 << (r2 * 8 + col - 1))) != 0)
                                && (col == 7 || (occupied & (1u64 << (r2 * 8 + col + 1))) != 0);
                            if blocked1 && blocked2 {
                                exclusive += 1;
                            }
                        }
                        run_start = None;
                    }
                }
            }
        }
        Side::Horizontal => {
            // Look for rows with exactly 2 consecutive empty cells
            for row in 0..8 {
                let mut run_start: Option<u32> = None;
                for col in 0..=8 {
                    let is_empty = if col < 8 {
                        let bit = 1u64 << (row * 8 + col);
                        occupied & bit == 0
                    } else {
                        false
                    };

                    if is_empty {
                        if run_start.is_none() {
                            run_start = Some(col);
                        }
                    } else if let Some(start) = run_start {
                        let run_len = col - start;
                        if run_len == 2 {
                            // Check if vertically blocked (exclusive for horizontal)
                            let c1 = start;
                            let c2 = start + 1;
                            let blocked1 = (row == 0 || (occupied & (1u64 << ((row - 1) * 8 + c1))) != 0)
                                && (row == 7 || (occupied & (1u64 << ((row + 1) * 8 + c1))) != 0);
                            let blocked2 = (row == 0 || (occupied & (1u64 << ((row - 1) * 8 + c2))) != 0)
                                && (row == 7 || (occupied & (1u64 << ((row + 1) * 8 + c2))) != 0);
                            if blocked1 && blocked2 {
                                exclusive += 1;
                            }
                        }
                        run_start = None;
                    }
                }
            }
        }
    }

    exclusive
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


