use quelhas_core::{apply_move, decode_move, extract_runs, Occupancy, Run, BOARD_SIZE};

#[derive(Clone, Copy, Debug, Default)]
pub struct Metrics {
    pub min: i32,
    pub max: i32,
    pub min_excl: i32,
    pub max_excl: i32,
}

#[inline]
fn add_run_cells(mut mask: Occupancy, run: Run) -> Occupancy {
    let delta = if run.orient == 0 { BOARD_SIZE } else { 1 };
    let mut idx = run.start as usize;
    for _ in 0..(run.len as usize) {
        mask.set(idx);
        idx += delta;
    }
    mask
}

#[inline]
fn run_overlaps(mask: Occupancy, run: Run) -> bool {
    let delta = if run.orient == 0 { BOARD_SIZE } else { 1 };
    let mut idx = run.start as usize;
    for _ in 0..(run.len as usize) {
        if mask.is_set(idx) {
            return true;
        }
        idx += delta;
    }
    false
}

fn compute_metrics(occ: Occupancy, orient: u8, opp_playable_mask: Occupancy) -> Metrics {
    let runs = extract_runs(occ, orient);
    let mut m = Metrics::default();
    for r in runs {
        m.min += 1;
        m.max += (r.len as i32) / 2;
        let exclusive = !run_overlaps(opp_playable_mask, r);
        if exclusive {
            m.min_excl += 1;
            m.max_excl += (r.len as i32) / 2;
        }
    }
    m
}

pub fn evaluate_misere(occ: Occupancy, side_to_move: u8) -> i32 {
    let runs_v = extract_runs(occ, 0);
    let runs_h = extract_runs(occ, 1);

    let mut mask_v = Occupancy::default();
    let mut mask_h = Occupancy::default();
    for r in runs_v {
        mask_v = add_run_cells(mask_v, r);
    }
    for r in runs_h {
        mask_h = add_run_cells(mask_h, r);
    }

    let m_v = compute_metrics(occ, 0, mask_h);
    let m_h = compute_metrics(occ, 1, mask_v);

    let (my, opp) = if side_to_move == 0 { (m_v, m_h) } else { (m_h, m_v) };

    let mut score = 0i32;
    score += (my.max_excl - opp.max_excl) * 50;
    score += ((my.max - my.min) - (opp.max - opp.min)) * 15;
    if opp.min > 0 {
        score += opp.min * 30;
    }
    if my.max_excl >= opp.max && my.max_excl > 0 {
        score += 200;
        score += (my.max_excl - opp.max) * 25;
    }

    let total_max = my.max + opp.max;
    if total_max <= 10 {
        if opp.min_excl == 0 && my.min_excl > 0 {
            score += 150;
        }
        if opp.min > my.min {
            score += (opp.min - my.min) * 40;
        }
    }

    if my.max_excl <= opp.max {
        score -= my.min * 10;
    }

    let eff_opp = if opp.min > 0 { (opp.max as f64) / (opp.min as f64) } else { 0.0 };
    let eff_my = if my.min > 0 { (my.max as f64) / (my.min as f64) } else { 0.0 };
    score += ((eff_my - eff_opp) * 10.0) as i32;

    // pequena penalização por jogadas demasiado longas no imediato (mais controlo)
    // (usado indiretamente no ordering em TS; aqui só influencia folhas)
    score
}

pub fn cheap_move_score(occ: Occupancy, mv: u16, side_to_move: u8) -> i32 {
    let child = apply_move(occ, mv);
    // se o adversário ficar sem jogadas, é derrota imediata (misère)
    let opp = 1u8 - side_to_move;
    let opp_moves = quelhas_core::generate_moves_dynamic(child, opp);
    if opp_moves.is_empty() {
        return -1_000_000;
    }
    // score aproximado: avaliação do nó filho do ponto de vista de quem joga agora (adversário)
    -evaluate_misere(child, opp)
}

