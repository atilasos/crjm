use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use js_sys::{Date, Function};
use js_sys::{Object, Reflect, Uint8Array};
use std::cell::{Cell, RefCell};
use std::sync::OnceLock;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

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

#[cfg(target_arch = "wasm32")]
thread_local! {
    static PERFORMANCE_CLOCK: Option<(JsValue, Function)> = (|| {
        let performance = Reflect::get(&js_sys::global(), &JsValue::from_str("performance")).ok()?;
        let now = Reflect::get(&performance, &JsValue::from_str("now"))
            .ok()?
            .dyn_into::<Function>()
            .ok()?;
        Some((performance, now))
    })();
}

/// Relógio monotónico em milissegundos. Em runtimes WASM sem
/// `performance.now()`, Date é o fallback inevitavelmente não monotónico.
#[cfg(target_arch = "wasm32")]
fn now_ms() -> f64 {
    PERFORMANCE_CLOCK.with(|clock| {
        clock
            .as_ref()
            .and_then(|(performance, now)| now.call0(performance).ok()?.as_f64())
            .unwrap_or_else(Date::now)
    })
}

#[cfg(not(target_arch = "wasm32"))]
fn now_ms() -> f64 {
    use std::time::Instant;
    static START: OnceLock<Instant> = OnceLock::new();
    START.get_or_init(Instant::now).elapsed().as_secs_f64() * 1000.0
}

#[derive(Clone, Copy)]
struct Rng32 {
    x: u32,
}

