//! Zobrist hashing for transposition table

use getrandom::getrandom;

/// Zobrist keys for hashing board positions
pub struct ZobristKeys {
    /// Key for each square being occupied
    pub square_keys: [u64; 64],
    /// Key for side to move
    pub side_key: u64,
}

impl ZobristKeys {
    /// Create new random Zobrist keys
    pub fn new() -> Self {
        let mut keys = ZobristKeys {
            square_keys: [0; 64],
            side_key: 0,
        };
        
        // Generate random keys
        let mut bytes = [0u8; 8];
        
        for i in 0..64 {
            if getrandom(&mut bytes).is_ok() {
                keys.square_keys[i] = u64::from_le_bytes(bytes);
            } else {
                // Fallback to deterministic pseudo-random
                keys.square_keys[i] = Self::deterministic_key(i as u64);
            }
        }
        
        if getrandom(&mut bytes).is_ok() {
            keys.side_key = u64::from_le_bytes(bytes);
        } else {
            keys.side_key = Self::deterministic_key(64);
        }
        
        keys
    }
    
    /// Deterministic fallback key generation
    fn deterministic_key(seed: u64) -> u64 {
        // Simple xorshift-based PRNG
        let mut x = seed.wrapping_add(0x9E3779B97F4A7C15);
        x = (x ^ (x >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        x = (x ^ (x >> 27)).wrapping_mul(0x94D049BB133111EB);
        x ^ (x >> 31)
    }
    
    /// Compute hash for a board position
    #[inline]
    pub fn hash(&self, occupied: u64, side: crate::bitboard::Side) -> u64 {
        let mut h = 0u64;
        let mut bb = occupied;
        
        while bb != 0 {
            let sq = bb.trailing_zeros() as usize;
            h ^= self.square_keys[sq];
            bb &= bb - 1;
        }
        
        if side == crate::bitboard::Side::Horizontal {
            h ^= self.side_key;
        }
        
        h
    }
    
    /// Incrementally update hash after a move
    #[inline]
    pub fn update_hash(&self, hash: u64, anchor: u8, side: crate::bitboard::Side) -> u64 {
        let second = crate::bitboard::get_second_cell(anchor, side);
        
        // XOR in the two new squares
        let h = hash ^ self.square_keys[anchor as usize] ^ self.square_keys[second as usize];
        
        // Toggle side
        h ^ self.side_key
    }
}

impl Default for ZobristKeys {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bitboard::Side;
    
    #[test]
    fn test_empty_board_hash() {
        let keys = ZobristKeys::new();
        let h1 = keys.hash(0, Side::Vertical);
        let h2 = keys.hash(0, Side::Horizontal);
        
        // Different sides should have different hashes
        assert_ne!(h1, h2);
        
        // Same position should have same hash
        assert_eq!(h1, keys.hash(0, Side::Vertical));
    }
    
    #[test]
    fn test_incremental_hash() {
        let keys = ZobristKeys::new();
        
        // Compute hash from scratch
        let occupied = (1u64 << 27) | (1u64 << 35);
        let h1 = keys.hash(occupied, Side::Horizontal);
        
        // Compute incrementally
        let h0 = keys.hash(0, Side::Vertical);
        let h2 = keys.update_hash(h0, 27, Side::Vertical);
        
        assert_eq!(h1, h2);
    }
}


