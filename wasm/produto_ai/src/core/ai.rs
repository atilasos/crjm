use super::board::{bit, Board, FULL_MASK};
use super::movegen::{apply_move, empty_mask, generate_candidate_moves, Move, StateView, Stone};
use super::scoring::{score_for, winner, Winner};

#[derive(Clone, Copy, Debug)]
pub struct AiConfig {
    pub difficulty: u8,
    pub time_ms: u32,
    pub candidate_k: u16,
    pub endgame_empty_n: u8,
    pub seed: u64,
}

#[derive(Clone, Copy)]
struct SplitMix64 {
    state: u64,
}

impl SplitMix64 {
    fn new(seed: u64) -> Self {
        Self { state: seed }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9e3779b97f4a7c15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58476d1ce4e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d049bb133111eb);
        z ^ (z >> 31)
    }

    fn gen_range(&mut self, upper: usize) -> usize {
        if upper <= 1 {
            return 0;
        }
        (self.next_u64() as usize) % upper
    }
}

fn eval_heuristic(state: StateView, board: &Board, root_player: Stone) -> i32 {
    let (my_mask, opp_mask) = match root_player {
        Stone::Black => (state.black, state.white),
        Stone::White => (state.white, state.black),
    };

    let my = score_for(my_mask, board);
    let opp = score_for(opp_mask, board);

    let mut score = (my.product as i32) - (opp.product as i32);

    if my.top2 == 0 && my.top1 > 0 {
        score -= 600;
    }
    if opp.top2 == 0 && opp.top1 > 0 {
        score += 450;
    }

    if my.top2 > 0 {
        let minv = my.top1.min(my.top2) as i32;
        let maxv = my.top1.max(my.top2) as i32;
        score += (minv * 100) / maxv.max(1);
    }

    score -= my.count as i32 / 2;

    score
}

fn utility_exact(state: StateView, board: &Board) -> i8 {
    match winner(state.black, state.white, board) {
        Winner::Black => 1,
        Winner::White => -1,
        Winner::Draw => 0,
    }
}

