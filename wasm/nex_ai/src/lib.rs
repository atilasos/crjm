use wasm_bindgen::prelude::*;

use js_sys::{Date, Object, Reflect, Uint8Array};

const N: usize = 11;
const NN: usize = N * N;

// 0 empty, 1 black, 2 white, 3 neutral
const EMPTY: u8 = 0;
const BLACK: u8 = 1;
const WHITE: u8 = 2;
const NEUTRAL: u8 = 3;

const FLAG_SWAP_AVAILABLE: u8 = 1;

#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[derive(Clone, Copy)]
struct Rng32 {
    x: u32,
}

impl Rng32 {
    fn new(seed: u32) -> Self {
        Self { x: seed ^ 0x9E37_79B9 }
    }
    fn next_u32(&mut self) -> u32 {
        // xorshift32
        let mut x = self.x;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.x = x;
        x
    }
    fn gen_range(&mut self, upper: usize) -> usize {
        if upper <= 1 {
            return 0;
        }
        (self.next_u32() as usize) % upper
    }
}

#[derive(Clone, Copy, Debug)]
struct Pos {
    idx: u8, // 0..=120
}

impl Pos {
    fn from_xy(x: usize, y: usize) -> Self {
        Self {
            idx: (x * N + y) as u8,
        }
    }
    fn x(self) -> usize {
        (self.idx as usize) / N
    }
    fn y(self) -> usize {
        (self.idx as usize) % N
    }
}

fn neighbours(idx: usize, out: &mut [u8; 6]) -> usize {
    let x = (idx / N) as i32;
    let y = (idx % N) as i32;
    let dirs = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)];
    let mut k = 0usize;
    for (dx, dy) in dirs {
        let nx = x + dx;
        let ny = y + dy;
        if nx >= 0 && nx < N as i32 && ny >= 0 && ny < N as i32 {
            out[k] = (nx as usize * N + ny as usize) as u8;
            k += 1;
        }
    }
    k
}

fn start_edge(color: u8) -> impl Iterator<Item = u8> {
    // Black connects y=0 -> y=10. White connects x=0 -> x=10.
    (0..N).map(move |i| {
        if color == BLACK {
            Pos::from_xy(i, 0).idx
        } else {
            Pos::from_xy(0, i).idx
        }
    })
}

fn is_end_edge(color: u8, idx: u8) -> bool {
    let pos = Pos { idx };
    if color == BLACK {
        pos.y() == N - 1
    } else {
        pos.x() == N - 1
    }
}

fn cell_cost(cell: u8, my_color: u8, neutral_cost: u16) -> Option<u16> {
    if cell == my_color {
        Some(0)
    } else if cell == EMPTY {
        Some(1)
    } else if cell == NEUTRAL {
        Some(neutral_cost)
    } else {
        None // opponent blocks
    }
}

fn has_win(board: &[u8; NN], color: u8) -> bool {
    let mut seen = [false; NN];
    let mut queue = [0u8; NN];
    let mut qh = 0usize;
    let mut qt = 0usize;

    for s in start_edge(color) {
        if board[s as usize] == color {
            seen[s as usize] = true;
            queue[qt] = s;
            qt += 1;
        }
    }

    let mut neigh = [0u8; 6];
    while qh < qt {
        let cur = queue[qh];
        qh += 1;
        if is_end_edge(color, cur) {
            return true;
        }
        let cnt = neighbours(cur as usize, &mut neigh);
        for i in 0..cnt {
            let nb = neigh[i];
            let nbi = nb as usize;
            if seen[nbi] {
                continue;
            }
            if board[nbi] == color {
                seen[nbi] = true;
                queue[qt] = nb;
                qt += 1;
            }
        }
    }

    false
}

