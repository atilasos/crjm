use super::board::Board;
use super::eval::evaluate;
use super::rules::{apply_move, legal_moves, State};
use super::tt::{TTEntry, TranspositionTable};

const INF: i32 = 30000;
const WIN: i32 = 29000;

#[derive(Clone, Copy)]
pub struct SearchConfig {
    pub max_depth: u8,
    pub use_tt: bool,
    pub use_pvs: bool,
    pub noise_top_k: u8,
    pub noise_delta: i32,
}

#[derive(Default, Clone, Copy)]
pub struct SearchStats {
    pub nodes: u64,
    pub depth: u8,
    pub tt_hits: u64,
    pub tt_probes: u64,
    pub cutoffs: u64,
    pub elapsed_ms: u32,
    /// Sinal interno para propagar o deadline por toda a árvore sem guardar
    /// resultados parciais na TT. Não faz parte do payload público do WASM.
    pub timed_out: bool,
}

fn clamp_i16(v: i32) -> i16 {
    v.clamp(i16::MIN as i32, i16::MAX as i32) as i16
}

fn tt_flag(value: i32, alpha0: i32, beta: i32) -> u8 {
    if value <= alpha0 {
        2 // upper
    } else if value >= beta {
        1 // lower
    } else {
        0 // exact
    }
}

fn order_moves_simple(moves: &mut [u8], board: &Board) {
    moves.sort_by_key(|&m| board.dist_center[m as usize]);
}

pub fn search_best_move(
    root: State,
    time_ms: u32,
    cfg: SearchConfig,
    board: &Board,
    tt: &mut TranspositionTable,
    zobrist_stone: &[[u64; 81]; 2],
    zobrist_to_play: u64,
    now_ms: impl Fn() -> f64,
    noise_selector: u64,
) -> (i32, u8, SearchStats) {
    let start = now_ms();
    let deadline = start + (time_ms as f64);

    let mut stats = SearchStats::default();
    let mut best_score: i32 = -INF;

    // Root legal moves (captures short-circuit)
    let (mut moves, has_capture) = legal_moves(root, board, zobrist_stone, zobrist_to_play);
    if moves.is_empty() {
        stats.elapsed_ms = (now_ms() - start) as u32;
        return (0, 0, stats);
    }

    if has_capture {
        let m = moves[0];
        stats.depth = 1;
        stats.nodes = 1;
        stats.elapsed_ms = (now_ms() - start) as u32;
        return (WIN, m, stats);
    }

    order_moves_simple(&mut moves, board);
    // Mesmo que o budget termine antes de completar profundidade 1, a API
    // tem sempre de devolver uma jogada legal.
    let mut best_move = moves[0];

    let mut pv_move: Option<u8> = None;
    let mut aspiration = 250;

    for depth in 1..=cfg.max_depth {
        if now_ms() >= deadline {
            break;
        }

        let mut alpha = -INF;
        let mut beta = INF;
        if depth > 1 {
            alpha = best_score - aspiration;
            beta = best_score + aspiration;
        }

        let (score, mv, completed) = root_search(
            root,
            depth,
            alpha,
            beta,
            &moves,
            pv_move,
            cfg,
            board,
            tt,
            zobrist_stone,
            zobrist_to_play,
            &mut stats,
            deadline,
            &now_ms,
        );

        if !completed {
            break;
        }

        // Aspiration re-search if outside window
        let (score, mv) = if score <= alpha || score >= beta {
            aspiration *= 2;
            let (s2, m2, completed2) = root_search(
                root,
                depth,
                -INF,
                INF,
                &moves,
                pv_move,
                cfg,
                board,
                tt,
                zobrist_stone,
                zobrist_to_play,
                &mut stats,
                deadline,
                &now_ms,
            );
            if !completed2 {
                break;
            }
            (s2, m2)
        } else {
            aspiration = aspiration.max(60).min(500);
            (score, mv)
        };

        best_score = score;
        best_move = mv;
        pv_move = Some(mv);
        stats.depth = depth;
    }

    // Noise for low levels: pick among top-k by 1-ply re-score around root (deterministic).
    if cfg.noise_top_k > 1 && moves.len() > 1 {
        let k = cfg.noise_top_k.min(moves.len() as u8) as usize;
        let mut scored: Vec<(i32, u8)> = Vec::with_capacity(k);
        for &m in moves.iter().take(k) {
            let (nst, res) = apply_move(root, m, board, zobrist_stone, zobrist_to_play);
            if !res.legal {
                continue;
            }
            let s = if res.winner.is_some() {
                WIN
            } else {
                -evaluate(nst, board)
            };
            scored.push((s, m));
        }
        scored.sort_by(|a, b| b.0.cmp(&a.0));
        if let Some(&(top, _)) = scored.first() {
            let candidates: Vec<(i32, u8)> = scored
                .into_iter()
                .filter(|(s, _)| top - *s <= cfg.noise_delta)
                .collect();
            if !candidates.is_empty() {
                let idx = (noise_selector as usize) % candidates.len();
                best_move = candidates[idx].1;
                best_score = candidates[idx].0;
            }
        }
    }

    stats.elapsed_ms = (now_ms() - start) as u32;
    stats.tt_hits = tt.hits;
    stats.tt_probes = tt.probes;
    (best_score, best_move, stats)
}

