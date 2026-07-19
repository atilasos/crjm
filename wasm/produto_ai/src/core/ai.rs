//! Motor de pesquisa do Produto.
//!
//! Arquitetura (redesenho 2026-07): negamax alpha-beta com iterative deepening,
//! tabela de transposições, ordenação de jogadas por avaliação estática e
//! avaliação incremental de grupos (union-find, ver `GroupsInc`). Substitui o
//! antigo bandit UCT plano sem árvore. O endgame exato (empty <= endgameEmptyN)
//! mantém-se, agora com proteção de deadline.

use super::board::{bit, Board};
use super::groups::GroupsInc;
use super::movegen::{apply_move, empty_mask, generate_candidate_moves, Move, StateView, Stone};
use super::scoring::{winner, Winner};

use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};

#[derive(Clone, Copy, Debug)]
pub struct AiConfig {
    pub difficulty: u8,
    pub time_ms: u32,
    pub candidate_k: u16,
    pub endgame_empty_n: u8,
    pub seed: u64,
}

/// Estatísticas da última pesquisa (instrumentação para explain_last e arenas).
#[derive(Clone, Copy, Debug, Default)]
pub struct SearchStats {
    /// Nós internos visitados (alpha-beta) ou iterações UCT (bandit).
    pub nodes: u64,
    /// Folhas avaliadas / rollouts completos.
    pub rollouts: u64,
    /// Visitas (nós gastos) no melhor braço/jogada de raiz.
    pub best_visits: u64,
    /// Profundidade completa atingida (0 = sem pesquisa em profundidade).
    pub depth: u8,
    /// Score interno da melhor jogada (escala da heurística).
    pub best_score: i32,
    /// Jogadas candidatas na raiz.
    pub root_moves: u32,
    /// Tempo consumido em ms (relógio now_ms).
    pub elapsed_ms: f64,
    /// Modo de pesquisa usado.
    pub mode: &'static str,
}

impl SearchStats {
    pub fn sims_per_sec(&self) -> f64 {
        if self.elapsed_ms <= 0.0 {
            return 0.0;
        }
        (self.rollouts as f64) * 1000.0 / self.elapsed_ms
    }
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

// ============================================================================
// Avaliação (perspetiva fixa: positivo favorece as Pretas)
// ============================================================================

const INF: i32 = i32::MAX / 4;
const WIN: i32 = 1_000_000;

#[inline]
fn signed(e_black: i32, side: Stone) -> i32 {
    match side {
        Stone::Black => e_black,
        Stone::White => -e_black,
    }
}

/// Valor terminal exato: vitória pelo maior produto; desempate por MENOS peças.
fn eval_terminal_black(gb: &GroupsInc, gw: &GroupsInc) -> i32 {
    let pb = gb.product() as i32;
    let pw = gw.product() as i32;
    if pb != pw {
        return if pb > pw { WIN + (pb - pw) } else { -(WIN + (pw - pb)) };
    }
    let cb = gb.count() as i32;
    let cw = gw.count() as i32;
    if cb != cw {
        if cb < cw {
            WIN
        } else {
            -WIN
        }
    } else {
        0
    }
}

/// Valor heurístico de uma cor (escala: produto x130).
fn side_value(g: &GroupsInc) -> i32 {
    let (t1, t2) = g.top2();
    let product = if t2 == 0 { 0 } else { t1 as i32 * t2 as i32 };
    let mut v = product * 130;

    // Estrutura: com <2 grupos o produto é 0 — penaliza ficar sem segundo grupo.
    if g.count() > 0 && g.groups < 2 {
        v -= 18_000;
    }

    // Equilíbrio: produto maximiza-se com grupos de tamanhos próximos.
    if t2 > 0 {
        let bal = (t2 as i32 * 100) / (t1 as i32).max(1);
        v += bal * 80;
    }

    // Eficiência/desempate: menos peças ganha em produto igual.
    v -= g.count() as i32 * 12;

    v
}

#[inline]
fn eval_black(gb: &GroupsInc, gw: &GroupsInc) -> i32 {
    side_value(gb) - side_value(gw)
}

// ============================================================================
// Tabela de transposições
// ============================================================================

#[derive(Clone, Copy)]
enum Bound {
    Exact,
    Lower,
    Upper,
}

#[derive(Clone, Copy)]
struct TtEntry {
    depth: u8,
    value: i32,
    bound: Bound,
}

/// Hasher trivial para chaves u128 (as máscaras já são quase uniformes com a
/// mistura multiplicativa; SipHash seria desperdício por nó).
#[derive(Default)]
struct FxU128Hasher(u64);

impl Hasher for FxU128Hasher {
    fn finish(&self) -> u64 {
        self.0
    }

