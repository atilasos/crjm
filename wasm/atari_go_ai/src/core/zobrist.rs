use super::board::{Board, CELLS};
use super::rng::SplitMix64;

#[derive(Clone)]
pub struct Zobrist {
    pub stone: [[u64; CELLS]; 2], // [color][idx]
    pub to_play: u64,
}

impl Zobrist {
    pub fn new(_board: &Board, seed: u64) -> Self {
        let mut rng = SplitMix64::new(seed ^ 0xA7A7_6F6B_2A2A_1123);
        let mut stone = [[0u64; CELLS]; 2];
        for c in 0..2 {
            for i in 0..CELLS {
                stone[c][i] = rng.next_u64();
            }
        }
        let to_play = rng.next_u64();
        Self { stone, to_play }
    }
}