fn dist_min(board: &[u8; NN], color: u8, neutral_cost: u16) -> u16 {
    // 0-1 BFS (with neutral_cost possibly 2); we use deque implemented with ring buffer.
    // dist is "cell entry costs" from start edge to any end edge.
    let mut dist = [u16::MAX; NN];
    let mut inq = [false; NN];

    struct DequeU8 {
        buf: [u8; NN],
        head: usize,
        tail: usize,
    }
    impl DequeU8 {
        fn new() -> Self {
            Self {
                buf: [0u8; NN],
                head: 0,
                tail: 0,
            }
        }
        fn is_empty(&self) -> bool {
            self.head == self.tail
        }
        fn push_back(&mut self, v: u8) {
            self.buf[self.tail] = v;
            self.tail = (self.tail + 1) % NN;
        }
        fn push_front(&mut self, v: u8) {
            self.head = (self.head + NN - 1) % NN;
            self.buf[self.head] = v;
        }
        fn pop_front(&mut self) -> Option<u8> {
            if self.is_empty() {
                return None;
            }
            let v = self.buf[self.head];
            self.head = (self.head + 1) % NN;
            Some(v)
        }
    }

    let mut deque = DequeU8::new();

    for s in start_edge(color) {
        if let Some(c) = cell_cost(board[s as usize], color, neutral_cost) {
            dist[s as usize] = c;
            inq[s as usize] = true;
            if c == 0 {
                deque.push_front(s);
            } else {
                deque.push_back(s);
            }
        }
    }

    let mut neigh = [0u8; 6];
    while let Some(cur) = deque.pop_front() {
        inq[cur as usize] = false;
        let dcur = dist[cur as usize];
        if is_end_edge(color, cur) {
            return dcur;
        }
        let cnt = neighbours(cur as usize, &mut neigh);
        for i in 0..cnt {
            let nb = neigh[i];
            let nbi = nb as usize;
            if let Some(step) = cell_cost(board[nbi], color, neutral_cost) {
                let nd = dcur.saturating_add(step);
                if nd < dist[nbi] {
                    dist[nbi] = nd;
                    if !inq[nbi] {
                        inq[nbi] = true;
                        if step == 0 {
                            deque.push_front(nb);
                        } else {
                            deque.push_back(nb);
                        }
                    }
                }
            }
        }
    }

    u16::MAX
}

fn eval_advantage(board: &[u8; NN], my_color: u8) -> i32 {
    let opp = if my_color == BLACK { WHITE } else { BLACK };
    if has_win(board, my_color) {
        return 50_000;
    }
    if has_win(board, opp) {
        return -50_000;
    }

    let my_d = dist_min(board, my_color, 2);
    let opp_d = dist_min(board, opp, 2);
    let base = (opp_d as i32 - my_d as i32) * 120;

    // Mild centrality signal: prefer owning center-ish cells (helps opening).
    let mut central = 0i32;
    for idx in 0..NN {
        let v = board[idx];
        if v != my_color {
            continue;
        }
        let x = (idx / N) as i32;
        let y = (idx % N) as i32;
        let dx = (x - 5).abs();
        let dy = (y - 5).abs();
        central -= (dx + dy) as i32;
    }
    base + central
}

#[derive(Clone, Copy)]
enum Action {
    Swap,
    RefuseSwap,
    Place { own: u8, neutral: u8 },
    Substitute { n1: u8, n2: u8, sac: u8 },
}

fn make_place(board: &mut [u8; NN], my_color: u8, own: u8, neutral: u8) {
    board[own as usize] = my_color;
    board[neutral as usize] = NEUTRAL;
}

fn unmake_place(board: &mut [u8; NN], own: u8, neutral: u8) {
    board[own as usize] = EMPTY;
    board[neutral as usize] = EMPTY;
}

fn make_sub(board: &mut [u8; NN], my_color: u8, n1: u8, n2: u8, sac: u8) {
    board[n1 as usize] = my_color;
    board[n2 as usize] = my_color;
    board[sac as usize] = NEUTRAL;
}

fn unmake_sub(board: &mut [u8; NN], my_color: u8, n1: u8, n2: u8, sac: u8) {
    board[n1 as usize] = NEUTRAL;
    board[n2 as usize] = NEUTRAL;
    board[sac as usize] = my_color;
}

fn gen_candidates(board: &[u8; NN]) -> [bool; NN] {
    let mut cand = [false; NN];
    let mut any_piece = false;
    let mut neigh = [0u8; 6];

    for idx in 0..NN {
        if board[idx] == EMPTY {
            continue;
        }
        any_piece = true;
        let c1 = neighbours(idx, &mut neigh);
        for i in 0..c1 {
            let n1 = neigh[i] as usize;
            if board[n1] == EMPTY {
                cand[n1] = true;
            }
            let c2 = neighbours(n1, &mut neigh);
            for j in 0..c2 {
                let n2 = neigh[j] as usize;
                if board[n2] == EMPTY {
                    cand[n2] = true;
                }
            }
        }
    }

    // Opening: if board empty-ish, ensure center is in candidate set.
    if !any_piece {
        cand[Pos::from_xy(5, 5).idx as usize] = true;
    }
    cand
}

fn pick_top_k(scored: &mut Vec<(i32, u8)>, k: usize) -> Vec<u8> {
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    scored.truncate(k);
    scored.iter().map(|(_, idx)| *idx).collect()
}

