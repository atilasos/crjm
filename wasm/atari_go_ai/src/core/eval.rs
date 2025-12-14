use super::board::Board;
use super::rules::{group_bits, liberties_bits, State};

fn neighbor_union(stones: u128, board: &Board) -> u128 {
    let mut u = 0u128;
    let mut tmp = stones;
    while tmp != 0 {
        let lsb = tmp & tmp.wrapping_neg();
        tmp ^= lsb;
        let idx = lsb.trailing_zeros() as usize;
        u |= board.neigh[idx];
    }
    u
}

fn count_groups_in_atari(stones: u128, empty: u128, board: &Board) -> u32 {
    let mut remaining = stones;
    let mut count = 0u32;
    while remaining != 0 {
        let lsb = remaining & remaining.wrapping_neg();
        let grp = group_bits(stones, lsb, board);
        remaining &= !grp;
        let libs = liberties_bits(grp, empty, board).count_ones();
        if libs == 1 {
            count += 1;
        }
    }
    count
}

pub fn evaluate(st: State, board: &Board) -> i32 {
    let me = st.to_play;
    let opp = me.other();
    let empty = st.empty();

    let my_stones = st.stones(me);
    let opp_stones = st.stones(opp);

    // Primary: liberties (cheap approximation, union of adjacent empties)
    let my_lib = (neighbor_union(my_stones, board) & empty).count_ones() as i32;
    let opp_lib = (neighbor_union(opp_stones, board) & empty).count_ones() as i32;

    // Tactical: number of groups in atari (1 liberty)
    let my_atari = count_groups_in_atari(my_stones, empty, board) as i32;
    let opp_atari = count_groups_in_atari(opp_stones, empty, board) as i32;

    // Light shape: centrality (prefer being closer to center early)
    let mut center_bonus = 0i32;
    let mut tmp = my_stones;
    while tmp != 0 {
        let lsb = tmp & tmp.wrapping_neg();
        tmp ^= lsb;
        let idx = lsb.trailing_zeros() as usize;
        center_bonus -= board.dist_center[idx] as i32;
    }

    120 * (my_lib - opp_lib) + 200 * (opp_atari - my_atari) + center_bonus
}
