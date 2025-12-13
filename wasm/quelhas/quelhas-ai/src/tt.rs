#[derive(Clone, Copy, Debug)]
pub struct TTEntry {
    pub key: u64,
    pub depth: u8,
    pub score: i32,
    pub flag: u8, // 0 exact, 1 lower, 2 upper
    pub best_move: u16,
    pub age: u8,
}

pub struct TranspositionTable {
    entries: Vec<TTEntry>,
    mask: usize,
}

impl TranspositionTable {
    pub fn new(size: usize) -> Self {
        let mut entries = Vec::with_capacity(size);
        entries.resize_with(size, || TTEntry {
            key: 0,
            depth: 0,
            score: 0,
            flag: 0,
            best_move: 0,
            age: 0,
        });
        Self { entries, mask: size - 1 }
    }

    #[inline]
    pub fn clear(&mut self) {
        for e in self.entries.iter_mut() {
            e.key = 0;
            e.depth = 0;
            e.score = 0;
            e.flag = 0;
            e.best_move = 0;
            e.age = 0;
        }
    }

    #[inline]
    pub fn probe(&self, key: u64) -> &TTEntry {
        &self.entries[(key as usize) & self.mask]
    }

    #[inline]
    pub fn store(&mut self, entry: TTEntry) {
        let idx = (entry.key as usize) & self.mask;
        let cur = self.entries[idx];

        // preferir: nova entrada com maior depth ou mais recente
        if cur.key == 0
            || entry.depth >= cur.depth
            || entry.age != cur.age
        {
            self.entries[idx] = entry;
        }
    }
}