impl Rng32 {
    fn new(seed: u32) -> Self {
        Self {
            x: seed ^ 0x9E37_79B9,
        }
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

fn other(color: u8) -> u8 {
    if color == BLACK {
        WHITE
    } else {
        BLACK
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
    let opp = other(my_color);
    if has_win(board, my_color) {
        return 50_000;
    }
    if has_win(board, opp) {
        return -50_000;
    }

    let my_d = dist_min(board, my_color, 2);
    let opp_d = dist_min(board, opp, 2);
    let base = (opp_d as i32 - my_d as i32) * 150; // Increased from 120

    // Threat detection: opponent close to winning is very bad
    let threat_penalty = match opp_d {
        0 => -10000, // Opponent has won (shouldn't reach here)
        1 => -3000,  // Opponent 1 move away from winning
        2 => -1200,  // Opponent 2 moves from winning
        3 => -400,   // Opponent 3 moves from winning
        _ => 0,
    };

    // Our threat bonus: we're close to winning
    let threat_bonus = match my_d {
        0 => 10000, // We've won
        1 => 2500,  // We're 1 move away
        2 => 1000,  // We're 2 moves away
        3 => 300,   // We're 3 moves away
        _ => 0,
    };

    // Centrality signal: prefer owning center-ish cells (helps opening).
    let mut central = 0i32;
    let mut my_pieces = 0i32;
    for idx in 0..NN {
        let v = board[idx];
        if v != my_color {
            continue;
        }
        my_pieces += 1;
        let x = (idx / N) as i32;
        let y = (idx % N) as i32;
        let dx = (x - 5).abs();
        let dy = (y - 5).abs();
        central -= (dx + dy) * 3; // Increased from 1
    }

    // Piece count tiebreaker (slight bonus for more pieces)
    let piece_bonus = my_pieces * 2;

    base + central + threat_penalty + threat_bonus + piece_bonus
}

/// Avaliação rápida para o motor novo: mesma forma que `eval_advantage`, mas com
/// apenas 2 BFS (a vitória é detetada por dist == 0, sem `has_win` extra).
fn eval_fast(board: &[u8; NN], my_color: u8) -> i32 {
    let opp = other(my_color);
    let my_d_raw = dist_min(board, my_color, 2);
    if my_d_raw == 0 {
        return 50_000;
    }
    let opp_d_raw = dist_min(board, opp, 2);
    if opp_d_raw == 0 {
        return -50_000;
    }
    let my_d = my_d_raw.min(500) as i32;
    let opp_d = opp_d_raw.min(500) as i32;
    let base = (opp_d - my_d) * 150;

    let threat_penalty = match opp_d {
        1 => -3000,
        2 => -1200,
        3 => -400,
        _ => 0,
    };
    let threat_bonus = match my_d {
        1 => 2500,
        2 => 1000,
        3 => 300,
        _ => 0,
    };

    let mut central = 0i32;
    let mut my_pieces = 0i32;
    for idx in 0..NN {
        if board[idx] != my_color {
            continue;
        }
        my_pieces += 1;
        let x = (idx / N) as i32;
        let y = (idx % N) as i32;
        central -= ((x - 5).abs() + (y - 5).abs()) * 3;
    }

    base + central + threat_penalty + threat_bonus + my_pieces * 2
}

// ============================================================================
// Motor legado (mantido intacto para N1-N2 e para o duelo de regressão)
// ============================================================================

/// Negamax with alpha-beta pruning for variable depth (motor legado)
fn negamax_legacy(
    board: &mut [u8; NN],
    my_color: u8,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    level: u8,
    deadline: f64,
    nodes: &mut u32,
) -> i32 {
    *nodes += 1;

    // Check time limit
    if now_ms() >= deadline {
        return alpha;
    }

    // Terminal check
    if has_win(board, my_color) {
        return 50_000 + (depth as i32) * 100; // Prefer winning sooner
    }
    let opp = other(my_color);
    if has_win(board, opp) {
        return -50_000 - (depth as i32) * 100; // Avoid losing sooner
    }

    // Leaf node
    if depth == 0 {
        return eval_advantage(board, my_color);
    }

    let moves = gen_moves(board, my_color, level);
    if moves.is_empty() {
        return eval_advantage(board, my_color);
    }

    let mut best_score = i32::MIN / 2;

    for mv in moves {
        // Make move
        match mv {
            Action::Place { own, neutral } => make_place(board, my_color, own, neutral),
            Action::Substitute { n1, n2, sac } => make_sub(board, my_color, n1, n2, sac),
            _ => continue,
        }

        // Recurse (negamax: negate score, swap alpha/beta)
        let score = -negamax_legacy(board, opp, depth - 1, -beta, -alpha, level, deadline, nodes);

        // Unmake move
        match mv {
            Action::Place { own, neutral } => unmake_place(board, own, neutral),
            Action::Substitute { n1, n2, sac } => unmake_sub(board, my_color, n1, n2, sac),
            _ => {}
        }

        if score > best_score {
            best_score = score;
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            break; // Beta cutoff
        }

        // Time check
        if now_ms() >= deadline {
            break;
        }
    }

    best_score
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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

fn apply_action(board: &mut [u8; NN], my_color: u8, mv: Action) {
    match mv {
        Action::Place { own, neutral } => make_place(board, my_color, own, neutral),
        Action::Substitute { n1, n2, sac } => make_sub(board, my_color, n1, n2, sac),
        _ => {}
    }
}

fn undo_action(board: &mut [u8; NN], my_color: u8, mv: Action) {
    match mv {
        Action::Place { own, neutral } => unmake_place(board, own, neutral),
        Action::Substitute { n1, n2, sac } => unmake_sub(board, my_color, n1, n2, sac),
        _ => {}
    }
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

    let k1 = if level <= 1 {
        18
    } else if level == 2 {
        28
    } else {
        40
    };
    let k2 = if level <= 1 {
        10
    } else if level == 2 {
        14
    } else {
        18
    };
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
        let opp = other(my_color);
        let mut opp_score = vec![(0i32, 0u8); 0];
        // Cheap: consider empties closer to opponent's end edges using distance after neutral.
        for &e in &empties {
            let x = (e as usize / N) as i32;
            let y = (e as usize % N) as i32;
            let edge_bias = if opp == BLACK {
                -((y - 5).abs())
            } else {
                -((x - 5).abs())
            };
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
                moves.push(Action::Place { own: o, neutral: n });
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

// ============================================================================
// Zobrist hashing
// ============================================================================

struct Zobrist {
    /// Chave por célula × estado não-vazio (BLACK/WHITE/NEUTRAL → índice estado-1).
    pieces: [[u64; 3]; NN],
    /// Chave para "brancas a jogar".
    side: u64,
}

fn splitmix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

static ZOBRIST: OnceLock<Zobrist> = OnceLock::new();

fn zobrist() -> &'static Zobrist {
    ZOBRIST.get_or_init(|| {
        let mut s = 0x0DDB_1A5E_5BAD_5EEDu64;
        let mut pieces = [[0u64; 3]; NN];
        for cell in pieces.iter_mut() {
            for key in cell.iter_mut() {
                *key = splitmix64(&mut s);
            }
        }
        let side = splitmix64(&mut s);
        Zobrist { pieces, side }
    })
}

/// Hash completo do tabuleiro + lado a jogar.
fn full_hash(board: &[u8; NN], to_move: u8) -> u64 {
    let z = zobrist();
    let mut h = 0u64;
    for i in 0..NN {
        let v = board[i];
        if v != EMPTY {
            h ^= z.pieces[i][(v - 1) as usize];
        }
    }
    if to_move == WHITE {
        h ^= z.side;
    }
    h
}

/// Delta de hash de uma jogada (XOR simétrico: aplica e desfaz com o mesmo delta).
fn hash_delta(mv: Action, my_color: u8) -> u64 {
    let z = zobrist();
    let mut d = z.side; // troca sempre o lado a jogar
    match mv {
        Action::Place { own, neutral } => {
            d ^= z.pieces[own as usize][(my_color - 1) as usize];
            d ^= z.pieces[neutral as usize][(NEUTRAL - 1) as usize];
        }
        Action::Substitute { n1, n2, sac } => {
            d ^= z.pieces[n1 as usize][(NEUTRAL - 1) as usize]
                ^ z.pieces[n1 as usize][(my_color - 1) as usize];
            d ^= z.pieces[n2 as usize][(NEUTRAL - 1) as usize]
                ^ z.pieces[n2 as usize][(my_color - 1) as usize];
            d ^= z.pieces[sac as usize][(my_color - 1) as usize]
                ^ z.pieces[sac as usize][(NEUTRAL - 1) as usize];
        }
        _ => {}
    }
    d
}

// ============================================================================
// Transposition table
// ============================================================================

const TT_BITS: u32 = 20;
const TT_SIZE: usize = 1 << TT_BITS; // ~1M entradas

const BOUND_NONE: u8 = 0;
const BOUND_EXACT: u8 = 1;
const BOUND_LOWER: u8 = 2;
const BOUND_UPPER: u8 = 3;

#[derive(Clone, Copy)]
struct TtEntry {
    key: u64,
    mv: u32,
    score: i32,
    depth: u8,
    bound: u8,
    age: u8,
}

const TT_EMPTY_ENTRY: TtEntry = TtEntry {
    key: 0,
    mv: 0,
    score: 0,
    depth: 0,
    bound: BOUND_NONE,
    age: 0,
};

thread_local! {
    static TT: RefCell<Vec<TtEntry>> = const { RefCell::new(Vec::new()) };
    static TT_AGE: Cell<u8> = const { Cell::new(0) };
}

fn tt_probe(tt: &[TtEntry], hash: u64) -> Option<TtEntry> {
    let e = tt[(hash as usize) & (TT_SIZE - 1)];
    if e.bound != BOUND_NONE && e.key == hash {
        Some(e)
    } else {
        None
    }
}

fn tt_store(tt: &mut [TtEntry], hash: u64, depth: u8, bound: u8, score: i32, mv: u32, age: u8) {
    let e = &mut tt[(hash as usize) & (TT_SIZE - 1)];
    // Replacement: depth-preferred com aging — substitui se a entrada é de outra
    // pesquisa (age difere), da mesma posição, ou de profundidade não superior.
    if e.bound == BOUND_NONE || e.key == hash || e.age != age || depth >= e.depth {
        *e = TtEntry {
            key: hash,
            mv,
            score,
            depth,
            bound,
            age,
        };
    }
}

/// Codificação compacta de uma jogada (para TT/killers). 0 = nenhuma.
fn encode_move(mv: Action) -> u32 {
    match mv {
        Action::Place { own, neutral } => (1 << 28) | ((own as u32) << 8) | neutral as u32,
        Action::Substitute { n1, n2, sac } => {
            (2 << 28) | ((n1 as u32) << 16) | ((n2 as u32) << 8) | sac as u32
        }
        _ => 0,
    }
}

/// Célula "primária" de uma jogada, usada como índice da history heuristic.
fn primary_cell(mv: Action) -> usize {
    match mv {
        Action::Place { own, .. } => own as usize,
        Action::Substitute { n1, .. } => n1 as usize,
        _ => 0,
    }
}

// ============================================================================
// Motor novo: geração de jogadas, negamax com TT, iterative deepening
// ============================================================================

const MAX_PLY: usize = 28;
const INF: i32 = 1_000_000;
const WIN_SCORE: i32 = 50_000;
/// Verificação do relógio a cada 64 nós, além dos limites da raiz.
const NODE_CHECK_MASK: u32 = 63;

fn deadline_reached(deadline: f64) -> bool {
    now_ms() >= deadline
}

fn adj_counts(board: &[u8; NN], idx: usize, my_color: u8) -> (i32, i32) {
    let mut neigh = [0u8; 6];
    let cnt = neighbours(idx, &mut neigh);
    let opp = other(my_color);
    let mut own_adj = 0i32;
    let mut opp_adj = 0i32;
    for i in 0..cnt {
        let v = board[neigh[i] as usize];
        if v == my_color {
            own_adj += 1;
        } else if v == opp {
            opp_adj += 1;
        }
    }
    (own_adj, opp_adj)
}

/// Geração de jogadas do motor novo. `wide` alarga os candidatos (usado na raiz);
/// nos nós internos o conjunto é mais estreito para permitir profundidade 6-8.
fn gen_moves_new_until(
    board: &[u8; NN],
    my_color: u8,
    wide: bool,
    deadline: f64,
) -> Option<Vec<Action>> {
    let (k_own, k_neu, k_sub_n, k_sub_s) = if wide {
        (26usize, 7usize, 8usize, 5usize)
    } else {
        (12usize, 3usize, 4usize, 3usize)
    };

    let mut empties = Vec::new();
    let mut neutrals = Vec::new();
    let mut own_cells = Vec::new();
    for i in 0..NN {
        if i & 31 == 0 && deadline_reached(deadline) {
            return None;
        }
        match board[i] {
            EMPTY => empties.push(i as u8),
            NEUTRAL => neutrals.push(i as u8),
            c if c == my_color => own_cells.push(i as u8),
            _ => {}
        }
    }

    let can_place = empties.len() >= 2;
    let can_sub = neutrals.len() >= 2 && !own_cells.is_empty();

    let mut moves = Vec::new();
    if !can_place && !can_sub {
        return Some(moves);
    }

    let cand_mask = gen_candidates(board);

    if can_place {
        // Colocações próprias: candidatos a distância <= 2 de qualquer peça,
        // pontuados por centralidade + adjacência (construir ligação / bloquear).
        let mut scored_own: Vec<(i32, u8)> = Vec::new();
        for &e in &empties {
            if deadline_reached(deadline) {
                return None;
            }
            let idx = e as usize;
            if !cand_mask[idx] {
                continue;
            }
            let x = (idx / N) as i32;
            let y = (idx % N) as i32;
            let center = -((x - 5).abs() + (y - 5).abs());
            let (oa, pa) = adj_counts(board, idx, my_color);
            scored_own.push((center * 2 + oa * 5 + pa * 4, e));
        }
        if scored_own.is_empty() {
            for &e in &empties {
                let idx = e as usize;
                let x = (idx / N) as i32;
                let y = (idx % N) as i32;
                scored_own.push((-((x - 5).abs() + (y - 5).abs()), e));
            }
        }
        let k = k_own.min(scored_own.len());
        let own_cands = pick_top_k(&mut scored_own, k);

        // Pool de neutras: perto das peças adversárias e do centro (bloqueio).
        let mut scored_neu: Vec<(i32, u8)> = Vec::new();
        for &e in &empties {
            if deadline_reached(deadline) {
                return None;
            }
            let idx = e as usize;
            let x = (idx / N) as i32;
            let y = (idx % N) as i32;
            let center = -((x - 5).abs() + (y - 5).abs());
            let (oa, pa) = adj_counts(board, idx, my_color);
            scored_neu.push((pa * 5 + center - oa, e));
        }
        let k = (k_neu + 3).min(scored_neu.len());
        let pool = pick_top_k(&mut scored_neu, k);

        for &o in &own_cands {
            if deadline_reached(deadline) {
                return None;
            }
            let mut taken = 0usize;
            for &nu in &pool {
                if nu == o {
                    continue;
                }
                moves.push(Action::Place {
                    own: o,
                    neutral: nu,
                });
                taken += 1;
                if taken >= k_neu {
                    break;
                }
            }
        }
    }

    if can_sub {
        // Neutras a converter: perto das nossas peças (prolonga a ligação).
        let mut scored_n: Vec<(i32, u8)> = Vec::new();
        for &nu in &neutrals {
            if deadline_reached(deadline) {
                return None;
            }
            let idx = nu as usize;
            let x = (idx / N) as i32;
            let y = (idx % N) as i32;
            let center = -((x - 5).abs() + (y - 5).abs());
            let (oa, pa) = adj_counts(board, idx, my_color);
            scored_n.push((oa * 6 + pa * 2 + center, nu));
        }
        let k = k_sub_n.min(scored_n.len());
        let n_cands = pick_top_k(&mut scored_n, k);

        // Sacrifício: peça própria longe do centro e pouco ligada.
        let mut scored_s: Vec<(i32, u8)> = Vec::new();
        for &p in &own_cells {
            if deadline_reached(deadline) {
                return None;
            }
            let idx = p as usize;
            let x = (idx / N) as i32;
            let y = (idx % N) as i32;
            let d = (x - 5).abs() + (y - 5).abs();
            let (oa, _) = adj_counts(board, idx, my_color);
            scored_s.push((d * 2 - oa * 3, p));
        }
        let k = k_sub_s.min(scored_s.len());
        let sac_cands = pick_top_k(&mut scored_s, k);

        for i in 0..n_cands.len() {
            if deadline_reached(deadline) {
                return None;
            }
            for j in (i + 1)..n_cands.len() {
                for &s in &sac_cands {
                    moves.push(Action::Substitute {
                        n1: n_cands[i],
                        n2: n_cands[j],
                        sac: s,
                    });
                }
            }
        }
    }

    if deadline_reached(deadline) {
        None
    } else {
        Some(moves)
    }
}

#[cfg(test)]
fn gen_moves_new(board: &[u8; NN], my_color: u8, wide: bool) -> Vec<Action> {
    gen_moves_new_until(board, my_color, wide, f64::INFINITY).unwrap_or_default()
}

struct SearchCtx<'a> {
    tt: &'a mut [TtEntry],
    age: u8,
    killers: [[u32; 2]; MAX_PLY],
    history: [[i32; NN]; 2],
    nodes: u32,
    deadline: f64,
    aborted: bool,
}

impl<'a> SearchCtx<'a> {
    fn check_deadline(&mut self) -> bool {
        if deadline_reached(self.deadline) {
            self.aborted = true;
        }
        self.aborted
    }

    fn bump_history(&mut self, my_color: u8, cell: usize, depth: u8) {
        let side = (my_color - 1) as usize;
        let h = &mut self.history[side][cell];
        *h += (depth as i32) * (depth as i32);
        if *h > 1_000_000 {
            for row in self.history.iter_mut() {
                for v in row.iter_mut() {
                    *v /= 2;
                }
            }
        }
    }
}

/// Negamax com TT, killers e history. `hash` é o hash Zobrist incremental do nó.
fn negamax_tt(
    board: &mut [u8; NN],
    hash: u64,
    my_color: u8,
    depth: u8,
    ply: usize,
    mut alpha: i32,
    beta: i32,
    ctx: &mut SearchCtx,
) -> i32 {
    ctx.nodes += 1;
    if ctx.nodes & NODE_CHECK_MASK == 0 {
        ctx.check_deadline();
    }
    if ctx.aborted {
        return 0;
    }

    let opp = other(my_color);
    if depth == 0 || ply >= MAX_PLY - 1 {
        // eval_fast já deteta vitórias via dist == 0 — dispensa has_win no leaf.
        return eval_fast(board, my_color);
    }
    // Só o último a jogar (opp) pode ter acabado de completar uma ligação:
    // as nossas jogadas nunca alteram células adversárias.
    if has_win(board, opp) {
        return -WIN_SCORE;
    }

    // Antes de TT, reduções ou top-k, procura exaustivamente uma vitória em
    // uma jogada. Se existir, ela é a única candidata necessária.
    let immediate = match find_immediate_win_until(board, my_color, ctx.deadline) {
        Ok(Some(mv)) => Some(mv),
        Ok(None) => match find_immediate_win_sub_until(board, my_color, ctx.deadline) {
            Ok(mv) => mv,
            Err(()) => {
                ctx.aborted = true;
                return 0;
            }
        },
        Err(()) => {
            ctx.aborted = true;
            return 0;
        }
    };

    // TT probe
    let alpha_orig = alpha;
    let mut tt_mv = 0u32;
    if let Some(e) = tt_probe(ctx.tt, hash) {
        tt_mv = e.mv;
        if immediate.is_none() && e.depth >= depth {
            match e.bound {
                BOUND_EXACT => return e.score,
                BOUND_LOWER if e.score >= beta => return e.score,
                BOUND_UPPER if e.score <= alpha => return e.score,
                _ => {}
            }
        }
    }

    let moves = if let Some(mv) = immediate {
        vec![mv]
    } else {
        match gen_moves_new_until(board, my_color, false, ctx.deadline) {
            Some(moves) => moves,
            None => {
                ctx.aborted = true;
                return 0;
            }
        }
    };
    if moves.is_empty() {
        return eval_fast(board, my_color);
    }

    // Move ordering: TT move → killers → history + ordem heurística de geração.
    let side = (my_color - 1) as usize;
    let mut scored: Vec<(i32, Action)> = Vec::with_capacity(moves.len());
    let total = moves.len() as i32;
    for (i, &mv) in moves.iter().enumerate() {
        let enc = encode_move(mv);
        let mut s = total - i as i32; // preserva a ordem de geração como base
        if enc == tt_mv {
            s += 2_000_000;
        } else if enc == ctx.killers[ply][0] {
            s += 900_000;
        } else if enc == ctx.killers[ply][1] {
            s += 850_000;
        }
        s += ctx.history[side][primary_cell(mv)];
        scored.push((s, mv));
    }
    scored.sort_by(|a, b| b.0.cmp(&a.0));

    let mut best = -INF;
    let mut best_mv = 0u32;
    for (move_idx, &(_, mv)) in scored.iter().enumerate() {
        let child_hash = hash ^ hash_delta(mv, my_color);
        apply_action(board, my_color, mv);
        // PVS + LMR: primeira jogada com janela completa; as restantes com
        // janela nula (e profundidade reduzida para jogadas tardias),
        // re-pesquisando apenas quando o resultado entra na janela.
        let score = if move_idx == 0 {
            -negamax_tt(
                board,
                child_hash,
                opp,
                depth - 1,
                ply + 1,
                -beta,
                -alpha,
                ctx,
            )
        } else {
            let reduced = if depth >= 5 && move_idx >= 18 {
                depth - 4
            } else if depth >= 4 && move_idx >= 10 {
                depth - 3
            } else if depth >= 3 && move_idx >= 4 {
                depth - 2
            } else {
                depth - 1
            };
            let mut s = -negamax_tt(
                board,
                child_hash,
                opp,
                reduced,
                ply + 1,
                -alpha - 1,
                -alpha,
                ctx,
            );
            if s > alpha && reduced < depth - 1 && !ctx.aborted {
                s = -negamax_tt(
                    board,
                    child_hash,
                    opp,
                    depth - 1,
                    ply + 1,
                    -alpha - 1,
                    -alpha,
                    ctx,
                );
            }
            if s > alpha && s < beta && !ctx.aborted {
                s = -negamax_tt(
                    board,
                    child_hash,
                    opp,
                    depth - 1,
                    ply + 1,
                    -beta,
                    -alpha,
                    ctx,
                );
            }
            s
        };
        undo_action(board, my_color, mv);
        if ctx.aborted {
            return 0;
        }

        if score > best {
            best = score;
            best_mv = encode_move(mv);
        }
        if score > alpha {
            alpha = score;
        }
        if alpha >= beta {
            // Killer + history no cutoff
            let enc = encode_move(mv);
            if ctx.killers[ply][0] != enc {
                ctx.killers[ply][1] = ctx.killers[ply][0];
                ctx.killers[ply][0] = enc;
            }
            ctx.bump_history(my_color, primary_cell(mv), depth);
            break;
        }
    }

    let bound = if best <= alpha_orig {
        BOUND_UPPER
    } else if best >= beta {
        BOUND_LOWER
    } else {
        BOUND_EXACT
    };
    if ctx.check_deadline() {
        return 0;
    }
    tt_store(ctx.tt, hash, depth, bound, best, best_mv, ctx.age);

    best
}

/// Vitória imediata por colocação (partilhado entre motores).
fn find_immediate_win_until(
    board: &mut [u8; NN],
    my_color: u8,
    deadline: f64,
) -> Result<Option<Action>, ()> {
    let mut empties = Vec::new();
    for i in 0..NN {
        if i & 31 == 0 && deadline_reached(deadline) {
            return Err(());
        }
        if board[i] == EMPTY {
            empties.push(i as u8);
        }
    }
    if empties.len() < 2 {
        return Ok(None);
    }
    for &e in &empties {
        if deadline_reached(deadline) {
            return Err(());
        }
        board[e as usize] = my_color;
        let won = has_win(board, my_color);
        board[e as usize] = EMPTY;
        if won {
            let nu = empties
                .iter()
                .find(|&&x| x != e)
                .copied()
                .unwrap_or(empties[0]);
            return Ok(Some(Action::Place {
                own: e,
                neutral: nu,
            }));
        }
    }
    Ok(None)
}

fn find_immediate_win(board: &mut [u8; NN], my_color: u8) -> Option<Action> {
    find_immediate_win_until(board, my_color, f64::INFINITY)
        .ok()
        .flatten()
}

/// Vitória imediata por substituição: converter duas neutras pode completar a
/// ligação. Testa todos os pares de neutras e, ao encontrar um par vencedor,
/// escolhe um sacrifício que não quebre a vitória. Cobre o caso em que a poda
/// heurística de candidatos (top-k) excluiria a substituição vencedora.
fn find_immediate_win_sub_until(
    board: &mut [u8; NN],
    my_color: u8,
    deadline: f64,
) -> Result<Option<Action>, ()> {
    let mut neutrals = Vec::new();
    let mut own_cells = Vec::new();
    for i in 0..NN {
        if i & 31 == 0 && deadline_reached(deadline) {
            return Err(());
        }
        if board[i] == NEUTRAL {
            neutrals.push(i as u8);
        } else if board[i] == my_color {
            own_cells.push(i as u8);
        }
    }
    if neutrals.len() < 2 || own_cells.is_empty() {
        return Ok(None);
    }

    for i in 0..neutrals.len() {
        for j in (i + 1)..neutrals.len() {
            if deadline_reached(deadline) {
                return Err(());
            }
            let n1 = neutrals[i];
            let n2 = neutrals[j];
            board[n1 as usize] = my_color;
            board[n2 as usize] = my_color;
            let pair_wins = has_win(board, my_color);
            if pair_wins {
                // Sacrifício que preserve a ligação vencedora.
                for &s in &own_cells {
                    if deadline_reached(deadline) {
                        board[n1 as usize] = NEUTRAL;
                        board[n2 as usize] = NEUTRAL;
                        return Err(());
                    }
                    board[s as usize] = NEUTRAL;
                    let still_wins = has_win(board, my_color);
                    board[s as usize] = my_color;
                    if still_wins {
                        board[n1 as usize] = NEUTRAL;
                        board[n2 as usize] = NEUTRAL;
                        return Ok(Some(Action::Substitute { n1, n2, sac: s }));
                    }
                }
            }
            board[n1 as usize] = NEUTRAL;
            board[n2 as usize] = NEUTRAL;
        }
    }
    Ok(None)
}

fn first_legal_move(board: &[u8; NN], my_color: u8) -> Option<Action> {
    let mut first_empty = None;
    for i in 0..NN {
        if board[i] == EMPTY {
            if let Some(own) = first_empty {
                return Some(Action::Place {
                    own,
                    neutral: i as u8,
                });
            }
            first_empty = Some(i as u8);
        }
    }

    let mut neutral1 = None;
    let mut neutral2 = None;
    let mut sacrifice = None;
    for i in 0..NN {
        if board[i] == NEUTRAL {
            if neutral1.is_none() {
                neutral1 = Some(i as u8);
            } else if neutral2.is_none() {
                neutral2 = Some(i as u8);
            }
        } else if board[i] == my_color && sacrifice.is_none() {
            sacrifice = Some(i as u8);
        }
    }
    Some(Action::Substitute {
        n1: neutral1?,
        n2: neutral2?,
        sac: sacrifice?,
    })
}

/// Iterative deepening com TT/killers/history. Devolve a melhor jogada da última
/// profundidade COMPLETA e essa profundidade, usando um deadline já iniciado.
fn search_best_id_until(
    board: &mut [u8; NN],
    my_color: u8,
    level: u8,
    deadline: f64,
) -> Option<(Action, u8)> {
    let max_depth: u8 = if level >= 4 { 24 } else { 8 };
    let fallback = first_legal_move(board, my_color)?;

    let immediate = match find_immediate_win_until(board, my_color, deadline) {
        Ok(Some(mv)) => Some(mv),
        Ok(None) => match find_immediate_win_sub_until(board, my_color, deadline) {
            Ok(mv) => mv,
            Err(()) => return Some((fallback, 0)),
        },
        Err(()) => return Some((fallback, 0)),
    };
    if let Some(mv) = immediate {
        return Some((mv, 0));
    }

    let root_moves = match gen_moves_new_until(board, my_color, true, deadline) {
        Some(moves) => moves,
        None => return Some((fallback, 0)),
    };
    if root_moves.is_empty() {
        return None;
    }

    let opp = other(my_color);
    let root_hash = full_hash(board, my_color);

    // Ordenação inicial por avaliação estática.
    let mut ordered: Vec<(i32, Action)> = Vec::with_capacity(root_moves.len());
    let mut best = fallback;
    for &mv in &root_moves {
        if deadline_reached(deadline) {
            return Some((best, 0));
        }
        apply_action(board, my_color, mv);
        let s = eval_fast(board, my_color);
        undo_action(board, my_color, mv);
        best = mv;
        if deadline_reached(deadline) {
            return Some((best, 0));
        }
        ordered.push((s, mv));
    }
    ordered.sort_by(|a, b| b.0.cmp(&a.0));
    if deadline_reached(deadline) {
        return Some((ordered.first().map(|x| x.1).unwrap_or(best), 0));
    }

    best = ordered[0].1;
    let mut completed: u8 = 0;

    let age = TT_AGE.with(|a| {
        let v = a.get().wrapping_add(1);
        a.set(v);
        v
    });

    TT.with(|tt_cell| {
        let mut tt = tt_cell.borrow_mut();
        if tt.len() > TT_SIZE {
            tt.truncate(TT_SIZE);
        }
        while tt.len() < TT_SIZE {
            if deadline_reached(deadline) {
                return;
            }
            let next_len = (tt.len() + 16_384).min(TT_SIZE);
            tt.resize(next_len, TT_EMPTY_ENTRY);
        }
        if deadline_reached(deadline) {
            return;
        }

        let mut ctx = SearchCtx {
            tt: &mut tt,
            age,
            killers: [[0u32; 2]; MAX_PLY],
            history: [[0i32; NN]; 2],
            nodes: 0,
            deadline,
            aborted: false,
        };

        for depth in 1..=max_depth {
            if ctx.check_deadline() {
                break;
            }

            let mut alpha = -INF;
            let beta = INF;
            let mut iter_best = ordered[0].1;
            let mut iter_best_score = -INF;
            let mut iter_scores: Vec<(i32, Action)> = Vec::with_capacity(ordered.len());

            for (move_idx, &(_, mv)) in ordered.iter().enumerate() {
                if ctx.check_deadline() {
                    break;
                }
                let child_hash = root_hash ^ hash_delta(mv, my_color);
                apply_action(board, my_color, mv);
                // PVS na raiz: janela nula após a primeira jogada.
                let score = if move_idx == 0 {
                    -negamax_tt(
                        board,
                        child_hash,
                        opp,
                        depth - 1,
                        1,
                        -beta,
                        -alpha,
                        &mut ctx,
                    )
                } else {
                    let s = -negamax_tt(
                        board,
                        child_hash,
                        opp,
                        depth - 1,
                        1,
                        -alpha - 1,
                        -alpha,
                        &mut ctx,
                    );
                    if s > alpha && !ctx.aborted {
                        -negamax_tt(
                            board,
                            child_hash,
                            opp,
                            depth - 1,
                            1,
                            -beta,
                            -alpha,
                            &mut ctx,
                        )
                    } else {
                        s
                    }
                };
                undo_action(board, my_color, mv);
                if ctx.check_deadline() {
                    break;
                }
                iter_scores.push((score, mv));
                if score > iter_best_score {
                    iter_best_score = score;
                    iter_best = mv;
                }
                if score > alpha {
                    alpha = score;
                }
            }

            if ctx.aborted {
                break; // mantém a melhor jogada da última profundidade completa
            }

            iter_scores.sort_by(|a, b| b.0.cmp(&a.0));
            if ctx.check_deadline() {
                break;
            }

            best = iter_best;
            completed = depth;
            ordered = iter_scores;

            if iter_best_score >= WIN_SCORE {
                break; // vitória forçada encontrada
            }
        }
    });

    Some((best, completed))
}

#[cfg(test)]
fn search_best_id(
    board: &mut [u8; NN],
    my_color: u8,
    level: u8,
    ms_budget: u32,
) -> Option<(Action, u8)> {
    let deadline = now_ms() + ms_budget as f64;
    search_best_id_until(board, my_color, level, deadline)
}

// ============================================================================
// Raiz de pesquisa (dispatcher por nível) e interface JS
// ============================================================================

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
            let _ = Reflect::set(
                &o,
                &JsValue::from_str("type"),
                &JsValue::from_str("recusar_swap"),
            );
        }
        Action::Place { own, neutral } => {
            let _ = Reflect::set(
                &o,
                &JsValue::from_str("type"),
                &JsValue::from_str("colocar"),
            );
            let _ = Reflect::set(&o, &JsValue::from_str("own"), &pos_obj(own));
            let _ = Reflect::set(&o, &JsValue::from_str("neutral"), &pos_obj(neutral));
        }
        Action::Substitute { n1, n2, sac } => {
            let _ = Reflect::set(
                &o,
                &JsValue::from_str("type"),
                &JsValue::from_str("substituir"),
            );
            let _ = Reflect::set(&o, &JsValue::from_str("n1"), &pos_obj(n1));
            let _ = Reflect::set(&o, &JsValue::from_str("n2"), &pos_obj(n2));
            let _ = Reflect::set(&o, &JsValue::from_str("sacrifice"), &pos_obj(sac));
        }
    }
    o.into()
}

/// Motor legado (fixed-depth negamax). Mantido para N1-N2 (preserva o
/// comportamento dos presets) e para duelos de regressão contra o motor novo.
fn search_best_legacy(
    board: &mut [u8; NN],
    my_color: u8,
    level: u8,
    ms_budget: u32,
    rng: &mut Rng32,
) -> Option<Action> {
    let start = now_ms();
    let deadline = start + (ms_budget as f64);

    // Tactical: immediate win by placing own (any neutral).
    if level >= 1 {
        if let Some(a) = find_immediate_win(board, my_color) {
            return Some(a);
        }
    }

    let moves = gen_moves(board, my_color, level);
    if moves.is_empty() {
        return None;
    }

    // Determine search depth based on level:
    // Level 1 (Easy): 1-ply with randomization
    // Level 2 (Medium): 2-ply search
    // Level 3 (Hard): 3-ply with iterative deepening
    // Level 4 (Master): 4-ply with iterative deepening
    let max_depth: u8 = match level {
        1 => 1,
        2 => 2,
        3 => 3,
        _ => 4,
    };

    let opp = other(my_color);

    // Pre-score moves for ordering
    let mut scored: Vec<(i32, Action)> = Vec::with_capacity(moves.len());
    for &mv in &moves {
        let mut tmp = *board;
        match mv {
            Action::Place { own, neutral } => make_place(&mut tmp, my_color, own, neutral),
            Action::Substitute { n1, n2, sac } => make_sub(&mut tmp, my_color, n1, n2, sac),
            _ => continue,
        }
        let score = eval_advantage(&tmp, my_color);
        scored.push((score, mv));
    }
    scored.sort_by(|a, b| b.0.cmp(&a.0));

    if scored.is_empty() {
        return Some(moves[0]);
    }

    // Easy mode: 1-ply with randomization among near-best moves
    if level == 1 {
        let delta = 350;
        let top_score = scored[0].0;
        let mut k = 0usize;
        while k < scored.len() && (top_score - scored[k].0) <= delta && k < 5 {
            k += 1;
        }
        let pick = rng.gen_range(k.max(1));
        return Some(scored[pick].1);
    }

    // Medium/Hard/Master: Iterative deepening with negamax
    let mut best = scored[0].1;
    let mut ordered_moves: Vec<Action> = scored.into_iter().map(|(_, mv)| mv).collect();

    // Iterative deepening: start from depth 1 and increase
    for depth in 1..=max_depth {
        if now_ms() >= deadline {
            break;
        }

        let mut depth_best = ordered_moves[0];
        let mut depth_best_score = i32::MIN / 2;
        let mut alpha = i32::MIN / 4;
        let beta = i32::MAX / 4;
        let mut nodes = 0u32;

        for &mv in &ordered_moves {
            if now_ms() >= deadline {
                break;
            }

            // Make move
            match mv {
                Action::Place { own, neutral } => make_place(board, my_color, own, neutral),
                Action::Substitute { n1, n2, sac } => make_sub(board, my_color, n1, n2, sac),
                _ => continue,
            }

            // Immediate win check
            if has_win(board, my_color) {
                match mv {
                    Action::Place { own, neutral } => unmake_place(board, own, neutral),
                    Action::Substitute { n1, n2, sac } => unmake_sub(board, my_color, n1, n2, sac),
                    _ => {}
                }
                return Some(mv);
            }

            // Search deeper
            let score = if depth == 1 {
                eval_advantage(board, my_color)
            } else {
                -negamax_legacy(
                    board,
                    opp,
                    depth - 1,
                    -beta,
                    -alpha,
                    level,
                    deadline,
                    &mut nodes,
                )
            };

            // Unmake move
            match mv {
                Action::Place { own, neutral } => unmake_place(board, own, neutral),
                Action::Substitute { n1, n2, sac } => unmake_sub(board, my_color, n1, n2, sac),
                _ => {}
            }

            if score > depth_best_score {
                depth_best_score = score;
                depth_best = mv;
            }
            if score > alpha {
                alpha = score;
            }
            if alpha >= beta {
                break;
            }
        }

        // Only update best if we completed this depth in time
        if now_ms() < deadline {
            best = depth_best;

            // Move best to front for next iteration (improves pruning)
            if let Some(pos) = ordered_moves.iter().position(|m| *m == depth_best) {
                ordered_moves.remove(pos);
                ordered_moves.insert(0, depth_best);
            }
        }
    }

    Some(best)
}

/// Dispatcher: N1-N2 usam o motor legado (preserva os presets fracos);
/// N3-N4 usam o motor novo (Zobrist + TT + iterative deepening).
fn search_best(
    board: &mut [u8; NN],
    my_color: u8,
    level: u8,
    ms_budget: u32,
    rng: &mut Rng32,
) -> Option<Action> {
    if level <= 2 {
        return search_best_legacy(board, my_color, level, ms_budget, rng);
    }
    let deadline = now_ms() + ms_budget as f64;
    search_best_id_until(board, my_color, level, deadline).map(|(a, _)| a)
}

#[wasm_bindgen]
pub fn choose_move(
    board: Uint8Array,
    to_play: u8,
    flags: u8,
    ms_budget: u32,
    level: u8,
    seed: u32,
) -> JsValue {
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
        let score_as_other = eval_advantage(&cells, other(my_color));

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
    let opp = other(my_color);

    let o = Object::new();
    let _ = Reflect::set(
        &o,
        &JsValue::from_str("myDist"),
        &JsValue::from_f64(dist_min(&cells, my_color, 2) as f64),
    );
    let _ = Reflect::set(
        &o,
        &JsValue::from_str("oppDist"),
        &JsValue::from_f64(dist_min(&cells, opp, 2) as f64),
    );
    let _ = Reflect::set(
        &o,
        &JsValue::from_str("score"),
        &JsValue::from_f64(eval_advantage(&cells, my_color) as f64),
    );
    o.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn action_is_legal(board: &[u8; NN], my_color: u8, a: Action) -> bool {
        match a {
            Action::Place { own, neutral } => {
                own != neutral && board[own as usize] == EMPTY && board[neutral as usize] == EMPTY
            }
            Action::Substitute { n1, n2, sac } => {
                n1 != n2
                    && board[n1 as usize] == NEUTRAL
                    && board[n2 as usize] == NEUTRAL
                    && board[sac as usize] == my_color
            }
            _ => true,
        }
    }

    /// Gera uma posição pseudo-aleatória legal com `plies` jogadas de colocação.
    fn random_position(seed: u32, plies: usize) -> ([u8; NN], u8) {
        let mut rng = Rng32::new(seed);
        let mut board = [EMPTY; NN];
        let mut color = BLACK;
        for _ in 0..plies {
            let empties: Vec<u8> = (0..NN)
                .filter(|&i| board[i] == EMPTY)
                .map(|i| i as u8)
                .collect();
            if empties.len() < 2 {
                break;
            }
            let own = empties[rng.gen_range(empties.len())];
            let mut neutral = empties[rng.gen_range(empties.len())];
            while neutral == own {
                neutral = empties[rng.gen_range(empties.len())];
            }
            make_place(&mut board, color, own, neutral);
            if has_win(&board, color) {
                unmake_place(&mut board, own, neutral);
                break;
            }
            color = other(color);
        }
        (board, color)
    }

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

    #[test]
    fn zobrist_incremental_matches_full_rehash() {
        // Aplica jogadas (place e substitute) com delta incremental e compara
        // com o rehash completo; verifica também que unmake repõe o hash.
        for seed in [1u32, 7, 42, 1234] {
            let (mut board, mut color) = random_position(seed, 12);
            let mut hash = full_hash(&board, color);
            let mut rng = Rng32::new(seed ^ 0xDEAD);

            for _ in 0..30 {
                let moves = gen_moves_new(&board, color, true);
                if moves.is_empty() {
                    break;
                }
                let mv = moves[rng.gen_range(moves.len())];
                assert!(action_is_legal(&board, color, mv));

                let h_before = hash;
                let delta = hash_delta(mv, color);
                apply_action(&mut board, color, mv);
                hash ^= delta;
                assert_eq!(
                    hash,
                    full_hash(&board, other(color)),
                    "hash incremental difere do rehash completo (seed {seed})"
                );

                // Unmake repõe exatamente o hash anterior.
                undo_action(&mut board, color, mv);
                assert_eq!(hash ^ delta, h_before);
                assert_eq!(h_before, full_hash(&board, color));

                // Reaplica e continua o jogo.
                apply_action(&mut board, color, mv);
                if has_win(&board, color) {
                    break;
                }
                color = other(color);
            }
        }
    }

    #[test]
    fn zobrist_side_to_move_distinguishes() {
        let (board, _) = random_position(9, 8);
        assert_ne!(full_hash(&board, BLACK), full_hash(&board, WHITE));
    }

    #[test]
    fn tt_store_probe_roundtrip() {
        let mut tt = vec![TT_EMPTY_ENTRY; TT_SIZE];
        let hash = 0x1234_5678_9ABC_DEF0u64;
        let mv = encode_move(Action::Place {
            own: 60,
            neutral: 61,
        });
        tt_store(&mut tt, hash, 5, BOUND_EXACT, 321, mv, 1);

        let e = tt_probe(&tt, hash).expect("entrada TT em falta");
        assert_eq!(e.score, 321);
        assert_eq!(e.depth, 5);
        assert_eq!(e.bound, BOUND_EXACT);
        assert_eq!(e.mv, mv);

        // Hash diferente com o mesmo índice não devolve entrada (key check).
        let other_hash = hash ^ (1u64 << 40); // mesmo índice nos bits baixos
        assert!(tt_probe(&tt, other_hash).is_none());

        // Depth-preferred: profundidade inferior com o mesmo age e hash de célula
        // diferente não substitui.
        tt_store(&mut tt, other_hash, 2, BOUND_LOWER, -50, 0, 1);
        let e = tt_probe(&tt, hash).expect("entrada substituída indevidamente");
        assert_eq!(e.depth, 5);
        // Age diferente substitui sempre.
        tt_store(&mut tt, other_hash, 1, BOUND_UPPER, -7, 0, 2);
        let e = tt_probe(&tt, other_hash).expect("aging não substituiu");
        assert_eq!(e.score, -7);
    }

    #[test]
    fn tt_search_produces_sane_root_entry_and_legal_move() {
        let (mut board, color) = random_position(21, 10);
        let (mv, depth) = search_best_id(&mut board, color, 4, 150).expect("sem jogada");
        assert!(depth >= 1, "nenhuma profundidade completa em 150ms");
        assert!(action_is_legal(&board, color, mv));

        // Após a pesquisa, os filhos da raiz devem ter entradas TT com jogadas
        // legais (o TT move é usado apenas para ordenação, mas deve ser são).
        TT.with(|tt_cell| {
            let tt = tt_cell.borrow();
            let root_hash = full_hash(&board, color);
            let child_hash = root_hash ^ hash_delta(mv, color);
            let mut child = board;
            apply_action(&mut child, color, mv);
            if let Some(e) = tt_probe(&tt, child_hash) {
                assert!(e.bound <= BOUND_UPPER);
                assert!(e.score.abs() <= INF);
            }
        });
    }

    #[test]
    fn id_always_returns_legal_move() {
        // Vários budgets, incluindo minúsculos (aborto quase imediato), e
        // posições variadas: a jogada devolvida tem de ser sempre legal.
        for seed in [3u32, 11, 99, 500, 777] {
            for plies in [0usize, 4, 15, 30] {
                for budget in [1u32, 10, 60] {
                    let (mut board, color) =
                        random_position(seed.wrapping_add(plies as u32), plies);
                    let before = board;
                    if let Some((mv, _)) = search_best_id(&mut board, color, 4, budget) {
                        assert_eq!(board, before, "pesquisa não repôs o tabuleiro");
                        assert!(
                            action_is_legal(&board, color, mv),
                            "jogada ilegal (seed {seed}, plies {plies}, budget {budget})"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn dispatcher_finds_immediate_win() {
        // Preto com cadeia quase completa: falta (5,10). O motor novo tem de a ver.
        let mut b = [EMPTY; NN];
        for y in 0..(N - 1) {
            b[Pos::from_xy(5, y).idx as usize] = BLACK;
        }
        let mut rng = Rng32::new(1);
        let mv = search_best(&mut b, BLACK, 4, 100, &mut rng).expect("sem jogada");
        match mv {
            Action::Place { own, .. } => {
                let mut after = b;
                after[own as usize] = BLACK;
                assert!(has_win(&after, BLACK), "não jogou a vitória imediata");
            }
            _ => panic!("esperava colocação vencedora, veio {mv:?}"),
        }
    }

    #[test]
    fn finds_winning_substitution_outside_heuristic_topk() {
        // Brancas ligam x=0 -> x=10. Cadeia branca em (1..=9, 2); as duas pontas
        // (0,2) e (10,2) são neutras — a ÚNICA vitória imediata é a substituição
        // que converte ambas. 10 neutras "isco" junto ao centro, adjacentes a
        // brancas, pontuam acima das pontas na heurística, empurrando o par
        // vencedor para fora do top-8 de candidatos a substituição.
        let mut b = [EMPTY; NN];
        for x in 1..=9usize {
            b[Pos::from_xy(x, 2).idx as usize] = WHITE;
        }
        b[Pos::from_xy(0, 2).idx as usize] = NEUTRAL;
        b[Pos::from_xy(10, 2).idx as usize] = NEUTRAL;
        // Aglomerado branco central (candidatos a sacrifício fora do caminho).
        for (x, y) in [(4usize, 5usize), (6, 5), (4, 7), (6, 7)] {
            b[Pos::from_xy(x, y).idx as usize] = WHITE;
        }
        // Iscos: neutras centrais adjacentes a brancas do aglomerado.
        for (x, y) in [
            (3usize, 5usize),
            (5, 5),
            (4, 4),
            (4, 6),
            (7, 5),
            (6, 4),
            (6, 6),
            (3, 7),
            (5, 7),
            (7, 7),
        ] {
            b[Pos::from_xy(x, y).idx as usize] = NEUTRAL;
        }

        let end1 = Pos::from_xy(0, 2).idx;
        let end2 = Pos::from_xy(10, 2).idx;

        // Nenhuma colocação única vence (ambas as pontas estão ocupadas por neutras).
        {
            let mut tmp = b;
            assert!(find_immediate_win(&mut tmp, WHITE).is_none());
        }

        // A poda heurística exclui qualquer jogada imediatamente vencedora da
        // lista de candidatos da raiz (é este o cenário do finding).
        for mv in gen_moves_new(&b, WHITE, true) {
            let mut tmp = b;
            apply_action(&mut tmp, WHITE, mv);
            assert!(
                !has_win(&tmp, WHITE),
                "cenário inválido: geração top-k incluiu jogada vencedora {mv:?}"
            );
        }

        // O motor (dispatcher N4) tem de encontrar a substituição vencedora.
        let mut rng = Rng32::new(7);
        let mut work = b;
        let mv = search_best(&mut work, WHITE, 4, 200, &mut rng).expect("sem jogada");
        match mv {
            Action::Substitute { n1, n2, sac } => {
                let pair = [n1.min(n2), n1.max(n2)];
                assert_eq!(pair, [end1.min(end2), end1.max(end2)], "par errado: {mv:?}");
                let mut after = b;
                make_sub(&mut after, WHITE, n1, n2, sac);
                assert!(has_win(&after, WHITE), "substituição não vence");
            }
            _ => panic!("esperava substituição vencedora, veio {mv:?}"),
        }
    }

    #[test]
    fn internal_node_finds_immediate_substitution_outside_topk() {
        // Mesmo tipo de ameaça, mas pesquisada diretamente num ply interno:
        // o par vencedor fica fora do top-k e tem de ser injetado antes da poda.
        let mut b = [EMPTY; NN];
        for x in 1..=9usize {
            b[Pos::from_xy(x, 2).idx as usize] = WHITE;
        }
        b[Pos::from_xy(0, 2).idx as usize] = NEUTRAL;
        b[Pos::from_xy(10, 2).idx as usize] = NEUTRAL;
        for (x, y) in [(4usize, 5usize), (6, 5), (4, 7), (6, 7)] {
            b[Pos::from_xy(x, y).idx as usize] = WHITE;
        }
        for (x, y) in [
            (3usize, 5usize),
            (5, 5),
            (4, 4),
            (4, 6),
            (7, 5),
            (6, 4),
            (6, 6),
            (3, 7),
            (5, 7),
            (7, 7),
        ] {
            b[Pos::from_xy(x, y).idx as usize] = NEUTRAL;
        }

        for mv in gen_moves_new(&b, WHITE, false) {
            let mut tmp = b;
            apply_action(&mut tmp, WHITE, mv);
            assert!(!has_win(&tmp, WHITE), "top-k interno incluiu {mv:?}");
        }

        let before = b;
        let mut tt = vec![TT_EMPTY_ENTRY; TT_SIZE];
        let mut ctx = SearchCtx {
            tt: &mut tt,
            age: 1,
            killers: [[0u32; 2]; MAX_PLY],
            history: [[0i32; NN]; 2],
            nodes: 0,
            deadline: now_ms() + 10_000.0,
            aborted: false,
        };
        let hash = full_hash(&b, WHITE);
        let score = negamax_tt(&mut b, hash, WHITE, 1, 3, -INF, INF, &mut ctx);

        assert!(!ctx.aborted);
        assert_eq!(score, WIN_SCORE);
        assert_eq!(b, before, "o scan tático interno alterou o tabuleiro");
    }

    // ------------------------------------------------------------------
    // Duelo motor novo vs legado + latência + profundidade efetiva.
    // Correr com: cargo test --release -- --ignored --nocapture
    // ------------------------------------------------------------------

    const DUEL_BUDGET_MS: u32 = 200;

    /// Joga um jogo completo; devolve (pontos do motor novo, overshoot máx em ms).
    fn play_duel_game(new_plays_black: bool, seed: u32) -> (f64, f64) {
        let mut board = [EMPTY; NN];
        let mut color = BLACK;
        let mut rng = Rng32::new(seed);
        let mut max_overshoot: f64 = 0.0;
        let mut moves_played = 0usize;

        loop {
            let is_new = (color == BLACK) == new_plays_black;
            let mut work = board;
            let t0 = now_ms();
            let action = if is_new {
                search_best(&mut work, color, 4, DUEL_BUDGET_MS, &mut rng)
            } else {
                search_best_legacy(&mut work, color, 4, DUEL_BUDGET_MS, &mut rng)
            };
            let dt = now_ms() - t0;
            max_overshoot = max_overshoot.max(dt - DUEL_BUDGET_MS as f64);

            let Some(mv) = action else {
                return (0.5, max_overshoot); // sem jogadas: empate
            };
            assert!(
                action_is_legal(&board, color, mv),
                "jogada ilegal no duelo ({})",
                if is_new { "novo" } else { "legado" }
            );
            apply_action(&mut board, color, mv);
            if has_win(&board, color) {
                return (if is_new { 1.0 } else { 0.0 }, max_overshoot);
            }
            moves_played += 1;
            if moves_played > 200 {
                return (0.5, max_overshoot);
            }
            color = other(color);
        }
    }

    #[test]
    #[ignore = "duelo longo; correr explicitamente em --release"]
    fn duel_new_vs_legacy_50_games() {
        let games = 50usize;
        let mut points = 0.0f64;
        let mut max_overshoot: f64 = 0.0;
        for g in 0..games {
            let new_black = g % 2 == 0;
            let (p, ov) = play_duel_game(new_black, 0xC0FFEE ^ (g as u32 * 2654435761));
            points += p;
            max_overshoot = max_overshoot.max(ov);
            println!(
                "jogo {:2}: novo com {} -> {:.1} pts (acum {:.1}), overshoot máx {:.0}ms",
                g + 1,
                if new_black { "pretas" } else { "brancas" },
                p,
                points,
                max_overshoot
            );
        }
        let winrate = points / games as f64;
        println!(
            "RESULTADO DUELO: {points:.1}/{games} pontos = {:.1}% | overshoot máximo {:.0}ms",
            winrate * 100.0,
            max_overshoot
        );
        assert!(
            winrate >= 0.65,
            "winrate do motor novo abaixo de 65%: {:.1}%",
            winrate * 100.0
        );
        assert!(
            max_overshoot <= 50.0,
            "jogada excedeu o budget em {max_overshoot:.0}ms (> 50ms)"
        );
    }

    #[test]
    #[ignore = "bench de nós; correr explicitamente em --release"]
    fn bench_nodes_per_second() {
        let (mut board, color) = random_position(4242, 16);
        let mut tt = vec![TT_EMPTY_ENTRY; TT_SIZE];
        for depth in 2..=6u8 {
            let mut ctx = SearchCtx {
                tt: &mut tt,
                age: depth,
                killers: [[0u32; 2]; MAX_PLY],
                history: [[0i32; NN]; 2],
                nodes: 0,
                deadline: now_ms() + 60_000.0,
                aborted: false,
            };
            let hash = full_hash(&board, color);
            let t0 = now_ms();
            let s = negamax_tt(&mut board, hash, color, depth, 0, -INF, INF, &mut ctx);
            let dt = now_ms() - t0;
            println!(
                "depth {depth}: score {s}, nodes {}, {:.0}ms, {:.0} knodes/s",
                ctx.nodes,
                dt,
                ctx.nodes as f64 / dt.max(0.001)
            );
        }
    }

    #[test]
    #[ignore = "medição de profundidade; correr explicitamente em --release"]
    fn effective_depth_at_2000ms() {
        // Abertura e meio-jogo: profundidade completada com budget de 2000ms.
        for (label, plies) in [("abertura", 2usize), ("meio-jogo", 16), ("tardio", 30)] {
            let (mut board, color) = random_position(4242, plies);
            let (_, depth) = search_best_id(&mut board, color, 4, 2000).expect("sem jogada");
            println!("profundidade completa a 2000ms ({label}, {plies} plies): {depth}");
            assert!(depth >= 4, "profundidade {depth} < 4 em {label}");
        }
    }
}
