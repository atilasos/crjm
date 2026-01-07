use super::board::Board;
use super::rules::{group_bits, liberties_bits, State};

/// Count total liberties across all groups (actual group liberties, not stone-by-stone)
fn count_actual_liberties(stones: u128, empty: u128, board: &Board) -> (i32, i32, i32) {
    let mut remaining = stones;
    let mut total_libs = 0i32;
    let mut atari_count = 0i32;  // Groups with 1 liberty (can be captured)
    let mut threat_count = 0i32; // Groups with 2 liberties (near-atari)

    while remaining != 0 {
        let lsb = remaining & remaining.wrapping_neg();
        let grp = group_bits(stones, lsb, board);
        remaining &= !grp;

        let libs = liberties_bits(grp, empty, board).count_ones() as i32;
        total_libs += libs;

        if libs == 1 {
            atari_count += 1;
        } else if libs == 2 {
            threat_count += 1;
        }
    }

    (total_libs, atari_count, threat_count)
}

/// Count connected groups
fn count_groups(stones: u128, board: &Board) -> i32 {
    let mut remaining = stones;
    let mut count = 0i32;

    while remaining != 0 {
        let lsb = remaining & remaining.wrapping_neg();
        let grp = group_bits(stones, lsb, board);
        remaining &= !grp;
        count += 1;
    }

    count
}

pub fn evaluate(st: State, board: &Board) -> i32 {
    let me = st.to_play;
    let opp = me.other();
    let empty = st.empty();

    let my_stones = st.stones(me);
    let opp_stones = st.stones(opp);

    // Actual group-based liberty counting (more accurate than neighbor union)
    let (my_libs, my_atari, my_threat) = count_actual_liberties(my_stones, empty, board);
    let (opp_libs, opp_atari, opp_threat) = count_actual_liberties(opp_stones, empty, board);

    // Group count (fewer groups is generally better - more connected)
    let my_groups = count_groups(my_stones, board);
    let opp_groups = count_groups(opp_stones, board);

    // Centrality and edge control
    let mut center_bonus = 0i32;
    let mut my_edge_count = 0i32;
    let mut tmp = my_stones;
    while tmp != 0 {
        let lsb = tmp & tmp.wrapping_neg();
        tmp ^= lsb;
        let idx = lsb.trailing_zeros() as usize;
        let dist = board.dist_center[idx] as i32;
        center_bonus -= dist * 3; // Increased from 1
        // Edge penalty (dist_center of 4 = corner)
        if dist >= 3 {
            my_edge_count += 1;
        }
    }

    // Opponent edge exposure (good for us if they have edge stones)
    let mut opp_edge_count = 0i32;
    let mut tmp = opp_stones;
    while tmp != 0 {
        let lsb = tmp & tmp.wrapping_neg();
        tmp ^= lsb;
        let idx = lsb.trailing_zeros() as usize;
        if board.dist_center[idx] >= 3 {
            opp_edge_count += 1;
        }
    }

    // Scoring weights
    let lib_score = 100 * (my_libs - opp_libs);          // Liberty advantage
    let atari_score = 300 * (opp_atari - my_atari);      // Atari advantage (increased from 200)
    let threat_score = 100 * (opp_threat - my_threat);   // Near-atari advantage
    let group_score = 25 * (opp_groups - my_groups);     // Connectivity bonus
    let edge_score = 15 * (opp_edge_count - my_edge_count); // Edge exposure

    lib_score + atari_score + threat_score + group_score + center_bonus + edge_score
}