    fn write(&mut self, bytes: &[u8]) {
        for &b in bytes {
            self.0 = (self.0 ^ b as u64).wrapping_mul(0x100000001b3);
        }
    }

    fn write_u128(&mut self, n: u128) {
        let lo = n as u64;
        let hi = (n >> 64) as u64;
        let mut h = lo.wrapping_mul(0x9e3779b97f4a7c15) ^ hi.wrapping_mul(0xbf58476d1ce4e5b9);
        h ^= h >> 29;
        h = h.wrapping_mul(0x94d049bb133111eb);
        self.0 = h ^ (h >> 32);
    }
}

type TtMap = HashMap<u128, TtEntry, BuildHasherDefault<FxU128Hasher>>;

#[inline]
fn tt_key(st: StateView) -> u128 {
    let side_bit = if st.player_to_move == Stone::White { 1u64 << 62 } else { 0 };
    (st.black | side_bit) as u128 | ((st.white as u128) << 64)
}

// ============================================================================
// Alpha-beta com deadline
// ============================================================================

struct Ctx<'a, F: Fn() -> f64> {
    board: &'a Board,
    now: &'a F,
    deadline: f64,
    nodes: u64,
    leaves: u64,
    stopped: bool,
    tt: TtMap,
}

impl<'a, F: Fn() -> f64> Ctx<'a, F> {
    #[inline]
    /// Verificação imediata do relógio (para loops de geração/avaliação
    /// que não passam por tick() com frequência suficiente).
    fn check_time(&mut self) {
        if !self.stopped && (self.now)() >= self.deadline {
            self.stopped = true;
        }
    }

    fn tick(&mut self) {
        self.nodes += 1;
        if self.nodes & 127 == 0 && (self.now)() >= self.deadline {
            self.stopped = true;
        }
    }
}

fn apply_groups(gb: &GroupsInc, gw: &GroupsInc, mv: Move, board: &Board) -> (GroupsInc, GroupsInc) {
    let mut nb = gb.clone();
    let mut nw = gw.clone();
    match mv.color_a {
        Stone::Black => nb.add(mv.pos_a as usize, board),
        Stone::White => nw.add(mv.pos_a as usize, board),
    }
    if mv.pos_b >= 0 {
        match mv.color_b {
            Stone::Black => nb.add(mv.pos_b as usize, board),
            Stone::White => nw.add(mv.pos_b as usize, board),
        }
    }
    (nb, nw)
}

/// Nº de casas candidatas em nós internos, em função da profundidade restante.
#[inline]
fn inner_cells(depth: u8) -> usize {
    match depth {
        0 | 1 => 8,
        2 => 10,
        _ => 12,
    }
}

