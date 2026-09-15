use quelhas_ai::{engine::Searcher, eval, tt::TranspositionTable, zobrist::ZobristKeys};
use quelhas_core::{apply_move, extract_runs, Occupancy};

fn board(cells: impl Fn(usize, usize) -> bool) -> Occupancy {
    let mut occ = Occupancy::default();
    for r in 0..10 {
        for c in 0..10 {
            if !cells(r, c) {
                occ.set(r * 10 + c);
            }
        }
    }
    occ
}

// Independent rules oracle on a 3x3 corner: all straight segments, any length >=2.
fn oracle_moves(empty: u16, side: u8) -> Vec<u16> {
    let mut moves = Vec::new();
    for r in 0..3 {
        for c in 0..3 {
            let mut mask = 0;
            for offset in 0..3 {
                let (rr, cc) = if side == 0 {
                    (r + offset, c)
                } else {
                    (r, c + offset)
                };
                if rr >= 3 || cc >= 3 {
                    break;
                }
                let cell = 1 << (rr * 3 + cc);
                if empty & cell == 0 {
                    break;
                }
                mask |= cell;
                if offset >= 1 {
                    moves.push(mask);
                }
            }
        }
    }
    moves
}

fn win(empty: u16, side: u8, memo: &mut [Option<bool>; 1024]) -> bool {
    let key = empty as usize * 2 + side as usize;
    if let Some(result) = memo[key] {
        return result;
    }
    let moves = oracle_moves(empty, side);
    let result = moves.is_empty() || moves.iter().any(|m| !win(empty & !m, 1 - side, memo));
    memo[key] = Some(result);
    result
}

#[test]
fn shallow_search_exhausts_the_long_strip() {
    let occ = board(|r, c| c == 0 || (r == 4 && c >= 2));
    let counts = eval::analyze_turn_counts(occ);
    assert_eq!((counts[0].min, counts[0].max), (1, 5));
    assert_eq!((counts[1].min, counts[1].max), (1, 4));
    let mut tt = TranspositionTable::new(4096);
    let zobrist = ZobristKeys::new();
    let mut search = Searcher::new(&mut tt, &zobrist, 1, 100.0, 1);
    let result = search.iterative_deepening(occ, 0, 0, 0, || 0.0);
    let next = apply_move(occ, result.best_move.expect("legal move"));
    assert!(extract_runs(next, 0).is_empty());
    assert!(!extract_runs(next, 1).is_empty());
}

#[test]
fn tempo_proofs_and_search_agree_with_every_3x3_endgame() {
    let mut memo = [None; 1024];
    let mut tt = TranspositionTable::new(4096);
    let zobrist = ZobristKeys::new();
    for empty in 0..512u16 {
        let occ = board(|r, c| r < 3 && c < 3 && empty & (1 << (r * 3 + c)) != 0);
        let counts = eval::analyze_turn_counts(occ);
        for side in 0..=1 {
            let expected = win(empty, side, &mut memo);
            if let Some(proven) =
                eval::tempo_outcome(counts[side as usize], counts[1 - side as usize])
            {
                assert_eq!(
                    proven, expected,
                    "unsound tempo proof: {empty:09b} side {side}"
                );
            }
            if oracle_moves(empty, side).is_empty() {
                continue;
            }
            tt.clear();
            let mut search = Searcher::new(&mut tt, &zobrist, 1, 100.0, 10);
            let result = search.iterative_deepening(occ, side, 0, 0, || 0.0);
            let next = apply_move(occ, result.best_move.expect("legal move"));
            let mut remaining = 0;
            for r in 0..3 {
                for c in 0..3 {
                    if !next.is_set(r * 10 + c) {
                        remaining |= 1 << (r * 3 + c);
                    }
                }
            }
            if expected {
                assert!(
                    !win(remaining, 1 - side, &mut memo),
                    "winning position lost: {empty:09b} side {side}"
                );
            }
        }
    }
}

#[test]
fn expired_budget_still_returns_a_legal_action() {
    let mut tt = TranspositionTable::new(4096);
    let zobrist = ZobristKeys::new();
    let mut search = Searcher::new(&mut tt, &zobrist, 1, 0.0, 18);
    assert!(search
        .iterative_deepening(Occupancy::default(), 0, 0, 0, || 1.0)
        .best_move
        .is_some());
}
