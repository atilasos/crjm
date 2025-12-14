#[derive(Clone, Copy)]
pub struct TTEntry {
    pub key: u64,
    pub depth: u8,
    pub value: i16,
    pub flag: u8, // 0 exact, 1 lower, 2 upper
    pub best_move: i16, // 0..80 or -1
}

impl Default for TTEntry {
    fn default() -> Self {
        Self {
            key: 0,
            depth: 0,
            value: 0,
            flag: 0,
            best_move: -1,
        }
    }
}

pub struct TranspositionTable {
    mask: usize,
    entries: Vec<TTEntry>,
    pub probes: u64,
    pub hits: u64,
}

impl TranspositionTable {
    pub fn new(size_pow2: usize) -> Self {
        let size = 1usize << size_pow2;
        Self {
            mask: size - 1,
            entries: vec![TTEntry::default(); size],
            probes: 0,
            hits: 0,
        }
    }

    pub fn clear(&mut self) {
        for e in &mut self.entries {
            *e = TTEntry::default();
        }
        self.probes = 0;
        self.hits = 0;
    }

    #[inline]
    fn index(&self, key: u64) -> usize {
        (key as usize) & self.mask
    }

    pub fn probe(&mut self, key: u64) -> Option<TTEntry> {
        self.probes += 1;
        let e = self.entries[self.index(key)];
        if e.key == key && e.depth != 0 {
            self.hits += 1;
            Some(e)
        } else {
            None
        }
    }

    pub fn store(&mut self, entry: TTEntry) {
        let idx = self.index(entry.key);
        let cur = self.entries[idx];
        let replace = cur.depth == 0 || cur.key == entry.key || entry.depth + 2 >= cur.depth;
        if replace {
            self.entries[idx] = entry;
        }
    }
}

