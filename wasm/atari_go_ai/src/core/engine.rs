use super::board::Board;
use super::rng::SplitMix64;
use super::rules::{legal_moves, Color, State};
use super::search::{search_best_move, SearchConfig, SearchStats};
use super::tt::TranspositionTable;
use super::zobrist::Zobrist;

pub struct Engine {
    pub board: Board,
    pub zobrist: Zobrist,
    pub tt: TranspositionTable,
    pub state: State,
    pub last_stats: SearchStats,
    rng: SplitMix64,
}

impl Engine {
    pub fn new(seed: u64, tt_pow2: usize) -> Self {
        let board = Board::new();
        // Keep Zobrist stable across calls so TT keys stay consistent.
        let zobrist = Zobrist::new(&board, 0x5EED_D15C_A7A7_0001);
        let mut rng = SplitMix64::new(seed ^ 0xC001_D00D_1234_5678);
        let tt = TranspositionTable::new(tt_pow2);
        let state = State {
            black: 0,
            white: 0,
            to_play: Color::Black,
            hash: 0,
        };
        let last_stats = SearchStats::default();
        // stir rng
        let _ = rng.next_u64();
        Self {
            board,
            zobrist,
            tt,
            state,
            last_stats,
            rng,
        }
    }

    pub fn set_seed(&mut self, seed: u64) {
        self.rng = SplitMix64::new(seed ^ 0xC001_D00D_1234_5678);
    }

    pub fn set_position(&mut self, black: u128, white: u128, to_play: Color) {
        self.state.black = black;
        self.state.white = white;
        self.state.to_play = to_play;
        self.state.hash = self.compute_hash(black, white, to_play);
    }

    pub fn best_move(&mut self, time_ms: u32, level: u8, now_ms: impl Fn() -> f64) -> i32 {
        let (lm, has_capture) = legal_moves(
            self.state,
            &self.board,
            &self.zobrist.stone,
            self.zobrist.to_play,
        );
        if lm.is_empty() {
            self.last_stats = SearchStats::default();
            return -1;
        }
        if has_capture && lm.len() >= 1 {
            self.last_stats = SearchStats {
                nodes: 1,
                depth: 1,
                ..SearchStats::default()
            };
            return lm[0] as i32;
        }
        if lm.len() == 1 {
            self.last_stats = SearchStats {
                nodes: 1,
                depth: 1,
                ..SearchStats::default()
            };
            return lm[0] as i32;
        }

        let cfg = match level {
            1 => SearchConfig {
                max_depth: 2,
                use_tt: false,
                use_pvs: false,
                noise_top_k: 3,
                noise_delta: 120,
            },
            2 => SearchConfig {
                max_depth: 4,
                use_tt: true,
                use_pvs: false,
                noise_top_k: 2,
                noise_delta: 80,
            },
            3 => SearchConfig {
                max_depth: 8,
                use_tt: true,
                use_pvs: true,
                noise_top_k: 1,
                noise_delta: 0,
            },
            _ => SearchConfig {
                max_depth: 10,
                use_tt: true,
                use_pvs: true,
                noise_top_k: 1,
                noise_delta: 0,
            },
        };

        let start = now_ms();
        let (score, mv, mut stats) = search_best_move(
            self.state,
            time_ms,
            cfg,
            &self.board,
            &mut self.tt,
            &self.zobrist.stone,
            self.zobrist.to_play,
            || now_ms(),
            self.rng.next_u64(),
        );

        stats.elapsed_ms = (now_ms() - start) as u32;
        self.last_stats = stats;
        let _ = score;

        mv as i32
    }

    fn compute_hash(&self, black: u128, white: u128, to_play: Color) -> u64 {
        let mut h = 0u64;
        let mut tmp = black;
        while tmp != 0 {
            let lsb = tmp & tmp.wrapping_neg();
            tmp ^= lsb;
            let idx = lsb.trailing_zeros() as usize;
            h ^= self.zobrist.stone[Color::Black as usize][idx];
        }
        let mut tmp = white;
        while tmp != 0 {
            let lsb = tmp & tmp.wrapping_neg();
            tmp ^= lsb;
            let idx = lsb.trailing_zeros() as usize;
            h ^= self.zobrist.stone[Color::White as usize][idx];
        }
        if to_play == Color::White {
            h ^= self.zobrist.to_play;
        }
        h
    }

    pub fn rand_u32(&mut self) -> u32 {
        self.rng.next_u32()
    }
}