fn gen_moves(board: &[u8; NN], my_color: u8, level: u8) -> Vec<Action> {
    let mut empties = Vec::new();
    let mut neutrals = Vec::new();
    let mut own = Vec::new();
    for i in 0..NN {
        match board[i] {
            EMPTY => empties.push(i as u8),
            NEUTRAL => neutrals.push(i as u8),
            c if c == my_color => own.push(i as u8),
            _ => {}
        }
    }

    let can_place = empties.len() >= 2;
    let can_sub = neutrals.len() >= 2 && !own.is_empty();

    let mut moves = Vec::new();
    if !can_place && !can_sub {
        return moves;
    }

    let cand_mask = gen_candidates(board);

    let k1 = if level <= 1 { 18 } else if level == 2 { 28 } else { 40 };
    let k2 = if level <= 1 { 10 } else if level == 2 { 14 } else { 18 };
    let top_neutrals = if level <= 2 { 10 } else { 14 };
    let top_sac = if level <= 2 { 6 } else { 10 };

    if can_place {
        // Score own placements.
        let mut scored_own = Vec::new();
        for &e in &empties {
            if !cand_mask[e as usize] && level <= 2 {
                continue;
            }
            let x = (e as usize / N) as i32;
            let y = (e as usize % N) as i32;
            let center = -((x - 5).abs() + (y - 5).abs()) * 2;
            scored_own.push((center, e));
        }
        let k = k1.min(scored_own.len().max(1));
        let own_cands = pick_top_k(&mut scored_own, k);

        // Precompute "critical" empties for opponent (roughly on shortest corridor).
        let opp = if my_color == BLACK { WHITE } else { BLACK };
        let mut opp_score = vec![(0i32, 0u8); 0];
        // Cheap: consider empties closer to opponent's end edges using distance after neutral.
        for &e in &empties {
            let x = (e as usize / N) as i32;
            let y = (e as usize % N) as i32;
            let edge_bias = if opp == BLACK { -((y - 5).abs()) } else { -((x - 5).abs()) };
            opp_score.push((edge_bias, e));
        }
        opp_score.sort_by(|a, b| b.0.cmp(&a.0));
        if opp_score.len() > 60 {
            opp_score.truncate(60);
        }
        let neutral_pool: Vec<u8> = opp_score.iter().map(|(_, e)| *e).collect();

        for &o in &own_cands {
            // Choose neutral candidates from a pool and rescore with quick deltas.
            let mut scored_neu = Vec::new();
            for &n in &neutral_pool {
                if n == o {
                    continue;
                }
                // Local heuristic: neutral near opponent corridor, and avoid center if possible.
                let nx = (n as usize / N) as i32;
                let ny = (n as usize % N) as i32;
                let center = (nx - 5).abs() + (ny - 5).abs();
                scored_neu.push((-(center as i32), n));
            }
            let k = k2.min(scored_neu.len().max(1));
            let neu_cands = pick_top_k(&mut scored_neu, k);

            for &n in &neu_cands {
                moves.push(Action::Place {
                    own: o,
                    neutral: n,
                });
            }
        }
    }

    if can_sub {
        let my_d0 = dist_min(board, my_color, 2) as i32;
        let mut scored_n = Vec::new();
        for &n in &neutrals {
            // If converting this neutral helps our distance, prefer it.
            let mut tmp = *board;
            tmp[n as usize] = my_color;
            let my_d = dist_min(&tmp, my_color, 2) as i32;
            let gain = my_d0 - my_d;
            scored_n.push((gain, n));
        }
        let k = top_neutrals.min(scored_n.len().max(1));
        let n_cands = pick_top_k(&mut scored_n, k);

        // Sacrifice: prefer own pieces far from center.
        let mut scored_s = Vec::new();
        for &p in &own {
            let x = (p as usize / N) as i32;
            let y = (p as usize % N) as i32;
            let d = (x - 5).abs() + (y - 5).abs();
            scored_s.push((d as i32, p));
        }
        let k = top_sac.min(scored_s.len().max(1));
        let sac_cands = pick_top_k(&mut scored_s, k);

        for i in 0..n_cands.len() {
            for j in (i + 1)..n_cands.len() {
                let n1 = n_cands[i];
                let n2 = n_cands[j];
                for &s in &sac_cands {
                    moves.push(Action::Substitute { n1, n2, sac: s });
                }
            }
        }
    }

    moves
}

