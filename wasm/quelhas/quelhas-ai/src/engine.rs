use crate::eval;
use crate::tt::{TTEntry, TranspositionTable};
use crate::zobrist::ZobristKeys;
use quelhas_core::{apply_move, decode_move, generate_moves_dynamic, EncMove, Occupancy};

pub struct SearchStats {
    pub nodes: u64,
    pub tt_hits: u64,
    pub tt_probes: u64,
}

pub struct SearchResult {
    pub best_move: Option<EncMove>,
    pub depth_reached: u32,
    pub nodes_searched: u64,
    pub tt_hits: u64,
    pub tt_probes: u64,
    pub score: i32,
}

pub struct Searcher<'a> {
    tt: &'a mut TranspositionTable,
    zobrist: &'a ZobristKeys,
    pub age: u8,
    deadline_ms: f64,
    pub max_depth: u32,
    pub stats: SearchStats,
    killers: Vec<[u16; 2]>,
    history: Vec<i32>,
}

const INF: i32 = 1_000_000;
const MATE: i32 = 900_000;

impl<'a> Searcher<'a> {
    pub fn new(
        tt: &'a mut TranspositionTable,
        zobrist: &'a ZobristKeys,
        age: u8,
        deadline_ms: f64,
        max_depth: u32,
    ) -> Self {
        Self {
            tt,
            zobrist,
            age,
            deadline_ms,
            max_depth,
            stats: SearchStats {
                nodes: 0,
                tt_hits: 0,
                tt_probes: 0,
            },
            killers: Vec::new(),
            history: vec![0; 4096],
        }
    }

    #[inline]
    fn time_up(now_ms: f64, deadline_ms: f64) -> bool {
        now_ms >= deadline_ms
    }

    fn order_moves(&mut self, occ: Occupancy, side: u8, depth: usize, moves: &mut [EncMove], tt_best: Option<EncMove>) {
        let tt_best_u16 = tt_best.unwrap_or(0);
        if self.killers.len() <= depth {
            self.killers.resize(depth + 1, [0, 0]);
        }
        let killers = self.killers[depth];

        moves.sort_by(|a, b| {
            let pa = self.move_priority(occ, side, depth, *a, tt_best_u16, killers);
            let pb = self.move_priority(occ, side, depth, *b, tt_best_u16, killers);
            pb.cmp(&pa)
        });
    }

    #[inline]
    fn move_priority(&self, occ: Occupancy, side: u8, depth: usize, mv: EncMove, tt_best: u16, killers: [u16; 2]) -> i32 {
        let mut p = 0i32;
        if mv == tt_best {
            p += 1_000_000;
        }
        if mv == killers[0] {
            p += 600_000;
        } else if mv == killers[1] {
            p += 450_000;
        }
        p += self.history[mv as usize & 4095];

        let (_start, len, _o) = decode_move(mv);
        p -= (len as i32) * 10;

        if depth >= 6 {
            p += (eval::cheap_move_score(occ, mv, side) / 10).clamp(-50_000, 50_000);
        }
        p
    }

    pub fn iterative_deepening(&mut self, occ: Occupancy, side: u8, top_n: u32, score_delta: i32, now: impl Fn() -> f64) -> SearchResult {
        let mut best_move: Option<EncMove> = None;
        let mut best_score = -INF;
        let mut depth_reached = 0u32;

        let mut window: i32 = 120;

        let mut root_moves = generate_moves_dynamic(occ, side);
        if root_moves.is_empty() {
            return SearchResult {
                best_move: None,
                depth_reached: 0,
                nodes_searched: 0,
                tt_hits: self.stats.tt_hits,
                tt_probes: self.stats.tt_probes,
                score: -MATE,
            };
        }

        // ordenar raiz inicialmente por heurística barata (history já começa 0)
        self.order_moves(occ, side, 1, &mut root_moves, None);

        for depth in 1..=self.max_depth {
            if Self::time_up(now(), self.deadline_ms) {
                break;
            }

            let (alpha, beta) = if depth == 1 {
                (-INF, INF)
            } else {
                (best_score - window, best_score + window)
            };

            let alpha_orig = alpha;
            let mut alpha_i = alpha;
            let mut beta_i = beta;

            let mut iter_best_move = root_moves[0];
            let mut iter_best_score = -INF;

            let mut first = true;
            for &mv in &root_moves {
                if Self::time_up(now(), self.deadline_ms) {
                    break;
                }
                let child = apply_move(occ, mv);
                let opp = 1u8 - side;

                let mut score = if first {
                    first = false;
                    -self.negamax(child, opp, depth as i32 - 1, -beta_i, -alpha_i, 1, &now)
                } else {
                    let narrow = -self.negamax(child, opp, depth as i32 - 1, -alpha_i - 1, -alpha_i, 1, &now);
                    if narrow > alpha_i && narrow < beta_i {
                        -self.negamax(child, opp, depth as i32 - 1, -beta_i, -alpha_i, 1, &now)
                    } else {
                        narrow
                    }
                };

                if Self::time_up(now(), self.deadline_ms) {
                    break;
                }

                if score > iter_best_score {
                    iter_best_score = score;
                    iter_best_move = mv;
                }
                if score > alpha_i {
                    alpha_i = score;
                }
                if alpha_i >= beta_i {
                    break;
                }
            }

            if Self::time_up(now(), self.deadline_ms) {
                break;
            }

            // aspiration fail -> pesquisa total (rápida, mas robusta)
            if depth > 1 && (iter_best_score <= alpha_orig || iter_best_score >= beta) {
                window = (window * 2).min(1200);
                let full = self.negamax(occ, side, depth as i32, -INF, INF, 0, &now);
                iter_best_score = full;
                // best move do TT (se existir) passa para frente
            } else if depth > 1 {
                window = (window as f64 * 0.75).max(60.0) as i32;
            }

            best_score = iter_best_score;
            best_move = Some(iter_best_move);
            depth_reached = depth;

            // PV ordering
            if let Some(pos) = root_moves.iter().position(|&m| m == iter_best_move) {
                if pos > 0 {
                    root_moves.remove(pos);
                    root_moves.insert(0, iter_best_move);
                }
            }

            if best_score >= MATE - 1000 {
                break;
            }
        }

        // randomização para dificuldades mais baixas
        if top_n > 0 && root_moves.len() > 1 {
            let k = (top_n as usize).min(root_moves.len());
            let mut scored: Vec<(EncMove, i32)> = root_moves[..k]
                .iter()
                .map(|&m| (m, eval::cheap_move_score(occ, m, side)))
                .collect();
            scored.sort_by(|a, b| b.1.cmp(&a.1));
            let best = scored[0];
            let candidates: Vec<EncMove> = scored
                .into_iter()
                .filter(|(_, s)| best.1 - *s <= score_delta)
                .map(|(m, _)| m)
                .collect();
            if candidates.len() > 1 {
                let h = self.zobrist.hash(occ, side);
                let idx = (h as usize) % candidates.len();
                best_move = Some(candidates[idx]);
            }
        }

        SearchResult {
            best_move,
            depth_reached,
            nodes_searched: self.stats.nodes,
            tt_hits: self.stats.tt_hits,
            tt_probes: self.stats.tt_probes,
            score: best_score,
        }
    }

