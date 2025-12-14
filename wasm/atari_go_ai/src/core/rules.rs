use super::board::{Board, CELLS, FULL_MASK};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Color {
    Black = 0,
    White = 1,
}

impl Color {
    #[inline]
    pub fn other(self) -> Self {
        match self {
            Color::Black => Color::White,
            Color::White => Color::Black,
        }
    }
}

#[derive(Clone, Copy)]
pub struct State {
    pub black: u128,
    pub white: u128,
    pub to_play: Color,
    pub hash: u64,
}

impl State {
    #[inline]
    pub fn occupied(self) -> u128 {
        self.black | self.white
    }

    #[inline]
    pub fn empty(self) -> u128 {
        FULL_MASK & !self.occupied()
    }

    #[inline]
    pub fn stones(self, c: Color) -> u128 {
        match c {
            Color::Black => self.black,
            Color::White => self.white,
        }
    }
}

#[derive(Clone, Copy)]
pub struct MoveResult {
    pub legal: bool,
    pub captured: u8,
    pub winner: Option<Color>,
}

#[inline]
fn pop_lsb(bits: u128) -> (u128, u32) {
    let lsb = bits & bits.wrapping_neg();
    let idx = lsb.trailing_zeros();
    (lsb, idx)
}

pub fn group_bits(stones: u128, start_bit: u128, board: &Board) -> u128 {
    let mut group = 0u128;
    let mut stack = start_bit;
    while stack != 0 {
        let (bit, idx) = pop_lsb(stack);
        stack ^= bit;
        if (group & bit) != 0 {
            continue;
        }
        group |= bit;
        let n = board.neigh[idx as usize] & stones;
        stack |= n & !group;
    }
    group
}

pub fn liberties_bits(group: u128, empty: u128, board: &Board) -> u128 {
    let mut neigh_union = 0u128;
    let mut tmp = group;
    while tmp != 0 {
        let (bit, idx) = pop_lsb(tmp);
        tmp ^= bit;
        neigh_union |= board.neigh[idx as usize];
    }
    neigh_union & empty
}

pub fn apply_move(
    st: State,
    idx: u8,
    board: &Board,
    zobrist_stone: &[[u64; CELLS]; 2],
    zobrist_to_play: u64,
) -> (State, MoveResult) {
    let bit = 1u128 << (idx as usize);
    let occ = st.occupied();
    if (occ & bit) != 0 {
        return (
            st,
            MoveResult {
                legal: false,
                captured: 0,
                winner: None,
            },
        );
    }

    let me = st.to_play;
    let opp = me.other();

    let mut black = st.black;
    let mut white = st.white;
    let mut hash = st.hash;

    // Place stone
    match me {
        Color::Black => black |= bit,
        Color::White => white |= bit,
    }
    hash ^= zobrist_stone[me as usize][idx as usize];

    let mut captured_bits = 0u128;
    let mut seen = 0u128;
    let opp_stones_before = st.stones(opp);
    let neigh = board.neigh[idx as usize];
    let mut adj_opp = neigh & opp_stones_before;

    // Captures: check adjacent opponent groups
    while adj_opp != 0 {
        let (b2, _i2) = pop_lsb(adj_opp);
        adj_opp ^= b2;
        if (seen & b2) != 0 {
            continue;
        }
        let grp = group_bits(opp_stones_before, b2, board);
        seen |= grp;

        let empty_after_place = FULL_MASK & !(black | white);
        let libs = liberties_bits(grp, empty_after_place, board);
        if libs == 0 {
            captured_bits |= grp;
        }
    }

    if captured_bits != 0 {
        // Remove captured stones
        match opp {
            Color::Black => black &= !captured_bits,
            Color::White => white &= !captured_bits,
        }
        // Update hash for removed stones
        let mut tmp = captured_bits;
        while tmp != 0 {
            let (b2, i2) = pop_lsb(tmp);
            tmp ^= b2;
            hash ^= zobrist_stone[opp as usize][i2 as usize];
        }
    } else {
        // Suicide check (illegal if no capture and our resulting group has no liberties)
        let my_stones = match me {
            Color::Black => black,
            Color::White => white,
        };
        let grp = group_bits(my_stones, bit, board);
        let empty_after_place = FULL_MASK & !(black | white);
        let libs = liberties_bits(grp, empty_after_place, board);
        if libs == 0 {
            return (
                st,
                MoveResult {
                    legal: false,
                    captured: 0,
                    winner: None,
                },
            );
        }
    }

    // Switch side
    let mut to_play = opp;
    hash ^= zobrist_to_play;

    // Atari Go: first capture wins immediately (by the player who just moved)
    let winner = if captured_bits != 0 { Some(me) } else { None };

    // If capture happened, game ends; still return state with to_play switched (not used by search)
    if winner.is_some() {
        to_play = opp;
    }

    let captured = captured_bits.count_ones() as u8;
    (
        State {
            black,
            white,
            to_play,
            hash,
        },
        MoveResult {
            legal: true,
            captured,
            winner,
        },
    )
}

pub fn legal_moves(
    st: State,
    board: &Board,
    zobrist_stone: &[[u64; CELLS]; 2],
    zobrist_to_play: u64,
) -> (Vec<u8>, bool) {
    let mut out = Vec::new();
    let mut captures = Vec::new();
    let empty = st.empty();
    let mut tmp = empty;
    while tmp != 0 {
        let (bit, idx) = pop_lsb(tmp);
        tmp ^= bit;
        let (_nst, res) = apply_move(st, idx as u8, board, zobrist_stone, zobrist_to_play);
        if res.legal {
            if res.winner.is_some() {
                // In Atari Go, any capturing move is immediately winning; keep only captures.
                captures.push(idx as u8);
            } else {
                out.push(idx as u8);
            }
        }
    }
    if !captures.is_empty() {
        (captures, true)
    } else {
        (out, false)
    }
}
