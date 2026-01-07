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

    // Casos terminais misère:
    // - Se eu não tenho jogadas, eu ganho (não posso jogar).
    // - Se o adversário não tem jogadas e eu tenho, sou forçado a jogar = perco.
    if my.min == 0 {
        return 100_000;
    }
    if opp.min == 0 {
        return -100_000;
    }

    // ========== ANÁLISE DE PARIDADE MISÈRE ==========
    //
    // Em misère com jogadas alternadas:
    // - Quem faz a última jogada PERDE
    // - Cada jogador pode escolher entre min e max jogadas (flexibilidade)
    // - O objetivo é forçar o adversário a fazer a última jogada
    //
    // Chave: Se eu tenho flexibilidade (max > min), posso CONTROLAR a paridade
    // do total de jogadas para forçar o adversário a ser o último.

    let my_flex = my.max - my.min;   // Quantas jogadas extra posso escolher fazer
    let opp_flex = opp.max - opp.min; // Quantas jogadas extra o adversário pode fazer

    let mut score = 0i32;

    // 1. CONTROLO ABSOLUTO: Se minhas exclusivas cobrem todas as jogadas possíveis do adversário
    if my.max_excl >= opp.max && my.max_excl > 0 {
        // Posição dominante: posso acompanhar todas as jogadas do adversário
        let controlo = my.max_excl - opp.max;
        score += 8000 + controlo * 500;
    }
    // Se o adversário tem este controlo sobre mim
    else if opp.max_excl >= my.max && opp.max_excl > 0 {
        let controlo_adv = opp.max_excl - my.max;
        score -= 8000 + controlo_adv * 500;
    }

    // 2. ANÁLISE DE PARIDADE PARA ENDGAME
    let total_max = my.max + opp.max;
    let total_min = my.min + opp.min;

    if total_max <= 20 {
        // Cálculo de paridade: Em jogadas alternadas (eu primeiro),
        // se o total for PAR, o adversário faz a última = EU GANHO
        // se o total for ÍMPAR, eu faço a última = EU PERCO

        // Se posso escolher qualquer paridade e adversário não pode compensar
        if my_flex > opp_flex {
            // Eu controlo a paridade - posição vantajosa
            score += 3000 + (my_flex - opp_flex) * 200;
        } else if opp_flex > my_flex {
            // Adversário controla a paridade
            score -= 3000 + (opp_flex - my_flex) * 200;
        } else {
            // Mesma flexibilidade - quem joga primeiro pode ter desvantagem
            if my_flex == 0 && opp_flex == 0 {
                if total_min % 2 == 1 {
                    score -= 2000; // Total ímpar, eu jogo primeiro = eu faço última = perco
                } else {
                    score += 2000; // Total par = adversário faz última = ganho
                }
            }
        }

        // 3. PRESSÃO DE TEMPO: Comparar jogadas mínimas obrigatórias
        if opp.min > my.min {
            score += (opp.min - my.min) * 400;
        } else if my.min > opp.min {
            score -= (my.min - opp.min) * 400;
        }

        // 4. ZONAS EXCLUSIVAS COMO RESERVA
        if my.min_excl > 0 && opp.min_excl == 0 {
            score += 2500;
        } else if opp.min_excl > 0 && my.min_excl == 0 {
            score -= 2500;
        }
    }

    // 5. HEURÍSTICAS GERAIS (para posições mais abertas)
    // Reserva exclusiva como "banco de tempo"
    score += (my.max_excl - opp.max_excl) * 80;

    // Flexibilidade é valiosa em misère
    score += (my_flex - opp_flex) * 60;

    // Eficiência dos blocos (blocos maiores = mais opções)
    let eff_opp = if opp.min > 0 { (opp.max as f64) / (opp.min as f64) } else { 0.0 };
    let eff_my = if my.min > 0 { (my.max as f64) / (my.min as f64) } else { 0.0 };
    score += ((eff_my - eff_opp) * 30.0) as i32;

    // Penalizar ter muitas jogadas forçadas sem controlo
    if my.max_excl < opp.max {
        score -= my.min * 20;
    }

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
