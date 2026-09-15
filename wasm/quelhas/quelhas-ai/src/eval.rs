use quelhas_core::{apply_move, extract_runs, Occupancy, Run, BOARD_SIZE};

/// Turn capacities of today's runs without interference. Shared runs can be
/// split or removed. protected_min alone is an unavoidable lower bound on work.
#[derive(Clone, Copy, Debug, Default)]
pub struct Metrics {
    pub min: i32,
    pub max: i32,
    pub min_excl: i32,
    pub max_excl: i32,
    pub protected_min: i32,
}

fn playable_mask(runs: &[Run]) -> Occupancy {
    let mut mask = Occupancy::default();
    for run in runs {
        let delta = if run.orient == 0 { BOARD_SIZE } else { 1 };
        for offset in 0..run.len as usize {
            mask.set(run.start as usize + offset * delta);
        }
    }
    mask
}

fn count_turns(runs: &[Run], opponent_mask: Occupancy) -> Metrics {
    let mut counts = Metrics::default();
    for run in runs {
        counts.min += 1;
        counts.max += run.len as i32 / 2;
        let delta = if run.orient == 0 { BOARD_SIZE } else { 1 };
        let protected = |offset: usize| !opponent_mask.is_set(run.start as usize + offset * delta);
        if (0..run.len as usize).all(protected) {
            counts.min_excl += 1;
            counts.max_excl += run.len as i32 / 2;
        }
        if (1..run.len as usize).any(|offset| protected(offset - 1) && protected(offset)) {
            counts.protected_min += 1;
        }
    }
    counts
}

pub fn analyze_turn_counts(occ: Occupancy) -> [Metrics; 2] {
    let vertical = extract_runs(occ, 0);
    let horizontal = extract_runs(occ, 1);
    [
        count_turns(&vertical, playable_mask(&horizontal)),
        count_turns(&horizontal, playable_mask(&vertical)),
    ]
}

pub fn tempo_outcome(my: Metrics, opp: Metrics) -> Option<bool> {
    if my.max == 0 {
        return Some(true);
    }
    if opp.max == 0 {
        return Some(false);
    }
    // Independent runs: both players can empty one whole run per turn.
    // The first player wins ties because the opponent must take their turn.
    if my.min == my.min_excl && opp.min == opp.min_excl {
        return Some(my.min <= opp.min);
    }
    if my.max <= opp.protected_min {
        return Some(true);
    }
    if opp.max < my.protected_min {
        return Some(false);
    }
    None
}

pub fn evaluate_misere(occ: Occupancy, side_to_move: u8) -> i32 {
    let counts = analyze_turn_counts(occ);
    let my = counts[side_to_move as usize];
    let opp = counts[(1 - side_to_move) as usize];
    if let Some(win) = tempo_outcome(my, opp) {
        return if win { 90_000 } else { -90_000 };
    }
    // Positive is favourable for the player to move: exhaust one's own work
    // sooner, leave work to the opponent. No proof from total-move parity.
    (opp.min - my.min) * 200
        + (opp.max - my.max) * 40
        + (opp.protected_min - my.protected_min) * 160
        + ((my.max - my.min) - (opp.max - opp.min)) * 20
}

pub fn evaluate_search_leaf(occ: Occupancy, side_to_move: u8) -> i32 {
    evaluate_misere(occ, side_to_move)
}

pub fn cheap_move_score(occ: Occupancy, mv: u16, side_to_move: u8) -> i32 {
    let child = apply_move(occ, mv);
    let opp = 1 - side_to_move;
    if extract_runs(child, opp).is_empty() {
        return -1_000_000;
    }
    -evaluate_search_leaf(child, opp)
}