fn negamax<F: Fn() -> f64>(
    st: StateView,
    gb: &GroupsInc,
    gw: &GroupsInc,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    ctx: &mut Ctx<'_, F>,
) -> i32 {
    ctx.tick();
    if ctx.stopped {
        return 0;
    }

    let empty = empty_mask(st);
    let empty_n = empty.count_ones();
    if empty_n == 0 || (empty_n < 2 && !st.first_move) {
        ctx.leaves += 1;
        return signed(eval_terminal_black(gb, gw), st.player_to_move);
    }
    if depth == 0 {
        ctx.leaves += 1;
        return signed(eval_black(gb, gw), st.player_to_move);
    }

    let key = tt_key(st);
    if let Some(e) = ctx.tt.get(&key) {
        if e.depth >= depth {
            match e.bound {
                Bound::Exact => return e.value,
                Bound::Lower => {
                    if e.value >= beta {
                        return e.value;
                    }
                    if e.value > alpha {
                        alpha = e.value;
                    }
                }
                Bound::Upper => {
                    if e.value <= alpha {
                        return e.value;
                    }
                }
            }
        }
    }

    let moves = generate_candidate_moves(st, ctx.board, inner_cells(depth));
    if moves.is_empty() {
        ctx.leaves += 1;
        return signed(eval_black(gb, gw), st.player_to_move);
    }

    let alpha0 = alpha;
    let mut best = -INF;

    if depth == 1 {
        // Nós pré-folha: itera preguiçosamente, sem vetor de filhos.
        for mv in &moves {
            if ctx.stopped {
                return best;
            }
            let Some(next) = apply_move(st, *mv) else { continue };
            let (nb, nw) = apply_groups(gb, gw, *mv, ctx.board);
            ctx.leaves += 1;
            let child_empty = empty_mask(next).count_ones();
            let e_black = if child_empty == 0 {
                eval_terminal_black(&nb, &nw)
            } else {
                eval_black(&nb, &nw)
            };
            let v = signed(e_black, st.player_to_move);
            if v > best {
                best = v;
            }
            if v > alpha {
                alpha = v;
            }
            if alpha >= beta {
                break;
            }
        }
    } else {
        // Nós interiores: expande filhos com grupos incrementais e ordena por
        // avaliação estática (melhora drasticamente os cortes alpha-beta).
        let mut children: Vec<(i32, StateView, GroupsInc, GroupsInc)> =
            Vec::with_capacity(moves.len());
        for (i, mv) in moves.iter().enumerate() {
            if i & 31 == 0 {
                ctx.check_time();
                if ctx.stopped {
                    return best;
                }
            }
            let Some(next) = apply_move(st, *mv) else { continue };
            let (nb, nw) = apply_groups(gb, gw, *mv, ctx.board);
            let order = signed(eval_black(&nb, &nw), st.player_to_move);
            children.push((order, next, nb, nw));
        }
        children.sort_unstable_by(|a, b| b.0.cmp(&a.0));

        for (_, next, nb, nw) in &children {
            if ctx.stopped {
                return best;
            }
            let v = -negamax(*next, nb, nw, depth - 1, -beta, -alpha, ctx);
            if ctx.stopped {
                return best;
            }
            if v > best {
                best = v;
            }
            if v > alpha {
                alpha = v;
            }
            if alpha >= beta {
                break;
            }
        }
    }

    if !ctx.stopped {
        let bound = if best <= alpha0 {
            Bound::Upper
        } else if best >= beta {
            Bound::Lower
        } else {
            Bound::Exact
        };
        ctx.tt.insert(key, TtEntry { depth, value: best, bound });
    }

    best
}

// ============================================================================
// Endgame exato (com proteção de deadline)
// ============================================================================

fn utility_exact(state: StateView, board: &Board) -> i8 {
    match winner(state.black, state.white, board) {
        Winner::Black => 1,
        Winner::White => -1,
        Winner::Draw => 0,
    }
}

struct ExactCtx<'a, F: Fn() -> f64> {
    board: &'a Board,
    now: &'a F,
    deadline: f64,
    nodes: u64,
    stopped: bool,
    memo: HashMap<u128, i8>,
}

