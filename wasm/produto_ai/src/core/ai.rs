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

/// Count cells that would connect two or more groups if filled
fn count_bridge_cells(mask: u64, board: &Board) -> i32 {
    use super::groups::group_sizes;
    let empty = empty_mask(StateView { black: mask, white: !mask & FULL_MASK, player_to_move: Stone::Black, first_move: false });
    let current_groups = group_sizes(mask, board);
    let num_groups = current_groups.len();
    if num_groups <= 1 {
        return 0;
    }

    let mut bridges = 0i32;
    let mut tmp = empty & FULL_MASK;
    while tmp != 0 {
        let idx = tmp.trailing_zeros() as usize;
        tmp &= !bit(idx);

        // Check if placing here would reduce group count
        let test_mask = mask | bit(idx);
        let new_groups = group_sizes(test_mask, board);
        if new_groups.len() < num_groups {
            bridges += (num_groups - new_groups.len()) as i32;
        }
    }
    bridges
}

/// Evaluate potential future product after optimal group merging
fn evaluate_potential(mask: u64, board: &Board) -> i32 {
    use super::groups::group_sizes;
    let mut sizes: Vec<u32> = group_sizes(mask, board).into_iter().map(|s| s as u32).collect();
    if sizes.len() <= 1 {
        return 0;
    }
    sizes.sort_unstable();
    sizes.reverse();

    // Current product
    let current = (sizes[0] * sizes[1]) as i32;

    // If we could merge top 2 groups, what would the new product be?
    // (merged group becomes sizes[0] + sizes[1], next largest is sizes[2] if exists)
    if sizes.len() >= 3 {
        let merged = sizes[0] + sizes[1];
        let potential = (merged * sizes[2]) as i32;
        return (potential - current) / 3; // Discount by 3 (not guaranteed)
    }
    0
}

fn eval_heuristic(state: StateView, board: &Board, root_player: Stone) -> i32 {
    let (my_mask, opp_mask) = match root_player {
        Stone::Black => (state.black, state.white),
        Stone::White => (state.white, state.black),
    };

    let my = score_for(my_mask, board);
    let opp = score_for(opp_mask, board);

    // Base score: product difference (most important)
    let mut score = (my.product as i32 - opp.product as i32) * 100;

    // ========== GROUP STRUCTURE ANALYSIS ==========

    // 1. Single group penalty/bonus (important for strategy)
    // Having only 1 group = 0 points, very bad
    if my.top2 == 0 && my.top1 > 0 {
        // My single group: severe penalty scaled by group size
        // Larger single group = closer to splitting, less penalty
        let size_factor = (my.top1 as i32).min(20);
        score -= 800 - size_factor * 15;
    }
    if opp.top2 == 0 && opp.top1 > 0 {
        // Opponent has single group: bonus for us (they score 0)
        // Larger opponent group = harder to keep them at 0, less bonus
        let size_factor = (opp.top1 as i32).min(20);
        score += 600 - size_factor * 10;
    }

    // 2. Equilibrium bonus for having balanced groups
    // Product is maximized when groups are similar size (e.g., 10*10 > 5*15)
    if my.top2 > 0 {
        let minv = my.top1.min(my.top2) as i32;
        let maxv = my.top1.max(my.top2) as i32;
        // Balance ratio: 1.0 = perfect balance, 0.0 = very unbalanced
        let balance = (minv * 100) / maxv.max(1);
        score += balance * 2; // Up to +200 for perfect balance
    }
    if opp.top2 > 0 {
        let minv = opp.top1.min(opp.top2) as i32;
        let maxv = opp.top1.max(opp.top2) as i32;
        let balance = (minv * 100) / maxv.max(1);
        score -= balance; // Penalize opponent's balance
    }

    // 3. Bridge cells (cells that would merge groups)
    // Having more bridge opportunities = more flexible
    let my_bridges = count_bridge_cells(my_mask, board);
    let opp_bridges = count_bridge_cells(opp_mask, board);
    score += (my_bridges - opp_bridges) * 25;

    // 4. Potential scoring (future product if we merge)
    let my_potential = evaluate_potential(my_mask, board);
    let opp_potential = evaluate_potential(opp_mask, board);
    score += my_potential - opp_potential;

    // 5. Stone count (tiebreaker, favor efficiency)
    score -= (my.count as i32 - opp.count as i32) * 3;

    // 6. Territorial advantage (empty cells adjacent to our pieces)
    let empty = empty_mask(state);
    let my_adjacent = count_adjacent_empty(my_mask, empty, board);
    let opp_adjacent = count_adjacent_empty(opp_mask, empty, board);
    score += (my_adjacent - opp_adjacent) * 5;

    // 7. Sabotage detection (preventing opponent from scoring)
    // If opponent has only 1 group, we want to keep it that way
    if opp.top2 == 0 && opp.top1 > 0 {
        let opp_bridges = count_bridge_cells(opp_mask, board);
        if opp_bridges == 0 {
            // Opponent has no way to split their group - huge bonus!
            score += 400;
        } else if opp_bridges <= 2 {
            // Very few split opportunities for opponent
            score += 150;
        }
    }

    score
}

