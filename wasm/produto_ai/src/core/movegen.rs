use super::board::{bit, Board, CELLS, FULL_MASK};
use super::groups::component_ids;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stone {
    Black = 0,
    White = 1,
}

#[derive(Clone, Copy, Debug)]
pub struct Move {
    pub pos_a: u8,
    pub color_a: Stone,
    pub pos_b: i8, // -1 = none (opening)
    pub color_b: Stone,
}

#[derive(Clone, Copy, Debug)]
pub struct StateView {
    pub black: u64,
    pub white: u64,
    pub player_to_move: Stone, // home color of the current player
    pub first_move: bool,
}

pub fn empty_mask(state: StateView) -> u64 {
    FULL_MASK & !(state.black | state.white)
}

pub fn is_empty(state: StateView, idx: usize) -> bool {
    (empty_mask(state) & bit(idx)) != 0
}

pub fn apply_move(state: StateView, mv: Move) -> Option<StateView> {
    let mut black = state.black;
    let mut white = state.white;
    let mut occupied = black | white;

    let a = mv.pos_a as usize;
    if (occupied & bit(a)) != 0 {
        return None;
    }

    match mv.color_a {
        Stone::Black => black |= bit(a),
        Stone::White => white |= bit(a),
    }
    occupied |= bit(a);

    let mut first_move = state.first_move;

    if !first_move {
        if mv.pos_b < 0 {
            return None;
        }
        let b = mv.pos_b as usize;
        if a == b || (occupied & bit(b)) != 0 {
            return None;
        }
        match mv.color_b {
            Stone::Black => black |= bit(b),
            Stone::White => white |= bit(b),
        }
    } else {
        // opening: only one stone
        first_move = false;
    }

    let next_player = match state.player_to_move {
        Stone::Black => Stone::White,
        Stone::White => Stone::Black,
    };

    Some(StateView {
        black,
        white,
        player_to_move: next_player,
        first_move,
    })
}

fn scored_empty_candidates(state: StateView, board: &Board, max_k: usize) -> Vec<u8> {
    let empty = empty_mask(state);
    if empty == 0 {
        return Vec::new();
    }

    let mut scores: Vec<(u16, u8)> = Vec::new();

    // 1) Adjacent to any occupied stone
    let occupied = state.black | state.white;
    let mut frontier = 0u64;
    let mut occ = occupied;
    while occ != 0 {
        let idx = occ.trailing_zeros() as usize;
        occ &= !bit(idx);
        frontier |= board.neighbours[idx];
    }
    frontier &= empty;

    // 2) Bridges for both colors (empty touching >=2 components)
    let ids_black = component_ids(state.black, board);
    let ids_white = component_ids(state.white, board);
    let mut bridges = 0u64;
    for idx in 0..CELLS {
        if (empty & bit(idx)) == 0 {
            continue;
        }
        let neigh = board.neighbours[idx];
        let mut uniq_b = [0u8; 6];
        let mut cb = 0usize;
        let mut tmp = neigh & state.black;
        while tmp != 0 && cb < 6 {
            let j = tmp.trailing_zeros() as usize;
            tmp &= !bit(j);
            let id = ids_black[j];
            if id == 0 {
                continue;
            }
            if !uniq_b[..cb].contains(&id) {
                uniq_b[cb] = id;
                cb += 1;
            }
        }
        let mut uniq_w = [0u8; 6];
        let mut cw = 0usize;
        let mut tmpw = neigh & state.white;
        while tmpw != 0 && cw < 6 {
            let j = tmpw.trailing_zeros() as usize;
            tmpw &= !bit(j);
            let id = ids_white[j];
            if id == 0 {
                continue;
            }
            if !uniq_w[..cw].contains(&id) {
                uniq_w[cw] = id;
                cw += 1;
            }
        }
        if cb >= 2 || cw >= 2 {
            bridges |= bit(idx);
        }
    }

    let candidates = frontier | bridges;
    let mut cand = candidates;
    while cand != 0 {
        let idx = cand.trailing_zeros() as usize;
        cand &= !bit(idx);
        let neigh = board.neighbours[idx];
        let adj_count = (neigh & occupied).count_ones() as u16;
        let bridge_bonus = if (bridges & bit(idx)) != 0 { 10 } else { 0 };
        scores.push((adj_count + bridge_bonus, idx as u8));
    }

    // If too few, add all empties with low score.
    if scores.len() < max_k {
        let mut all = empty & !candidates;
        while all != 0 {
            let idx = all.trailing_zeros() as usize;
            all &= !bit(idx);
            scores.push((0, idx as u8));
        }
    }

    scores.sort_unstable_by(|a, b| b.0.cmp(&a.0));
    scores.truncate(max_k.min(scores.len()));
    scores.into_iter().map(|(_, idx)| idx).collect()
}

pub fn generate_candidate_moves(
    state: StateView,
    board: &Board,
    candidate_k: usize,
) -> Vec<Move> {
    let empty = empty_mask(state);
    if empty == 0 {
        return Vec::new();
    }

    let candidates = scored_empty_candidates(state, board, candidate_k.max(6));
    if candidates.is_empty() {
        return Vec::new();
    }

    let colors = [Stone::Black, Stone::White];
    let mut moves = Vec::new();

    if state.first_move {
        for &pos in &candidates {
            for &c in &colors {
                moves.push(Move {
                    pos_a: pos,
                    color_a: c,
                    pos_b: -1,
                    color_b: c,
                });
            }
        }
        return moves;
    }

    for i in 0..candidates.len() {
        for j in (i + 1)..candidates.len() {
            let a = candidates[i];
            let b = candidates[j];
            for &c1 in &colors {
                for &c2 in &colors {
                    moves.push(Move {
                        pos_a: a,
                        color_a: c1,
                        pos_b: b as i8,
                        color_b: c2,
                    });
                }
            }
        }
    }

    // Safety: avoid returning empty even if candidate_k was too small
    if moves.is_empty() && !state.first_move {
        let mut empties = Vec::new();
        let mut tmp = empty;
        while tmp != 0 {
            let idx = tmp.trailing_zeros() as usize;
            tmp &= !bit(idx);
            empties.push(idx as u8);
        }
        if empties.len() >= 2 {
            let a = empties[0];
            let b = empties[1];
            moves.push(Move {
                pos_a: a,
                color_a: Stone::Black,
                pos_b: b as i8,
                color_b: Stone::Black,
            });
        }
    }

    moves
}

