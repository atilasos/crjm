pub const BOARD_SIZE: usize = 10;
pub const CELL_COUNT: usize = BOARD_SIZE * BOARD_SIZE;
pub const MIN_LEN: usize = 2;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Occupancy {
    pub low: u64,
    pub high: u64,
}

impl Occupancy {
    #[inline]
    pub fn is_set(&self, idx: usize) -> bool {
        debug_assert!(idx < 128);
        if idx < 64 {
            (self.low & (1u64 << idx)) != 0
        } else {
            (self.high & (1u64 << (idx - 64))) != 0
        }
    }

    #[inline]
    pub fn set(&mut self, idx: usize) {
        debug_assert!(idx < 128);
        if idx < 64 {
            self.low |= 1u64 << idx;
        } else {
            self.high |= 1u64 << (idx - 64);
        }
    }

    #[inline]
    pub fn from_u32_parts(low_lo: u32, low_hi: u32, high_lo: u32, high_hi: u32) -> Self {
        let low = (low_hi as u64) << 32 | (low_lo as u64);
        let high = (high_hi as u64) << 32 | (high_lo as u64);
        Self { low, high }
    }
}

// Move encoding: start(0..127) | (len<<7) | (orient<<11)
// orient: 0 = vertical, 1 = horizontal
pub type EncMove = u16;

#[inline]
pub fn encode_move(start: u8, len: u8, orient: u8) -> EncMove {
    (start as u16) | ((len as u16) << 7) | ((orient as u16) << 11)
}

#[inline]
pub fn decode_move(m: EncMove) -> (u8, u8, u8) {
    let start = (m & 0x7f) as u8;
    let len = ((m >> 7) & 0x0f) as u8;
    let orient = ((m >> 11) & 0x01) as u8;
    (start, len, orient)
}

#[inline]
pub fn apply_move(mut occ: Occupancy, m: EncMove) -> Occupancy {
    let (start, len, orient) = decode_move(m);
    let delta = if orient == 0 { BOARD_SIZE } else { 1 };
    let mut idx = start as usize;
    for _ in 0..(len as usize) {
        occ.set(idx);
        idx += delta;
    }
    occ
}

#[derive(Clone, Copy, Debug)]
pub struct Run {
    pub start: u8,
    pub len: u8,
    pub orient: u8,
}

pub fn extract_runs(occ: Occupancy, orient: u8) -> Vec<Run> {
    let mut runs = Vec::new();
    if orient == 0 {
        for c in 0..BOARD_SIZE {
            let mut start_row: i32 = -1;
            for r in 0..=BOARD_SIZE {
                let idx = r * BOARD_SIZE + c;
                let empty = r < BOARD_SIZE && !occ.is_set(idx);
                if empty && start_row == -1 {
                    start_row = r as i32;
                } else if !empty && start_row != -1 {
                    let len = (r as i32 - start_row) as usize;
                    if len >= MIN_LEN {
                        runs.push(Run {
                            start: (start_row as usize * BOARD_SIZE + c) as u8,
                            len: len as u8,
                            orient,
                        });
                    }
                    start_row = -1;
                }
            }
        }
    } else {
        for r in 0..BOARD_SIZE {
            let mut start_col: i32 = -1;
            for c in 0..=BOARD_SIZE {
                let idx = r * BOARD_SIZE + c;
                let empty = c < BOARD_SIZE && !occ.is_set(idx);
                if empty && start_col == -1 {
                    start_col = c as i32;
                } else if !empty && start_col != -1 {
                    let len = (c as i32 - start_col) as usize;
                    if len >= MIN_LEN {
                        runs.push(Run {
                            start: (r * BOARD_SIZE + start_col as usize) as u8,
                            len: len as u8,
                            orient,
                        });
                    }
                    start_col = -1;
                }
            }
        }
    }
    runs
}

pub fn estimate_moves_from_runs(runs: &[Run]) -> u32 {
    let mut total: u32 = 0;
    for run in runs {
        let l = run.len as u32;
        total += l * (l - 1) / 2;
    }
    total
}

pub fn generate_all_moves(occ: Occupancy, orient: u8) -> Vec<EncMove> {
    let runs = extract_runs(occ, orient);
    let delta = if orient == 0 { BOARD_SIZE } else { 1 };
    let mut moves = Vec::new();
    for run in runs {
        let base = run.start as usize;
        let l = run.len as usize;
        for len in MIN_LEN..=l {
            for off in 0..=(l - len) {
                let start = (base + off * delta) as u8;
                moves.push(encode_move(start, len as u8, orient));
            }
        }
    }
    moves
}

pub fn generate_candidate_moves(occ: Occupancy, orient: u8) -> Vec<EncMove> {
    let runs = extract_runs(occ, orient);
    let delta = if orient == 0 { BOARD_SIZE } else { 1 };

    let mut moves = Vec::new();
    let mut seen = std::collections::HashSet::<EncMove>::new();

    let mut add = |start: usize, len: usize| {
        if len < MIN_LEN {
            return;
        }
        let m = encode_move(start as u8, len as u8, orient);
        if seen.insert(m) {
            moves.push(m);
        }
    };

    let split_score = |l: usize, offset: usize, len: usize| -> f64 {
        let left = offset;
        let right = l - (offset + len);
        let left_good = if left >= 2 { 1.0 } else { 0.0 };
        let right_good = if right >= 2 { 1.0 } else { 0.0 };
        let wasted = (if left == 1 { 1.0 } else { 0.0 }) + (if right == 1 { 1.0 } else { 0.0 });
        10.0 * (left_good + right_good) - 3.0 * wasted - ((left as f64 - right as f64).abs()) * 0.2
    };

    for run in runs {
        let base = run.start as usize;
        let l = run.len as usize;

        if l <= 6 {
            for len in MIN_LEN..=l {
                for off in 0..=(l - len) {
                    add(base + off * delta, len);
                }
            }
            continue;
        }

        for len in [2usize, 3usize] {
            if len > l {
                continue;
            }
            add(base, len);
            add(base + (l - len) * delta, len);
        }

        add(base, l);
        if l >= 3 {
            add(base, l - 1);
            add(base + 1 * delta, l - 1);
        }

        let mut best: Option<(f64, usize, usize)> = None;
        for len in [2usize, 3usize, 4usize] {
            if len > l {
                continue;
            }
            let center = (l - len) / 2;
            for off in [center.saturating_sub(1), center, (center + 1).min(l - len)] {
                if off > l - len {
                    continue;
                }
                let sc = split_score(l, off, len);
                if best.is_none() || sc > best.unwrap().0 {
                    best = Some((sc, off, len));
                }
            }
        }
        if let Some((_, off, len)) = best {
            add(base + off * delta, len);
        }

        let samples = [
            0usize,
            l / 4,
            l / 2,
            (3 * l) / 4,
            l.saturating_sub(2),
        ];
        for off in samples {
            for len in [2usize, 3usize, 4usize] {
                if len > l {
                    continue;
                }
                if off > l - len {
                    continue;
                }
                add(base + off * delta, len);
            }
        }
    }

    moves
}

pub fn generate_moves_dynamic(occ: Occupancy, orient: u8) -> Vec<EncMove> {
    let runs = extract_runs(occ, orient);
    if runs.is_empty() {
        return Vec::new();
    }
    let est = estimate_moves_from_runs(&runs);
    if est <= 220 {
        generate_all_moves(occ, orient)
    } else {
        generate_candidate_moves(occ, orient)
    }
}