    fn negamax(
        &mut self,
        occ: Occupancy,
        side: u8,
        depth: i32,
        mut alpha: i32,
        beta: i32,
        ply: i32,
        now: &impl Fn() -> f64,
    ) -> i32 {
        self.stats.nodes += 1;
        if (self.stats.nodes & 2047) == 0 && Self::time_up(now(), self.deadline_ms) {
            return 0;
        }

        let key = self.zobrist.hash(occ, side);

        self.stats.tt_probes += 1;
        let entry = *self.tt.probe(key);
        let mut tt_best: Option<EncMove> = None;
        if entry.key == key {
            self.stats.tt_hits += 1;
            tt_best = Some(entry.best_move);
            if entry.depth as i32 >= depth {
                match entry.flag {
                    0 => return entry.score,
                    1 => {
                        if entry.score >= beta {
                            return entry.score;
                        }
                    }
                    2 => {
                        if entry.score <= alpha {
                            return entry.score;
                        }
                    }
                    _ => {}
                }
            }
        }

        let moves = generate_moves_dynamic(occ, side);
        if moves.is_empty() {
            return MATE - ply;
        }

        if depth == 0 {
            return eval::evaluate_misere(occ, side);
        }

        let mut moves = moves;
        self.order_moves(occ, side, depth as usize, &mut moves, tt_best);

        let alpha_orig = alpha;
        let mut best_score = -INF;
        let mut best_move: EncMove = moves[0];

        let mut first = true;
        for mv in moves {
            if Self::time_up(now(), self.deadline_ms) {
                break;
            }
            let child = apply_move(occ, mv);
            let opp = 1u8 - side;
            let score = if first {
                first = false;
                -self.negamax(child, opp, depth - 1, -beta, -alpha, ply + 1, now)
            } else {
                let narrow = -self.negamax(child, opp, depth - 1, -alpha - 1, -alpha, ply + 1, now);
                if narrow > alpha && narrow < beta {
                    -self.negamax(child, opp, depth - 1, -beta, -alpha, ply + 1, now)
                } else {
                    narrow
                }
            };

            if score > best_score {
                best_score = score;
                best_move = mv;
            }
            if score > alpha {
                alpha = score;
            }
            if alpha >= beta {
                // killers + history
                let d = depth as usize;
                if self.killers.len() <= d {
                    self.killers.resize(d + 1, [0, 0]);
                }
                let k = self.killers[d];
                if k[0] != mv {
                    self.killers[d] = [mv, k[0]];
                } else if k[1] != mv {
                    self.killers[d] = [k[0], mv];
                }
                let idx = (mv as usize) & 4095;
                self.history[idx] = self.history[idx].saturating_add(depth * depth * 200);
                break;
            }
        }

        let flag = if best_score <= alpha_orig {
            2u8
        } else if best_score >= beta {
            1u8
        } else {
            0u8
        };

        self.tt.store(TTEntry {
            key,
            depth: depth.max(0) as u8,
            score: best_score,
            flag,
            best_move,
            age: self.age,
        });

        best_score
    }
}

