//! Bitboard representation and move generation for Domineering
//!
//! Board layout:
//! ```text
//! Bit index = row * 8 + col
//!    0  1  2  3  4  5  6  7
//!    8  9 10 11 12 13 14 15
//!   16 17 18 19 20 21 22 23
//!   24 25 26 27 28 29 30 31
//!   32 33 34 35 36 37 38 39
//!   40 41 42 43 44 45 46 47
//!   48 49 50 51 52 53 54 55
//!   56 57 58 59 60 61 62 63
//! ```

/// Side to move
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    /// Vertical player (places dominoes vertically)
    Vertical = 0,
    /// Horizontal player (places dominoes horizontally)
    Horizontal = 1,
}

impl Side {
    #[inline]
    pub fn opposite(self) -> Side {
        match self {
            Side::Vertical => Side::Horizontal,
            Side::Horizontal => Side::Vertical,
        }
    }
}

/// Mask for file H (rightmost column) - used to prevent horizontal wrap
const FILE_H: u64 = 0x8080_8080_8080_8080;
const NOT_FILE_H: u64 = !FILE_H;

/// Mask for rank 8 (bottom row) - used to prevent vertical overflow
const RANK_8: u64 = 0xFF00_0000_0000_0000;
const NOT_RANK_8: u64 = !RANK_8;

/// Generate a bitboard of all valid move anchors for the given side
/// Each set bit represents the top-left cell of a valid domino placement
#[inline]
pub fn generate_moves_bb(occupied: u64, side: Side) -> u64 {
    let empty = !occupied;
    
    match side {
        Side::Vertical => {
            // Vertical: anchor in row r, need empty at r and r+1
            // r+1 corresponds to (anchor >> 8) being empty
            // Anchor must not be in rank 8 (bottom row)
            let anchors = empty & NOT_RANK_8;
            let below = empty >> 8;
            anchors & below
        }
        Side::Horizontal => {
            // Horizontal: anchor in col c, need empty at c and c+1
            // c+1 corresponds to (anchor >> 1) being empty
            // Anchor must not be in file H (rightmost column)
            let anchors = empty & NOT_FILE_H;
            let right = (empty >> 1) & NOT_FILE_H;
            anchors & right
        }
    }
}

/// Generate all valid moves as a vector of anchor indices
pub fn generate_moves(occupied: u64, side: Side) -> Vec<u8> {
    let mut moves = Vec::with_capacity(32);
    let mut bb = generate_moves_bb(occupied, side);
    
    while bb != 0 {
        let sq = bb.trailing_zeros() as u8;
        moves.push(sq);
        bb &= bb - 1; // Clear lowest set bit
    }
    
    moves
}

/// Count the number of legal moves (faster than generating them)
#[inline]
pub fn count_moves(occupied: u64, side: Side) -> u32 {
    generate_moves_bb(occupied, side).count_ones()
}

/// Apply a move to the board
/// Returns the new occupied bitboard
#[inline]
pub fn apply_move(occupied: u64, anchor: u8, side: Side) -> u64 {
    let anchor_bit = 1u64 << anchor;
    let second_bit = match side {
        Side::Vertical => anchor_bit << 8,   // Below
        Side::Horizontal => anchor_bit << 1, // Right
    };
    occupied | anchor_bit | second_bit
}

/// Check if a move is valid
#[inline]
pub fn is_valid_move(occupied: u64, anchor: u8, side: Side) -> bool {
    let moves_bb = generate_moves_bb(occupied, side);
    (moves_bb & (1u64 << anchor)) != 0
}

/// Convert anchor to row/col
#[inline]
pub fn anchor_to_coords(anchor: u8) -> (u8, u8) {
    (anchor / 8, anchor % 8)
}

/// Convert row/col to anchor
#[inline]
pub fn coords_to_anchor(row: u8, col: u8) -> u8 {
    row * 8 + col
}

/// Get the second cell of a domino given the anchor and side
#[inline]
pub fn get_second_cell(anchor: u8, side: Side) -> u8 {
    match side {
        Side::Vertical => anchor + 8,
        Side::Horizontal => anchor + 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_empty_board_moves() {
        // Empty board should have 56 vertical moves (8 cols × 7 rows)
        assert_eq!(count_moves(0, Side::Vertical), 56);
        // Empty board should have 56 horizontal moves (7 cols × 8 rows)
        assert_eq!(count_moves(0, Side::Horizontal), 56);
    }
    
    #[test]
    fn test_apply_move_vertical() {
        let occupied = 0u64;
        let anchor = 0; // Top-left corner
        let new_occupied = apply_move(occupied, anchor, Side::Vertical);
        
        // Should occupy bits 0 and 8
        assert_eq!(new_occupied, (1u64 << 0) | (1u64 << 8));
    }
    
    #[test]
    fn test_apply_move_horizontal() {
        let occupied = 0u64;
        let anchor = 0; // Top-left corner
        let new_occupied = apply_move(occupied, anchor, Side::Horizontal);
        
        // Should occupy bits 0 and 1
        assert_eq!(new_occupied, (1u64 << 0) | (1u64 << 1));
    }
    
    #[test]
    fn test_vertical_edge_case() {
        // Place vertical domino at bottom row should not wrap
        let moves = generate_moves_bb(0, Side::Vertical);
        
        // Bits 56-63 (rank 8) should not be set as anchors
        assert_eq!(moves & RANK_8, 0);
    }
    
    #[test]
    fn test_horizontal_edge_case() {
        // Horizontal moves should not cross file H boundary
        let moves = generate_moves_bb(0, Side::Horizontal);
        
        // Bits in file H (7, 15, 23, ..., 63) should not be anchors
        assert_eq!(moves & FILE_H, 0);
    }
    
    #[test]
    fn test_blocking() {
        // Place a vertical domino at (0,0)-(1,0)
        let occupied = (1u64 << 0) | (1u64 << 8);
        
        // Vertical player loses these moves:
        // - Anchor at (0,0) - blocked
        let v_moves = count_moves(occupied, Side::Vertical);
        assert_eq!(v_moves, 54); // 56 - 2 blocked
        
        // Horizontal player loses one move:
        // - Anchor at (0,0) - blocked
        // - Anchor at (1,0) - blocked
        let h_moves = count_moves(occupied, Side::Horizontal);
        assert_eq!(h_moves, 54); // 56 - 2 blocked
    }
    
    #[test]
    fn test_move_validity() {
        let occupied = (1u64 << 27) | (1u64 << 35); // Vertical at center
        
        // Cannot place where occupied
        assert!(!is_valid_move(occupied, 27, Side::Vertical));
        assert!(!is_valid_move(occupied, 27, Side::Horizontal));
        
        // Can place adjacent
        assert!(is_valid_move(occupied, 28, Side::Vertical));
        assert!(is_valid_move(occupied, 28, Side::Horizontal));
    }
}