fn root_search(
    root: State,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    moves: &[u8],
    pv_move: Option<u8>,
    cfg: SearchConfig,
    board: &Board,
    tt: &mut TranspositionTable,
    zobrist_stone: &[[u64; 81]; 2],
    zobrist_to_play: u64,
    stats: &mut SearchStats,
    deadline: f64,
    now_ms: &impl Fn() -> f64,
) -> (i32, u8, bool) {
    let alpha0 = alpha;

    // Move order: PV first if known
    let mut ordered: Vec<u8> = Vec::with_capacity(moves.len());
    if let Some(pv) = pv_move {
        if moves.contains(&pv) {
            ordered.push(pv);
        }
    }
    for &m in moves {
        if Some(m) != pv_move {
            ordered.push(m);
        }
    }

    let mut best_mv = ordered[0];
    let mut best = -INF;

    for (i, &m) in ordered.iter().enumerate() {
        if stats.timed_out || now_ms() >= deadline {
            stats.timed_out = true;
            return (best, best_mv, false);
        }
        let (nst, res) = apply_move(root, m, board, zobrist_stone, zobrist_to_play);
        if !res.legal {
            continue;
        }
        stats.nodes += 1;
        let score = if res.winner.is_some() {
            WIN - (depth as i32)
        } else if cfg.use_pvs && i > 0 {
            // PVS: null window search first
            let mut s = -negamax(
                nst,
                depth - 1,
                -alpha - 1,
                -alpha,
                cfg,
                board,
                tt,
                zobrist_stone,
                zobrist_to_play,
                stats,
                deadline,
                now_ms,
            );
            if s > alpha && s < beta {
                s = -negamax(
                    nst,
                    depth - 1,
                    -beta,
                    -alpha,
                    cfg,
                    board,
                    tt,
                    zobrist_stone,
                    zobrist_to_play,
                    stats,
                    deadline,
                    now_ms,
                );
            }
            s
        } else {
            -negamax(
                nst,
                depth - 1,
                -beta,
                -alpha,
                cfg,
                board,
                tt,
                zobrist_stone,
                zobrist_to_play,
                stats,
                deadline,
                now_ms,
            )
        };

        if stats.timed_out {
            return (best, best_mv, false);
        }

        if score > best {
            best = score;
            best_mv = m;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            stats.cutoffs += 1;
            break;
        }
    }

    if cfg.use_tt {
        tt.store(TTEntry {
            key: root.hash,
            depth,
            value: clamp_i16(best),
            flag: tt_flag(best, alpha0, beta),
            best_move: best_mv as i16,
        });
    }

    (best, best_mv, true)
}

