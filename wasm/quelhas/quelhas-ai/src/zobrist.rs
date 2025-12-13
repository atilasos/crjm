use quelhas_core::{Occupancy, CELL_COUNT};

#[derive(Clone)]
pub struct ZobristKeys {
    pub squares: [u64; CELL_COUNT],
    pub side: u64,
}

fn splitmix64(mut x: u64) -> u64 {
    x = x.wrapping_add(0x9E3779B97F4A7C15);
    let mut z = x;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

impl ZobristKeys {
    pub fn new() -> Self {
        let mut squares = [0u64; CELL_COUNT];
        let mut seed = 0xC1F6_9D2Au64;
        for i in 0..CELL_COUNT {
            seed = splitmix64(seed);
            squares[i] = seed;
        }
        seed = splitmix64(seed);
        let side = seed;
        Self { squares, side }
    }

    #[inline]
    pub fn hash(&self, occ: Occupancy, side_to_move: u8) -> u64 {
        let mut h = 0u64;
        for idx in 0..CELL_COUNT {
            if occ.is_set(idx) {
                h ^= self.squares[idx];
            }
        }
        if side_to_move != 0 {
            h ^= self.side;
        }
        h
    }
}