/// Count empty cells adjacent to a mask
fn count_adjacent_empty(mask: u64, empty: u64, board: &Board) -> i32 {
    let mut count = 0i32;
    let mut tmp = mask;
    while tmp != 0 {
        let idx = tmp.trailing_zeros() as usize;
        tmp &= !bit(idx);
        // neighbours[idx] is a bitmask, count empty cells that are neighbours
        let adj_empty = board.neighbours[idx] & empty;
        count += adj_empty.count_ones() as i32;
    }
    count
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

/// Negamax search with alpha-beta pruning
fn negamax(
    state: StateView,
    board: &Board,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    maximizing_player: Stone,
    candidate_k: usize,
    deadline: f64,
    now_ms: &impl Fn() -> f64,
    nodes: &mut u32,
) -> i32 {
    *nodes += 1;

    // Time check every 256 nodes
    if *nodes & 255 == 0 && now_ms() >= deadline {
        return 0; // Will be ignored due to timeout
    }

    let empty = empty_mask(state);
    if empty == 0 || depth == 0 {
        let raw = eval_heuristic(state, board, maximizing_player);
        // Negate if we're not the maximizing player
        return if state.player_to_move == maximizing_player { raw } else { -raw };
    }

    let moves = generate_candidate_moves(state, board, candidate_k);
    if moves.is_empty() {
        let raw = eval_heuristic(state, board, maximizing_player);
        return if state.player_to_move == maximizing_player { raw } else { -raw };
    }

    let mut best_score = i32::MIN / 2;

    for mv in moves {
        if now_ms() >= deadline {
            break;
        }
        let Some(next) = apply_move(state, mv) else { continue };
        let score = -negamax(next, board, depth - 1, -beta, -alpha, maximizing_player, candidate_k, deadline, now_ms, nodes);

        if score > best_score {
            best_score = score;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            break; // Beta cutoff
        }
    }

    best_score
}

/// UCT selection formula for MCTS
fn uct_score(wins: f32, visits: u32, parent_visits: u32, exploration: f32) -> f32 {
    if visits == 0 {
        return f32::MAX; // Unvisited nodes have highest priority
    }
    let exploitation = wins / visits as f32;
    let exploration_term = exploration * ((parent_visits as f32).ln() / visits as f32).sqrt();
    exploitation + exploration_term
}

/// Heuristic-guided rollout (better than random)
fn heuristic_rollout(mut state: StateView, board: &Board, rng: &mut SplitMix64, max_steps: u32) -> StateView {
    let mut steps = 0u32;
    while (state.black | state.white) != FULL_MASK && steps < max_steps {
        // Generate a few candidate moves and pick the best one (light heuristic)
        let moves = generate_candidate_moves(state, board, 8);
        if moves.is_empty() {
            break;
        }

        // With 70% probability, pick a "good" move; otherwise random
        let mv = if rng.gen_range(10) < 7 && moves.len() > 1 {
            // Quick 1-ply evaluation
            let mut best_mv = moves[0];
            let mut best_score = i32::MIN;
            for m in &moves {
                if let Some(next) = apply_move(state, *m) {
                    let s = eval_heuristic(next, board, state.player_to_move);
                    if s > best_score {
                        best_score = s;
                        best_mv = *m;
                    }
                }
            }
            best_mv
        } else {
            moves[rng.gen_range(moves.len())]
        };

        if let Some(next) = apply_move(state, mv) {
            state = next;
        } else {
            break;
        }
        steps += 1;
    }
    state
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

    // Endgame exact solver
    if empty_count <= cfg.endgame_empty_n {
        let mut memo = std::collections::HashMap::new();
        let moves = generate_candidate_moves(state, board, (empty_count as usize).max(6));
        if moves.is_empty() {
            return choose_random_move(state, &mut rng).unwrap();
        }
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
            // Easy: random move
            choose_random_move(state, &mut rng).unwrap()
        }
        1 => {
            // Medium: greedy 1-ply
            let moves = generate_candidate_moves(state, board, cfg.candidate_k as usize);
            if moves.is_empty() {
                return choose_random_move(state, &mut rng).unwrap();
            }
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
            // Hard: Iterative deepening negamax (depth 2-4)
            let deadline = now_ms() + cfg.time_ms as f64;
            let mut root_moves = generate_candidate_moves(state, board, cfg.candidate_k as usize);
            if root_moves.is_empty() {
                return choose_random_move(state, &mut rng).unwrap();
            }

            // Sort moves by 1-ply heuristic for better pruning
            root_moves.sort_unstable_by(|a, b| {
                let sa = apply_move(state, *a).map(|st| eval_heuristic(st, board, root_player)).unwrap_or(i32::MIN);
                let sb = apply_move(state, *b).map(|st| eval_heuristic(st, board, root_player)).unwrap_or(i32::MIN);
                sb.cmp(&sa)
            });

            let mut best_mv = root_moves[0];

            // Iterative deepening from depth 2 to 4
            for depth in 2..=4u8 {
                if now_ms() >= deadline {
                    break;
                }

                let mut depth_best_mv = root_moves[0];
                let mut depth_best_score = i32::MIN;
                let mut alpha = i32::MIN / 2;
                let beta = i32::MAX / 2;
                let mut nodes = 0u32;

                for mv in &root_moves {
                    if now_ms() >= deadline {
                        break;
                    }
                    let Some(next) = apply_move(state, *mv) else { continue };
                    let score = -negamax(next, board, depth - 1, -beta, -alpha, root_player, cfg.candidate_k as usize, deadline, &now_ms, &mut nodes);

                    if score > depth_best_score {
                        depth_best_score = score;
                        depth_best_mv = *mv;
                    }
                    if score > alpha {
                        alpha = score;
                    }
                }

                // Only update best if we completed this depth
                if now_ms() < deadline {
                    best_mv = depth_best_mv;
                    let _ = depth_best_score; // mark as used

                    // Move best move to front for next iteration
                    if let Some(pos) = root_moves.iter().position(|m| *m == best_mv) {
                        root_moves.remove(pos);
                        root_moves.insert(0, best_mv);
                    }
                }
            }

            best_mv
        }
        _ => {
            // Very Hard / Max: UCT MCTS with heuristic rollouts
            let deadline = now_ms() + cfg.time_ms as f64;
            let root_moves = generate_candidate_moves(state, board, cfg.candidate_k as usize);
            if root_moves.is_empty() {
                return choose_random_move(state, &mut rng).unwrap();
            }

            let n = root_moves.len();
            let mut visits = vec![0u32; n];
            let mut wins = vec![0f32; n];
            let mut total_visits = 0u32;

            let exploration = 1.41f32; // sqrt(2) is standard UCT exploration constant
            let max_rollout_steps = 60u32;

            while now_ms() < deadline {
                // UCT Selection: pick child with best UCT score
                let mut best_i = 0usize;
                let mut best_uct = f32::MIN;
                for i in 0..n {
                    let uct = uct_score(wins[i], visits[i], total_visits.max(1), exploration);
                    if uct > best_uct {
                        best_uct = uct;
                        best_i = i;
                    }
                }

                let mv = root_moves[best_i];
                let Some(next) = apply_move(state, mv) else { continue };

                // Simulation: heuristic-guided rollout
                let terminal = heuristic_rollout(next, board, &mut rng, max_rollout_steps);
                let u = utility_exact(terminal, board);

                // Backpropagation
                let win = match (root_player, u) {
                    (Stone::Black, 1) => 1.0,
                    (Stone::Black, -1) => 0.0,
                    (Stone::White, -1) => 1.0,
                    (Stone::White, 1) => 0.0,
                    _ => 0.5,
                };

                visits[best_i] += 1;
                wins[best_i] += win;
                total_visits += 1;
            }

            // Select move with most visits (more robust than highest win rate)
            let mut best_i = 0usize;
            let mut max_visits = 0u32;
            for i in 0..n {
                if visits[i] > max_visits {
                    max_visits = visits[i];
                    best_i = i;
                }
            }
            root_moves[best_i]
        }
    }
}