fn negamax(
    st: State,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    cfg: SearchConfig,
    board: &Board,
    tt: &mut TranspositionTable,
    zobrist_stone: &[[u64; 81]; 2],
    zobrist_to_play: u64,
    stats: &mut SearchStats,
    deadline: f64,
    now_ms: &impl Fn() -> f64,
) -> i32 {
    if stats.timed_out {
        return evaluate(st, board);
    }
    // `legal_moves` é relativamente caro no 9x9. Verificar a cada 32 nós
    // mantém o overshoot curto; 2048 nós podiam representar vários segundos.
    if (stats.nodes & 31) == 0 && now_ms() >= deadline {
        stats.timed_out = true;
        return evaluate(st, board);
    }

    if depth == 0 {
        return evaluate(st, board);
    }

    let alpha0 = alpha;

    if cfg.use_tt {
        if let Some(e) = tt.probe(st.hash) {
            if e.depth >= depth {
                let v = e.value as i32;
                match e.flag {
                    0 => return v,          // exact
                    1 if v >= beta => return v, // lower bound cut
                    2 if v <= alpha => return v, // upper bound cut
                    _ => {}
                }
            }
        }
    }

    let (mut moves, has_capture) = legal_moves(st, board, zobrist_stone, zobrist_to_play);
    if moves.is_empty() {
        return 0;
    }
    if has_capture {
        return WIN - (depth as i32);
    }
    order_moves_simple(&mut moves, board);

    let mut best = -INF;
    let mut best_mv: i16 = -1;

    for (i, &m) in moves.iter().enumerate() {
        let (nst, res) = apply_move(st, m, board, zobrist_stone, zobrist_to_play);
        if !res.legal {
            continue;
        }
        stats.nodes += 1;
        let score = if res.winner.is_some() {
            WIN - (depth as i32)
        } else if cfg.use_pvs && i > 0 {
            let mut s = -negamax(
                nst,
                depth - 1,
                -alpha - 1,
                -alpha,
                cfg,
                board,
                tt,
                zobrist_stone,
                zobrist_to_play,
                stats,
                deadline,
                now_ms,
            );
            if s > alpha && s < beta {
                s = -negamax(
                    nst,
                    depth - 1,
                    -beta,
                    -alpha,
                    cfg,
                    board,
                    tt,
                    zobrist_stone,
                    zobrist_to_play,
                    stats,
                    deadline,
                    now_ms,
                );
            }
            s
        } else {
            -negamax(
                nst,
                depth - 1,
                -beta,
                -alpha,
                cfg,
                board,
                tt,
                zobrist_stone,
                zobrist_to_play,
                stats,
                deadline,
                now_ms,
            )
        };

        if stats.timed_out {
            return evaluate(st, board);
        }

        if score > best {
            best = score;
            best_mv = m as i16;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            stats.cutoffs += 1;
            break;
        }
    }

    if cfg.use_tt {
        tt.store(TTEntry {
            key: st.hash,
            depth,
            value: clamp_i16(best),
            flag: tt_flag(best, alpha0, beta),
            best_move: best_mv,
        });
    }

    best
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::board::Board;
    use crate::core::rules::{Color, State};
    use crate::core::zobrist::Zobrist;
    use std::cell::Cell;

    #[test]
    fn deadline_curto_propaga_e_preserva_fallback_legal() {
        let board = Board::new();
        let zobrist = Zobrist::new(&board, 1234);
        let state = State {
            black: 1u128 << 40,
            white: 1u128 << 31,
            to_play: Color::Black,
            hash: 0,
        };
        let mut tt = TranspositionTable::new(10);
        let clock = Cell::new(0.0f64);
        let now = || {
            let value = clock.get();
            clock.set(value + 0.25);
            value
        };
        let cfg = SearchConfig {
            max_depth: 10,
            use_tt: true,
            use_pvs: true,
            noise_top_k: 1,
            noise_delta: 0,
        };

        let (_, mv, stats) = search_best_move(
            state,
            1,
            cfg,
            &board,
            &mut tt,
            &zobrist.stone,
            zobrist.to_play,
            now,
            0,
        );
        let (legal, _) = legal_moves(state, &board, &zobrist.stone, zobrist.to_play);

        assert!(legal.contains(&mv));
        assert!(stats.timed_out);
        assert!(clock.get() < 20.0, "deadline não propagou: relógio={}", clock.get());
    }
}