fn action_to_js(action: Action) -> JsValue {
    fn pos_obj(idx: u8) -> JsValue {
        let o = Object::new();
        let x = (idx as usize / N) as u32;
        let y = (idx as usize % N) as u32;
        let _ = Reflect::set(&o, &JsValue::from_str("x"), &JsValue::from_f64(x as f64));
        let _ = Reflect::set(&o, &JsValue::from_str("y"), &JsValue::from_f64(y as f64));
        o.into()
    }
    let o = Object::new();
    match action {
        Action::Swap => {
            let _ = Reflect::set(&o, &JsValue::from_str("type"), &JsValue::from_str("swap"));
        }
        Action::RefuseSwap => {
            let _ = Reflect::set(&o, &JsValue::from_str("type"), &JsValue::from_str("recusar_swap"));
        }
        Action::Place { own, neutral } => {
            let _ = Reflect::set(&o, &JsValue::from_str("type"), &JsValue::from_str("colocar"));
            let _ = Reflect::set(&o, &JsValue::from_str("own"), &pos_obj(own));
            let _ = Reflect::set(&o, &JsValue::from_str("neutral"), &pos_obj(neutral));
        }
        Action::Substitute { n1, n2, sac } => {
            let _ = Reflect::set(&o, &JsValue::from_str("type"), &JsValue::from_str("substituir"));
            let _ = Reflect::set(&o, &JsValue::from_str("n1"), &pos_obj(n1));
            let _ = Reflect::set(&o, &JsValue::from_str("n2"), &pos_obj(n2));
            let _ = Reflect::set(&o, &JsValue::from_str("sacrifice"), &pos_obj(sac));
        }
    }
    o.into()
}

fn search_best(board: &mut [u8; NN], my_color: u8, level: u8, ms_budget: u32, rng: &mut Rng32) -> Option<Action> {
    let start = Date::now();
    let deadline = start + (ms_budget as f64);

    // Tactical: immediate win by placing own (any neutral).
    if level >= 1 {
        let mut empties = Vec::new();
        for i in 0..NN {
            if board[i] == EMPTY {
                empties.push(i as u8);
            }
        }
        if empties.len() >= 2 {
            for &e in &empties {
                board[e as usize] = my_color;
                if has_win(board, my_color) {
                    board[e as usize] = EMPTY;
                    let n = empties.iter().find(|&&x| x != e).copied().unwrap_or(empties[0]);
                    return Some(Action::Place { own: e, neutral: n });
                }
                board[e as usize] = EMPTY;
            }
        }
    }

    let mut moves = gen_moves(board, my_color, level);
    if moves.is_empty() {
        return None;
    }

    // Easy/Medium: 1-ply
    if level <= 2 {
        let mut scored: Vec<(i32, Action)> = Vec::with_capacity(moves.len());
        let mut best_score = i32::MIN;
        for &mv in &moves {
            if Date::now() >= deadline {
                break;
            }
            let mut tmp = *board;
            match mv {
                Action::Place { own, neutral } => make_place(&mut tmp, my_color, own, neutral),
                Action::Substitute { n1, n2, sac } => make_sub(&mut tmp, my_color, n1, n2, sac),
                _ => {}
            }
            let score = eval_advantage(&tmp, my_color);
            if score > best_score {
                best_score = score;
            }
            scored.push((score, mv));
        }
        scored.sort_by(|a, b| b.0.cmp(&a.0));
        if scored.is_empty() {
            return Some(moves[0]);
        }

        if level == 1 {
            // Randomize among near-best to make "easy" less robotic.
            let delta = 350;
            let top_score = scored[0].0;
            let mut k = 0usize;
            while k < scored.len() && (top_score - scored[k].0) <= delta && k < 5 {
                k += 1;
            }
            let pick = rng.gen_range(k.max(1));
            return Some(scored[pick].1);
        }

        return Some(scored[0].1);
    }

    // Hard/Master: 2-ply negamax αβ (deadline-aware)
    let opp = if my_color == BLACK { WHITE } else { BLACK };
    let mut best = moves[0];
    let mut best_score = i32::MIN;
    let mut alpha = i32::MIN / 4;
    let beta = i32::MAX / 4;

    // Root move ordering: prefer higher static eval.
    moves.sort_by(|a, b| {
        let mut ta = *board;
        let mut tb = *board;
        match *a {
            Action::Place { own, neutral } => make_place(&mut ta, my_color, own, neutral),
            Action::Substitute { n1, n2, sac } => make_sub(&mut ta, my_color, n1, n2, sac),
            _ => {}
        }
        match *b {
            Action::Place { own, neutral } => make_place(&mut tb, my_color, own, neutral),
            Action::Substitute { n1, n2, sac } => make_sub(&mut tb, my_color, n1, n2, sac),
            _ => {}
        }
        eval_advantage(&tb, my_color).cmp(&eval_advantage(&ta, my_color))
    });

    for &mv in &moves {
        if Date::now() >= deadline {
            break;
        }
        match mv {
            Action::Place { own, neutral } => make_place(board, my_color, own, neutral),
            Action::Substitute { n1, n2, sac } => make_sub(board, my_color, n1, n2, sac),
            _ => {}
        }
        if has_win(board, my_color) {
            // Unmake and return immediate.
            match mv {
                Action::Place { own, neutral } => unmake_place(board, own, neutral),
                Action::Substitute { n1, n2, sac } => unmake_sub(board, my_color, n1, n2, sac),
                _ => {}
            }
            return Some(mv);
        }

        // Opponent reply (1-ply best response).
        let opp_moves = gen_moves(board, opp, 2);
        let mut worst_for_us = i32::MAX;
        for &omv in &opp_moves {
            if Date::now() >= deadline {
                break;
            }
            match omv {
                Action::Place { own, neutral } => make_place(board, opp, own, neutral),
                Action::Substitute { n1, n2, sac } => make_sub(board, opp, n1, n2, sac),
                _ => {}
            }
            let s = eval_advantage(board, my_color);
            if s < worst_for_us {
                worst_for_us = s;
            }
            match omv {
                Action::Place { own, neutral } => unmake_place(board, own, neutral),
                Action::Substitute { n1, n2, sac } => unmake_sub(board, opp, n1, n2, sac),
                _ => {}
            }
            if worst_for_us <= alpha {
                break;
            }
        }
        let score = worst_for_us;

        match mv {
            Action::Place { own, neutral } => unmake_place(board, own, neutral),
            Action::Substitute { n1, n2, sac } => unmake_sub(board, my_color, n1, n2, sac),
            _ => {}
        }

        if score > best_score {
            best_score = score;
            best = mv;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            break;
        }
    }

    Some(best)
}

