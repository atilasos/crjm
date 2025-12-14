pub const SIZE: usize = 9;
pub const CELLS: usize = SIZE * SIZE; // 81

pub const FULL_MASK: u128 = (1u128 << CELLS) - 1;

#[derive(Clone)]
pub struct Board {
    pub neigh: [u128; CELLS],
    pub dist_center: [u8; CELLS],
}

impl Board {
    pub fn new() -> Self {
        let mut neigh = [0u128; CELLS];
        let mut dist_center = [0u8; CELLS];
        let c = (SIZE / 2) as i32;

        for r in 0..SIZE as i32 {
            for col in 0..SIZE as i32 {
                let idx = (r as usize) * SIZE + (col as usize);

                let mut m = 0u128;
                if r > 0 {
                    m |= 1u128 << (((r - 1) as usize) * SIZE + col as usize);
                }
                if r + 1 < SIZE as i32 {
                    m |= 1u128 << (((r + 1) as usize) * SIZE + col as usize);
                }
                if col > 0 {
                    m |= 1u128 << ((r as usize) * SIZE + (col - 1) as usize);
                }
                if col + 1 < SIZE as i32 {
                    m |= 1u128 << ((r as usize) * SIZE + (col + 1) as usize);
                }
                neigh[idx] = m;

                let d = (r - c).abs() + (col - c).abs();
                dist_center[idx] = d as u8;
            }
        }

        Self { neigh, dist_center }
    }
}