fn exact_minimax(
    state: StateView,
    board: &Board,
    memo: &mut std::collections::HashMap<u128, i8>,
) -> i8 {
    let empty = empty_mask(state);
    if empty == 0 {
        return utility_exact(state, board);
    }

    let mut black_key = state.black;
    if state.player_to_move == Stone::White {
        black_key |= 1u64 << 63;
    }
    if state.first_move {
        black_key |= 1u64 << 62;
    }
    let key = (black_key as u128) | ((state.white as u128) << 64);
    if let Some(&v) = memo.get(&key) {
        return v;
    }

    let mut empties = Vec::new();
    let mut tmp = empty;
    while tmp != 0 {
        let idx = tmp.trailing_zeros() as usize;
        tmp &= !bit(idx);
        empties.push(idx as u8);
    }

    let colors = [Stone::Black, Stone::White];

    let mut best: i8 = if state.player_to_move == Stone::Black { -2 } else { 2 };

    if state.first_move {
        for &pos in &empties {
            for &c in &colors {
                let mv = Move {
                    pos_a: pos,
                    color_a: c,
                    pos_b: -1,
                    color_b: c,
                };
                if let Some(next) = apply_move(state, mv) {
                    let u = exact_minimax(next, board, memo);
                    if state.player_to_move == Stone::Black {
                        if u > best {
                            best = u;
                        }
                        if best == 1 {
                            break;
                        }
                    } else {
                        if u < best {
                            best = u;
                        }
                        if best == -1 {
                            break;
                        }
                    }
                }
            }
        }
    } else {
        for i in 0..empties.len() {
            for j in (i + 1)..empties.len() {
                let a = empties[i];
                let b = empties[j];
                for &c1 in &colors {
                    for &c2 in &colors {
                        let mv = Move {
                            pos_a: a,
                            color_a: c1,
                            pos_b: b as i8,
                            color_b: c2,
                        };
                        if let Some(next) = apply_move(state, mv) {
                            let u = exact_minimax(next, board, memo);
                            if state.player_to_move == Stone::Black {
                                if u > best {
                                    best = u;
                                }
                                if best == 1 {
                                    break;
                                }
                            } else {
                                if u < best {
                                    best = u;
                                }
                                if best == -1 {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if best == -2 {
        best = -1;
    }
    if best == 2 {
        best = 1;
    }

    memo.insert(key, best);
    best
}

fn choose_random_move(state: StateView, rng: &mut SplitMix64) -> Option<Move> {
    let empty = empty_mask(state);
    if empty == 0 {
        return None;
    }

    let mut empties = Vec::new();
    let mut tmp = empty;
    while tmp != 0 {
        let idx = tmp.trailing_zeros() as usize;
        tmp &= !bit(idx);
        empties.push(idx as u8);
    }

    let colors = [Stone::Black, Stone::White];

    if state.first_move {
        let pos = empties[rng.gen_range(empties.len())];
        let c = colors[rng.gen_range(2)];
        return Some(Move {
            pos_a: pos,
            color_a: c,
            pos_b: -1,
            color_b: c,
        });
    }

    if empties.len() < 2 {
        return None;
    }
    let i = rng.gen_range(empties.len());
    let mut j = rng.gen_range(empties.len() - 1);
    if j >= i {
        j += 1;
    }
    let a = empties[i];
    let b = empties[j];
    let c1 = colors[rng.gen_range(2)];
    let c2 = colors[rng.gen_range(2)];
    Some(Move {
        pos_a: a,
        color_a: c1,
        pos_b: b as i8,
        color_b: c2,
    })
}

pub fn choose_move(state: StateView, cfg: AiConfig, board: &Board, now_ms: impl Fn() -> f64) -> Move {
    let mut rng = SplitMix64::new(cfg.seed);

    let root_player = state.player_to_move;
    let empty = empty_mask(state);
    let empty_count = empty.count_ones() as u8;

    if empty_count == 0 {
        return Move {
            pos_a: 0,
            color_a: Stone::Black,
            pos_b: -1,
            color_b: Stone::Black,
        };
    }

    // Endgame exact (difficulty 4 only, but can be enabled by cfg)
    if empty_count <= cfg.endgame_empty_n {
        let mut memo = std::collections::HashMap::new();
        let moves = generate_candidate_moves(
            state,
            board,
            (empty_count as usize).max(6), // ignored: exact uses all empties internally
        );
        let mut best_mv = moves[0];
        let mut best = if root_player == Stone::Black { -2 } else { 2 };
        for mv in moves {
            if let Some(next) = apply_move(state, mv) {
                let u = exact_minimax(next, board, &mut memo);
                if root_player == Stone::Black {
                    if u > best {
                        best = u;
                        best_mv = mv;
                    }
                } else if u < best {
                    best = u;
                    best_mv = mv;
                }
            }
        }
        return best_mv;
    }

    match cfg.difficulty {
        0 => {
            // Easy random
            choose_random_move(state, &mut rng).unwrap()
        }
        1 => {
            // Medium greedy (1-ply)
            let moves = generate_candidate_moves(state, board, cfg.candidate_k as usize);
            let mut best_mv = moves[0];
            let mut best_score = i32::MIN;
            for mv in moves {
                if let Some(next) = apply_move(state, mv) {
                    let s = eval_heuristic(next, board, root_player);
                    if s > best_score {
                        best_score = s;
                        best_mv = mv;
                    }
                }
            }
            best_mv
        }
        2 => {
            // Hard minimax 2-ply (root -> opp -> eval)
            let deadline = now_ms() + cfg.time_ms as f64;

            let mut root_moves = generate_candidate_moves(state, board, cfg.candidate_k as usize);
            root_moves.sort_unstable_by(|a, b| {
                let sa = apply_move(state, *a).map(|st| eval_heuristic(st, board, root_player)).unwrap_or(i32::MIN);
                let sb = apply_move(state, *b).map(|st| eval_heuristic(st, board, root_player)).unwrap_or(i32::MIN);
                sb.cmp(&sa)
            });

            let mut best_mv = root_moves[0];
            let mut alpha = i32::MIN / 2;
            let beta = i32::MAX / 2;

            for mv in root_moves {
                if now_ms() >= deadline {
                    break;
                }
                let Some(next) = apply_move(state, mv) else { continue };
                let mut worst = i32::MAX / 2;

                let mut opp_moves = generate_candidate_moves(next, board, cfg.candidate_k as usize);
                opp_moves.sort_unstable_by(|a, b| {
                    let sa = apply_move(next, *a).map(|st| eval_heuristic(st, board, root_player)).unwrap_or(i32::MIN);
                    let sb = apply_move(next, *b).map(|st| eval_heuristic(st, board, root_player)).unwrap_or(i32::MIN);
                    sa.cmp(&sb) // opponent wants to minimize our heuristic
                });

                for om in opp_moves {
                    if now_ms() >= deadline {
                        break;
                    }
                    let Some(leaf) = apply_move(next, om) else { continue };
                    let s = eval_heuristic(leaf, board, root_player);
                    if s < worst {
                        worst = s;
                    }
                    if worst <= alpha {
                        break;
                    }
                }

                if worst > alpha {
                    alpha = worst;
                    best_mv = mv;
                }
                if alpha >= beta {
                    break;
                }
            }

            best_mv
        }
        _ => {
            // Very hard / Max: lightweight UCT MCTS with time budget
            let time_budget = cfg.time_ms.max(10);
            let deadline = now_ms() + time_budget as f64;

            let root_moves = generate_candidate_moves(state, board, cfg.candidate_k as usize);
            if root_moves.is_empty() {
                return choose_random_move(state, &mut rng).unwrap();
            }

            let mut visits = vec![0u32; root_moves.len()];
            let mut wins = vec![0f32; root_moves.len()]; // root win rate (1.0 win, 0.0 loss, 0.5 draw)

            while now_ms() < deadline {
                let i = rng.gen_range(root_moves.len());
                let mv = root_moves[i];
                let Some(mut st) = apply_move(state, mv) else { continue };

                // rollout to terminal (random)
                let mut steps = 0u32;
                while (st.black | st.white) != FULL_MASK && steps < 40 {
                    if let Some(rm) = choose_random_move(st, &mut rng) {
                        if let Some(ns) = apply_move(st, rm) {
                            st = ns;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                    steps += 1;
                }

                let u = utility_exact(st, board); // 1 black win, -1 white win
                let win = match (root_player, u) {
                    (Stone::Black, 1) => 1.0,
                    (Stone::Black, -1) => 0.0,
                    (Stone::White, -1) => 1.0,
                    (Stone::White, 1) => 0.0,
                    _ => 0.5,
                };

                visits[i] += 1;
                wins[i] += win;
            }

            let mut best_i = 0usize;
            let mut best_rate = -1.0f32;
            for i in 0..root_moves.len() {
                if visits[i] == 0 {
                    continue;
                }
                let rate = wins[i] / visits[i] as f32;
                if rate > best_rate {
                    best_rate = rate;
                    best_i = i;
                }
            }
            root_moves[best_i]
        }
    }
}