#[wasm_bindgen]
pub fn choose_move(board: Uint8Array, to_play: u8, flags: u8, ms_budget: u32, level: u8, seed: u32) -> JsValue {
    if board.length() as usize != NN {
        return JsValue::NULL;
    }
    let mut cells = [0u8; NN];
    board.copy_to(&mut cells);

    let my_color = if to_play == 0 { BLACK } else { WHITE };
    let mut rng = Rng32::new(seed);

    // Swap decision (only makes sense when current player is the one allowed to swap).
    if (flags & FLAG_SWAP_AVAILABLE) != 0 {
        // If the current position favours the opposite color, swap.
        let score_as_current = eval_advantage(&cells, my_color);
        let score_as_other = eval_advantage(&cells, if my_color == BLACK { WHITE } else { BLACK });

        let should_swap = score_as_other > score_as_current + 800;
        let action = if should_swap {
            Action::Swap
        } else {
            Action::RefuseSwap
        };
        return action_to_js(action);
    }

    let mut work = cells;
    match search_best(&mut work, my_color, level.clamp(1, 4), ms_budget, &mut rng) {
        Some(a) => action_to_js(a),
        None => JsValue::NULL,
    }
}

#[wasm_bindgen]
pub fn debug_eval(board: Uint8Array, to_play: u8, _flags: u8) -> JsValue {
    if board.length() as usize != NN {
        return JsValue::NULL;
    }
    let mut cells = [0u8; NN];
    board.copy_to(&mut cells);
    let my_color = if to_play == 0 { BLACK } else { WHITE };
    let opp = if my_color == BLACK { WHITE } else { BLACK };

    let o = Object::new();
    let _ = Reflect::set(&o, &JsValue::from_str("myDist"), &JsValue::from_f64(dist_min(&cells, my_color, 2) as f64));
    let _ = Reflect::set(&o, &JsValue::from_str("oppDist"), &JsValue::from_f64(dist_min(&cells, opp, 2) as f64));
    let _ = Reflect::set(&o, &JsValue::from_str("score"), &JsValue::from_f64(eval_advantage(&cells, my_color) as f64));
    o.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn neighbours_corner_and_center() {
        let mut out = [0u8; 6];
        assert_eq!(neighbours(0, &mut out), 2);
        assert_eq!(neighbours(Pos::from_xy(5, 5).idx as usize, &mut out), 6);
    }

    #[test]
    fn win_black_vertical_chain() {
        let mut b = [EMPTY; NN];
        for y in 0..N {
            b[Pos::from_xy(5, y).idx as usize] = BLACK;
        }
        assert!(has_win(&b, BLACK));
        assert!(!has_win(&b, WHITE));
    }

    #[test]
    fn dist_empty_board_is_finite() {
        let b = [EMPTY; NN];
        assert_eq!(dist_min(&b, BLACK, 2), 11);
        assert_eq!(dist_min(&b, WHITE, 2), 11);
    }
}
