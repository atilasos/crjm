use super::board::{bit, Board, CELLS};

pub fn group_sizes(mask: u64, board: &Board) -> Vec<u8> {
    let mut sizes = Vec::new();
    let mut remaining = mask;

    while remaining != 0 {
        let start = remaining.trailing_zeros() as usize;
        let start_bit = bit(start);
        remaining &= !start_bit;

        let mut stack = start_bit;
        let mut group = start_bit;

        while stack != 0 {
            let idx = stack.trailing_zeros() as usize;
            let b = bit(idx);
            stack &= !b;

            let neigh = board.neighbours[idx] & remaining;
            if neigh != 0 {
                stack |= neigh;
                group |= neigh;
                remaining &= !neigh;
            }
        }

        sizes.push(group.count_ones() as u8);
    }

    sizes
}

/// Grupos incrementais por union-find para uma cor.
/// Clonável em O(CELLS); adicionar uma pedra custa O(vizinhos × α).
/// Evita recomputar o flood-fill completo em cada nó da pesquisa.
#[derive(Clone, Debug)]
pub struct GroupsInc {
    parent: [u8; CELLS],
    size: [u8; CELLS],
    pub mask: u64,
    pub groups: u8,
}

impl GroupsInc {
    pub fn new() -> Self {
        let mut parent = [0u8; CELLS];
        for (i, p) in parent.iter_mut().enumerate() {
            *p = i as u8;
        }
        Self {
            parent,
            size: [0u8; CELLS],
            mask: 0,
            groups: 0,
        }
    }

    pub fn from_mask(mask: u64, board: &Board) -> Self {
        let mut g = Self::new();
        let mut tmp = mask;
        while tmp != 0 {
            let idx = tmp.trailing_zeros() as usize;
            tmp &= !bit(idx);
            g.add(idx, board);
        }
        g
    }

    fn find(&mut self, mut i: usize) -> usize {
        while self.parent[i] as usize != i {
            let gp = self.parent[self.parent[i] as usize];
            self.parent[i] = gp;
            i = gp as usize;
        }
        i
    }

    /// Adiciona uma pedra desta cor na casa `idx` (tem de estar fora de `mask`).
    pub fn add(&mut self, idx: usize, board: &Board) {
        debug_assert!((self.mask & bit(idx)) == 0);
        self.mask |= bit(idx);
        self.parent[idx] = idx as u8;
        self.size[idx] = 1;
        self.groups += 1;

        let mut neigh = board.neighbours[idx] & self.mask & !bit(idx);
        while neigh != 0 {
            let j = neigh.trailing_zeros() as usize;
            neigh &= !bit(j);
            let ra = self.find(idx);
            let rb = self.find(j);
            if ra == rb {
                continue;
            }
            let (big, small) = if self.size[ra] >= self.size[rb] { (ra, rb) } else { (rb, ra) };
            self.parent[small] = big as u8;
            self.size[big] += self.size[small];
            self.groups -= 1;
        }
    }

    pub fn count(&self) -> u32 {
        self.mask.count_ones()
    }

    /// Tamanhos dos dois maiores grupos (0 quando não existem).
    pub fn top2(&self) -> (u8, u8) {
        let mut t1 = 0u8;
        let mut t2 = 0u8;
        let mut tmp = self.mask;
        while tmp != 0 {
            let i = tmp.trailing_zeros() as usize;
            tmp &= !bit(i);
            if self.parent[i] as usize == i {
                let s = self.size[i];
                if s > t1 {
                    t2 = t1;
                    t1 = s;
                } else if s > t2 {
                    t2 = s;
                }
            }
        }
        (t1, t2)
    }

    /// Produto dos dois maiores grupos (0 com menos de dois grupos).
    pub fn product(&self) -> u32 {
        let (t1, t2) = self.top2();
        if t2 == 0 {
            0
        } else {
            t1 as u32 * t2 as u32
        }
    }
}

impl Default for GroupsInc {
    fn default() -> Self {
        Self::new()
    }
}

pub fn component_ids(mask: u64, board: &Board) -> [u8; CELLS] {
    let mut ids = [0u8; CELLS];
    let mut remaining = mask;
    let mut next_id: u8 = 1;

    while remaining != 0 {
        let start = remaining.trailing_zeros() as usize;
        let start_bit = bit(start);
        remaining &= !start_bit;

        let mut stack = start_bit;
        ids[start] = next_id;

        while stack != 0 {
            let idx = stack.trailing_zeros() as usize;
            let b = bit(idx);
            stack &= !b;

            let neigh = board.neighbours[idx] & remaining;
            if neigh != 0 {
                let mut tmp = neigh;
                while tmp != 0 {
                    let j = tmp.trailing_zeros() as usize;
                    ids[j] = next_id;
                    tmp &= !bit(j);
                }
                stack |= neigh;
                remaining &= !neigh;
            }
        }

        next_id = next_id.wrapping_add(1);
        if next_id == 0 {
            break;
        }
    }

    ids
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::board::FULL_MASK;

    fn splitmix(state: &mut u64) -> u64 {
        *state = state.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = *state;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^ (z >> 31)
    }

    fn top2_ref(mask: u64, board: &Board) -> (u8, u8, usize) {
        let mut sizes = group_sizes(mask, board);
        sizes.sort_unstable_by(|a, b| b.cmp(a));
        let n = sizes.len();
        (
            sizes.first().copied().unwrap_or(0),
            sizes.get(1).copied().unwrap_or(0),
            n,
        )
    }

    #[test]
    fn groups_inc_matches_flood_fill_on_random_masks() {
        let board = Board::new();
        let mut rng = 0xdead_beefu64;
        for _ in 0..500 {
            let mask = splitmix(&mut rng) & FULL_MASK;
            let g = GroupsInc::from_mask(mask, &board);
            let (t1, t2, n) = top2_ref(mask, &board);
            assert_eq!(g.top2(), (t1, t2), "top2 divergente para mask={mask:#x}");
            assert_eq!(g.groups as usize, n, "nº grupos divergente para mask={mask:#x}");
            assert_eq!(g.count(), mask.count_ones());
        }
    }

    #[test]
    fn groups_inc_incremental_add_matches_rebuild() {
        let board = Board::new();
        let mut rng = 42u64;
        for _ in 0..50 {
            let mut g = GroupsInc::new();
            let mut mask = 0u64;
            for _ in 0..40 {
                let idx = (splitmix(&mut rng) % 61) as usize;
                if (mask & bit(idx)) != 0 {
                    continue;
                }
                mask |= bit(idx);
                g.add(idx, &board);
                let rebuilt = GroupsInc::from_mask(mask, &board);
                assert_eq!(g.top2(), rebuilt.top2());
                assert_eq!(g.groups, rebuilt.groups);
            }
        }
    }
}
