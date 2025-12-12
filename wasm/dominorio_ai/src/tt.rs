//! Transposition Table for storing previously computed positions

/// Entry flag indicating the type of bound
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum TTFlag {
    /// Exact score
    Exact = 0,
    /// Lower bound (score >= stored value)
    Lower = 1,
    /// Upper bound (score <= stored value)
    Upper = 2,
}

/// A single entry in the transposition table
#[derive(Debug, Clone, Copy)]
pub struct TTEntry {
    /// Zobrist hash key (full, for collision detection)
    pub key: u64,
    /// Best move found (anchor square, or 255 if none)
    pub best_move: u8,
    /// Search depth
    pub depth: u8,
    /// Score type flag
    pub flag: TTFlag,
    /// Age (for replacement strategy)
    pub age: u8,
    /// Evaluation score
    pub score: i16,
}

impl Default for TTEntry {
    fn default() -> Self {
        TTEntry {
            key: 0,
            best_move: 255,
            depth: 0,
            flag: TTFlag::Exact,
            age: 0,
            score: 0,
        }
    }
}

/// Transposition table
pub struct TranspositionTable {
    entries: Vec<TTEntry>,
    mask: usize,
    hits: u64,
    probes: u64,
}

impl TranspositionTable {
    /// Create a new transposition table with the given size
    /// Size should be a power of 2
    pub fn new(size: usize) -> Self {
        let size = size.next_power_of_two();
        TranspositionTable {
            entries: vec![TTEntry::default(); size],
            mask: size - 1,
            hits: 0,
            probes: 0,
        }
    }
    
    /// Clear all entries
    pub fn clear(&mut self) {
        for entry in &mut self.entries {
            *entry = TTEntry::default();
        }
        self.hits = 0;
        self.probes = 0;
    }
    
    /// Reset statistics
    pub fn reset_stats(&mut self) {
        self.hits = 0;
        self.probes = 0;
    }
    
    /// Get hit count
    pub fn hits(&self) -> u64 {
        self.hits
    }
    
    /// Get probe count
    pub fn probes(&self) -> u64 {
        self.probes
    }
    
    /// Probe the table for an entry
    pub fn probe(&mut self, key: u64) -> Option<&TTEntry> {
        self.probes += 1;
        let index = (key as usize) & self.mask;
        let entry = &self.entries[index];
        
        if entry.key == key && entry.depth > 0 {
            self.hits += 1;
            Some(entry)
        } else {
            None
        }
    }
    
    /// Store an entry in the table
    pub fn store(
        &mut self,
        key: u64,
        best_move: Option<u8>,
        depth: u8,
        flag: TTFlag,
        score: i16,
        age: u8,
    ) {
        let index = (key as usize) & self.mask;
        let existing = &self.entries[index];
        
        // Replacement strategy:
        // 1. Always replace if new depth >= existing depth
        // 2. Always replace if existing is from older search
        // 3. Always replace if slot is empty (depth = 0)
        let should_replace = existing.depth == 0
            || existing.age != age
            || depth >= existing.depth;
        
        if should_replace {
            self.entries[index] = TTEntry {
                key,
                best_move: best_move.unwrap_or(255),
                depth,
                flag,
                age,
                score,
            };
        }
    }
    
    /// Get TT move if available (for move ordering)
    pub fn get_tt_move(&mut self, key: u64) -> Option<u8> {
        let index = (key as usize) & self.mask;
        let entry = &self.entries[index];
        
        if entry.key == key && entry.best_move != 255 {
            Some(entry.best_move)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_tt_store_probe() {
        let mut tt = TranspositionTable::new(1024);
        
        let key = 0x123456789ABCDEF0;
        tt.store(key, Some(27), 5, TTFlag::Exact, 100, 1);
        
        let entry = tt.probe(key).unwrap();
        assert_eq!(entry.best_move, 27);
        assert_eq!(entry.depth, 5);
        assert_eq!(entry.score, 100);
        assert_eq!(entry.flag, TTFlag::Exact);
    }
    
    #[test]
    fn test_tt_miss() {
        let mut tt = TranspositionTable::new(1024);
        
        assert!(tt.probe(0x123456789ABCDEF0).is_none());
    }
    
    #[test]
    fn test_tt_replacement() {
        let mut tt = TranspositionTable::new(1024);
        
        let key = 0x123456789ABCDEF0;
        
        // Store with depth 3
        tt.store(key, Some(10), 3, TTFlag::Exact, 50, 1);
        
        // Should replace with depth 5
        tt.store(key, Some(20), 5, TTFlag::Exact, 100, 1);
        
        let entry = tt.probe(key).unwrap();
        assert_eq!(entry.best_move, 20);
        assert_eq!(entry.depth, 5);
    }
}