fn exact_minimax<F: Fn() -> f64>(state: StateView, ctx: &mut ExactCtx<'_, F>) -> i8 {
    ctx.nodes += 1;
    if ctx.nodes & 63 == 0 && (ctx.now)() >= ctx.deadline {
        ctx.stopped = true;
    }
    if ctx.stopped {
        return 0;
    }

    let empty = empty_mask(state);
    let empty_n = empty.count_ones();
    if empty_n == 0 || (empty_n < 2 && !state.first_move) {
        return utility_exact(state, ctx.board);
    }

    let mut black_key = state.black;
    if state.player_to_move == Stone::White {
        black_key |= 1u64 << 63;
    }
    if state.first_move {
        black_key |= 1u64 << 62;
    }
    let key = (black_key as u128) | ((state.white as u128) << 64);
    if let Some(&v) = ctx.memo.get(&key) {
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

    'outer: {
        if state.first_move {
            for &pos in &empties {
                for &c in &colors {
                    let mv = Move { pos_a: pos, color_a: c, pos_b: -1, color_b: c };
                    if let Some(next) = apply_move(state, mv) {
                        let u = exact_minimax(next, ctx);
                        if ctx.stopped {
                            return 0;
                        }
                        if state.player_to_move == Stone::Black {
                            if u > best {
                                best = u;
                            }
                            if best == 1 {
                                break 'outer;
                            }
                        } else {
                            if u < best {
                                best = u;
                            }
                            if best == -1 {
                                break 'outer;
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
                            let mv = Move { pos_a: a, color_a: c1, pos_b: b as i8, color_b: c2 };
                            if let Some(next) = apply_move(state, mv) {
                                let u = exact_minimax(next, ctx);
                                if ctx.stopped {
                                    return 0;
                                }
                                if state.player_to_move == Stone::Black {
                                    if u > best {
                                        best = u;
                                    }
                                    if best == 1 {
                                        break 'outer;
                                    }
                                } else {
                                    if u < best {
                                        best = u;
                                    }
                                    if best == -1 {
                                        break 'outer;
                                    }
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

    ctx.memo.insert(key, best);
    best
}

// ============================================================================
// Jogada aleatória (nível 0 e último recurso)
// ============================================================================

/// Fallback total: nunca entra em pânico. Par de casas se possível; com uma
/// única casa vazia devolve colocação simples; sem casas vazias devolve uma
/// colocação estruturalmente válida na casa 0, que o cliente rejeita como
/// ilegal sem abortar (estado inalcançável em jogo normal).
fn safe_fallback_move(state: StateView, rng: &mut SplitMix64) -> Move {
    if let Some(mv) = choose_random_move(state, rng) {
        return mv;
    }
    let empty = empty_mask(state);
    for i in 0..61u8 {
        if empty & (1u64 << i) != 0 {
            return Move { pos_a: i, color_a: Stone::Black, pos_b: -1, color_b: Stone::Black };
        }
    }
    Move { pos_a: 0, color_a: Stone::Black, pos_b: -1, color_b: Stone::Black }
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
        return Some(Move { pos_a: pos, color_a: c, pos_b: -1, color_b: c });
    }

    if empties.len() < 2 {
        return None;
    }
    let i = rng.gen_range(empties.len());
    let mut j = rng.gen_range(empties.len() - 1);
    if j >= i {
        j += 1;
    }
    Some(Move {
        pos_a: empties[i],
        color_a: colors[rng.gen_range(2)],
        pos_b: empties[j] as i8,
        color_b: colors[rng.gen_range(2)],
    })
}

// ============================================================================
// Pesquisa de raiz (iterative deepening)
// ============================================================================

struct RootChild {
    mv: Move,
    st: StateView,
    gb: GroupsInc,
    gw: GroupsInc,
    score: i32,
    nodes: u64,
}

#[allow(clippy::too_many_arguments)]
fn search_root<F: Fn() -> f64>(
    state: StateView,
    board: &Board,
    root_cells: usize,
    max_depth_cap: u8,
    deadline: f64,
    now_ms: &F,
    stats: &mut SearchStats,
) -> Option<Move> {
    stats.mode = "alphabeta";

    let root_moves = generate_candidate_moves(state, board, root_cells);
    if root_moves.is_empty() {
        return None;
    }

    let gb0 = GroupsInc::from_mask(state.black, board);
    let gw0 = GroupsInc::from_mask(state.white, board);

    let mut ctx = Ctx {
        board,
        now: now_ms,
        deadline,
        nodes: 0,
        leaves: 0,
        stopped: false,
        tt: TtMap::default(),
    };

    // Profundidade 1: avalia todos os filhos da raiz e ordena.
    let mut children: Vec<RootChild> = Vec::with_capacity(root_moves.len());
    for (i, mv) in root_moves.iter().enumerate() {
        if i & 31 == 0 {
            ctx.check_time();
            if ctx.stopped {
                break;
            }
        }
        let Some(next) = apply_move(state, *mv) else { continue };
        let (nb, nw) = apply_groups(&gb0, &gw0, *mv, board);
        ctx.leaves += 1;
        let child_empty = empty_mask(next).count_ones();
        let e_black = if child_empty == 0 {
            eval_terminal_black(&nb, &nw)
        } else {
            eval_black(&nb, &nw)
        };
        children.push(RootChild {
            mv: *mv,
            st: next,
            gb: nb,
            gw: nw,
            score: signed(e_black, state.player_to_move),
            nodes: 1,
        });
    }
    if children.is_empty() {
        return None;
    }
    children.sort_by(|a, b| b.score.cmp(&a.score));

    stats.root_moves = children.len() as u32;
    stats.depth = 1;
    stats.best_score = children[0].score;

    let empty_n = empty_mask(state).count_ones();
    let max_depth = ((empty_n / 2) + 1).min(max_depth_cap as u32) as u8;

    let mut best_idx = 0usize;

    for depth in 2..=max_depth {
        let mut alpha = -INF;
        let mut iter_best = -INF;
        let mut iter_best_i: Option<usize> = None;
        let mut completed = 0usize;

        for (i, ch) in children.iter_mut().enumerate() {
            if (now_ms)() >= ctx.deadline {
                ctx.stopped = true;
            }
            if ctx.stopped {
                break;
            }
            let n0 = ctx.nodes;
            let v = -negamax(ch.st, &ch.gb, &ch.gw, depth - 1, -INF, -alpha, &mut ctx);
            ch.nodes += ctx.nodes - n0;
            if ctx.stopped {
                break;
            }
            completed += 1;
            ch.score = v;
            if v > iter_best {
                iter_best = v;
                iter_best_i = Some(i);
            }
            if v > alpha {
                alpha = v;
            }
        }

        if completed == children.len() {
            // Iteração completa: reordena tudo pelos scores novos.
            children.sort_by(|a, b| b.score.cmp(&a.score));
            best_idx = 0;
            stats.depth = depth;
            stats.best_score = children[0].score;
            if children[0].score >= WIN {
                break; // vitória provada
            }
        } else {
            // Iteração parcial: só aceita jogadas pesquisadas a esta profundidade.
            if let Some(i) = iter_best_i {
                best_idx = i;
                stats.best_score = iter_best;
            }
            break;
        }

        if ctx.stopped {
            break;
        }
    }

    stats.nodes = ctx.nodes;
    stats.rollouts = ctx.leaves;
    stats.best_visits = children[best_idx].nodes;
    Some(children[best_idx].mv)
}

// ============================================================================
// Entrada principal
// ============================================================================

pub fn choose_move(state: StateView, cfg: AiConfig, board: &Board, now_ms: impl Fn() -> f64) -> Move {
    choose_move_with_stats(state, cfg, board, now_ms).0
}

pub fn choose_move_with_stats(
    state: StateView,
    cfg: AiConfig,
    board: &Board,
    now_ms: impl Fn() -> f64,
) -> (Move, SearchStats) {
    let started = now_ms();
    let mut stats = SearchStats::default();
    let mv = choose_move_inner(state, cfg, board, &now_ms, &mut stats);
    stats.elapsed_ms = now_ms() - started;
    (mv, stats)
}

fn greedy_move(
    state: StateView,
    board: &Board,
    candidate_cells: usize,
    stats: &mut SearchStats,
) -> Option<Move> {
    let moves = generate_candidate_moves(state, board, candidate_cells);
    if moves.is_empty() {
        return None;
    }
    let gb0 = GroupsInc::from_mask(state.black, board);
    let gw0 = GroupsInc::from_mask(state.white, board);
    let mut best_mv = None;
    let mut best_score = -INF;
    for mv in moves {
        let Some(next) = apply_move(state, mv) else { continue };
        let (nb, nw) = apply_groups(&gb0, &gw0, mv, board);
        stats.rollouts += 1;
        let e_black = if empty_mask(next) == 0 {
            eval_terminal_black(&nb, &nw)
        } else {
            eval_black(&nb, &nw)
        };
        let s = signed(e_black, state.player_to_move);
        if s > best_score {
            best_score = s;
            best_mv = Some(mv);
        }
    }
    stats.best_score = best_score;
    best_mv
}

fn choose_move_inner(
    state: StateView,
    cfg: AiConfig,
    board: &Board,
    now_ms: &impl Fn() -> f64,
    stats: &mut SearchStats,
) -> Move {
    let mut rng = SplitMix64::new(cfg.seed);

    let empty = empty_mask(state);
    let empty_count = empty.count_ones() as u8;

    if empty_count == 0 {
        // Sem casas: sentinela estrutural (o cliente rejeita como ilegal).
        return Move { pos_a: 0, color_a: Stone::Black, pos_b: -1, color_b: Stone::Black };
    }

    let deadline = now_ms() + cfg.time_ms as f64;

    // Endgame exato (mantido), agora com deadline e fallback.
    if empty_count <= cfg.endgame_empty_n && cfg.difficulty >= 1 {
        stats.mode = "exact";
        let moves = generate_candidate_moves(state, board, (empty_count as usize).max(6));
        stats.root_moves = moves.len() as u32;
        if moves.is_empty() {
            return safe_fallback_move(state, &mut rng);
        }

        let mut ctx = ExactCtx {
            board,
            now: now_ms,
            deadline,
            nodes: 0,
            stopped: false,
            memo: HashMap::new(),
        };

        let root_player = state.player_to_move;
        let mut best_mv: Option<Move> = None;
        let mut best = if root_player == Stone::Black { -2i8 } else { 2i8 };
        for mv in &moves {
            if ctx.stopped {
                break;
            }
            if let Some(next) = apply_move(state, *mv) {
                let u = exact_minimax(next, &mut ctx);
                if ctx.stopped {
                    break;
                }
                if root_player == Stone::Black {
                    if u > best || best_mv.is_none() {
                        best = u;
                        best_mv = Some(*mv);
                    }
                } else if u < best || best_mv.is_none() {
                    best = u;
                    best_mv = Some(*mv);
                }
            }
        }
        stats.nodes = ctx.nodes;
        stats.rollouts = ctx.nodes;
        stats.best_score = best as i32 * WIN;
        stats.depth = empty_count / 2;

        if let Some(mv) = best_mv {
            if !ctx.stopped || best == if root_player == Stone::Black { 1 } else { -1 } {
                return mv;
            }
        }
        // Deadline rebentou sem resolver: cai para a pesquisa heurística abaixo.
    }

    match cfg.difficulty {
        0 => {
            stats.mode = "random";
            safe_fallback_move(state, &mut rng)
        }
        1 => {
            stats.mode = "greedy";
            greedy_move(state, board, (cfg.candidate_k as usize).min(12), stats)
                .unwrap_or_else(|| safe_fallback_move(state, &mut rng))
        }
        d => {
            // Níveis 2+: alpha-beta com iterative deepening.
            // A largura de raiz e o teto de profundidade escalam com o nível.
            let (root_cells, depth_cap) = match d {
                2 => (10usize, 2u8),
                3 => (12usize, 3u8),
                _ => ((cfg.candidate_k as usize).clamp(6, 16), 32u8),
            };
            search_root(state, board, root_cells, depth_cap, deadline, now_ms, stats)
                .unwrap_or_else(|| safe_fallback_move(state, &mut rng))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::board::FULL_MASK;

    fn board() -> Board {
        Board::new()
    }

    fn cfg(difficulty: u8, time_ms: u32) -> AiConfig {
        AiConfig {
            difficulty,
            time_ms,
            candidate_k: 28,
            endgame_empty_n: 8,
            seed: 99,
        }
    }

    fn is_legal(state: StateView, mv: Move) -> bool {
        let empty = empty_mask(state);
        let a = mv.pos_a as usize;
        if a >= 61 || (empty & bit(a)) == 0 {
            return false;
        }
        if state.first_move {
            return mv.pos_b < 0;
        }
        if mv.pos_b < 0 {
            return false;
        }
        let b = mv.pos_b as usize;
        b < 61 && b != a && (empty & bit(b)) != 0
    }

    /// Estados degenerados aceites pela API não podem abortar o motor.
    #[test]
    fn estados_degenerados_nao_entram_em_panico() {
        let b = board();
        let start = std::time::Instant::now();
        let now = move || start.elapsed().as_secs_f64() * 1000.0;

        // Tabuleiro cheio: sentinela estrutural, sem panic.
        let cheio = StateView {
            black: FULL_MASK,
            white: 0,
            player_to_move: Stone::Black,
            first_move: false,
        };
        let mv = choose_move(cheio, cfg(4, 100), &b, now);
        assert!(mv.pos_b < 0);

        // Uma única casa vazia fora do primeiro lance: colocação simples,
        // estruturalmente válida, sem panic.
        let start2 = std::time::Instant::now();
        let now2 = move || start2.elapsed().as_secs_f64() * 1000.0;
        let quase_cheio = StateView {
            black: FULL_MASK & !bit(30),
            white: 0,
            player_to_move: Stone::White,
            first_move: false,
        };
        let mv = choose_move(quase_cheio, cfg(4, 100), &b, now2);
        assert_eq!(mv.pos_a, 30);
        assert!(mv.pos_b < 0);
    }

    /// Joga um jogo completo motor-contra-motor e valida legalidade de todas
    /// as jogadas até ao tabuleiro cheio.
    #[test]
    fn full_game_all_moves_legal() {
        let b = board();
        for seed in [1u64, 7, 42] {
            let mut st = StateView {
                black: 0,
                white: 0,
                player_to_move: Stone::Black,
                first_move: true,
            };
            let mut turn = 0u32;
            while empty_mask(st) != 0 {
                let start = std::time::Instant::now();
                let now = move || start.elapsed().as_secs_f64() * 1000.0;
                let c = AiConfig { seed: seed + turn as u64, ..cfg(4, 30) };
                let mv = choose_move(st, c, &b, now);
                assert!(is_legal(st, mv), "jogada ilegal no turno {turn}: {mv:?}");
                st = apply_move(st, mv).expect("apply_move falhou em jogada legal");
                turn += 1;
                assert!(turn <= 32, "jogo não terminou em 32 turnos");
            }
        }
    }

    /// Todas as dificuldades devolvem jogadas legais em posições aleatórias.
    #[test]
    fn all_difficulties_return_legal_moves() {
        let b = board();
        let mut rng = SplitMix64::new(0xabcdef);
        for _ in 0..20 {
            // Gera posição aleatória com nº par de pedras (estado pós-abertura).
            let mut st = StateView {
                black: 1u64 << (rng.gen_range(61)),
                white: 0,
                player_to_move: Stone::White,
                first_move: false,
            };
            let n_moves = rng.gen_range(12);
            for _ in 0..n_moves {
                if let Some(mv) = choose_random_move(st, &mut rng) {
                    st = apply_move(st, mv).unwrap();
                }
            }
            for diff in 0..=4u8 {
                let start = std::time::Instant::now();
                let now = move || start.elapsed().as_secs_f64() * 1000.0;
                let mv = choose_move(st, cfg(diff, 20), &b, now);
                assert!(is_legal(st, mv), "diff={diff} jogada ilegal: {mv:?}");
            }
        }
    }

    /// A pesquisa respeita o deadline: nunca excede timeMs + 100.
    #[test]
    fn search_respects_deadline() {
        let b = board();
        let mut rng = SplitMix64::new(1234);
        let mut st = StateView {
            black: 1u64 << 30,
            white: 0,
            player_to_move: Stone::White,
            first_move: false,
        };
        for _ in 0..4 {
            if let Some(mv) = choose_random_move(st, &mut rng) {
                st = apply_move(st, mv).unwrap();
            }
        }
        for time_ms in [50u32, 150, 300] {
            let start = std::time::Instant::now();
            let now = move || start.elapsed().as_secs_f64() * 1000.0;
            let (_, stats) = choose_move_with_stats(st, cfg(4, time_ms), &b, now);
            let elapsed = start.elapsed().as_millis() as u32;
            assert!(
                elapsed <= time_ms + 100,
                "excedeu deadline: {elapsed}ms > {}ms (stats: {stats:?})",
                time_ms + 100
            );
        }
    }

    /// O endgame exato devolve jogada legal e não excede o deadline.
    #[test]
    fn endgame_exact_is_legal_and_bounded() {
        let b = board();
        let mut rng = SplitMix64::new(777);
        // Constrói posição com exatamente 8 casas vazias.
        let mut st = StateView {
            black: 1u64 << 5,
            white: 0,
            player_to_move: Stone::White,
            first_move: false,
        };
        while empty_mask(st).count_ones() > 8 {
            let mv = choose_random_move(st, &mut rng).unwrap();
            st = apply_move(st, mv).unwrap();
        }
        let start = std::time::Instant::now();
        let now = move || start.elapsed().as_secs_f64() * 1000.0;
        let (mv, stats) = choose_move_with_stats(st, cfg(4, 2000), &b, now);
        assert_eq!(stats.mode, "exact");
        assert!(is_legal(st, mv), "endgame devolveu jogada ilegal: {mv:?}");
        assert!(start.elapsed().as_millis() < 2100);
    }

    /// Avaliação: simetria preto/branco.
    #[test]
    fn eval_is_antisymmetric() {
        let b = board();
        let mut rng = SplitMix64::new(9);
        for _ in 0..100 {
            let m1 = rng.next_u64() & FULL_MASK;
            let m2 = rng.next_u64() & FULL_MASK & !m1;
            let g1 = GroupsInc::from_mask(m1, &b);
            let g2 = GroupsInc::from_mask(m2, &b);
            assert_eq!(eval_black(&g1, &g2), -eval_black(&g2, &g1));
            assert_eq!(eval_terminal_black(&g1, &g2), -eval_terminal_black(&g2, &g1));
        }
    }
}
