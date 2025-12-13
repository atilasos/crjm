use std::collections::HashMap;

pub const SIDE: i8 = 5;
pub const N: i8 = SIDE - 1; // 4
pub const CELLS: usize = 61;
pub const FULL_MASK: u64 = (1u64 << CELLS) - 1;

const DIRS: [(i8, i8); 6] = [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)];

#[derive(Clone)]
pub struct Board {
    pub positions: [(i8, i8); CELLS],
    pub neighbours: [u64; CELLS],
}

impl Board {
    pub fn new() -> Self {
        let mut positions_vec = Vec::with_capacity(CELLS);
        for q in -N..=N {
            for r in -N..=N {
                if (q + r).abs() <= N {
                    positions_vec.push((q, r));
                }
            }
        }
        debug_assert_eq!(positions_vec.len(), CELLS);

        let mut positions = [(0i8, 0i8); CELLS];
        for (idx, p) in positions_vec.into_iter().enumerate() {
            positions[idx] = p;
        }

        let mut lookup: HashMap<(i8, i8), usize> = HashMap::with_capacity(CELLS);
        for (idx, (q, r)) in positions.iter().copied().enumerate() {
            lookup.insert((q, r), idx);
        }

        let mut neighbours = [0u64; CELLS];
        for (idx, (q, r)) in positions.iter().copied().enumerate() {
            let mut mask = 0u64;
            for (dq, dr) in DIRS {
                let nq = q + dq;
                let nr = r + dr;
                if let Some(&nidx) = lookup.get(&(nq, nr)) {
                    mask |= 1u64 << nidx;
                }
            }
            neighbours[idx] = mask;
        }

        Self { positions, neighbours }
    }
}

pub fn bit(idx: usize) -> u64 {
    1u64 << idx
}

