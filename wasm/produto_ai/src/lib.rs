mod core;

use core::ai::{choose_move as choose_move_core, AiConfig};
use core::board::{Board, CELLS, FULL_MASK};
use core::movegen::{Move as CoreMove, StateView, Stone};

use std::cell::RefCell;
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Date)]
    fn now() -> f64;
}

#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

static BOARD: OnceLock<Board> = OnceLock::new();

fn board() -> &'static Board {
    BOARD.get_or_init(Board::new)
}

thread_local! {
    static LAST_EXPLAIN: RefCell<String> = const { RefCell::new(String::new()) };
    static GLOBAL_SEED: RefCell<u64> = const { RefCell::new(0x1234_5678_9abc_def0) };
}

#[wasm_bindgen]
pub fn init_ai(seed: u32) {
    GLOBAL_SEED.with(|s| *s.borrow_mut() = seed as u64);
}

fn get_u32(obj: &JsValue, key: &str) -> Result<u32, JsValue> {
    let v = js_sys::Reflect::get(obj, &JsValue::from_str(key))?;
    v.as_f64()
        .map(|n| n as u32)
        .ok_or_else(|| JsValue::from_str(&format!("missing/invalid number field: {key}")))
}

fn get_u16(obj: &JsValue, key: &str) -> Result<u16, JsValue> {
    Ok(get_u32(obj, key)? as u16)
}

fn get_u8(obj: &JsValue, key: &str) -> Result<u8, JsValue> {
    Ok(get_u32(obj, key)? as u8)
}

fn get_bool(obj: &JsValue, key: &str) -> Result<bool, JsValue> {
    let v = js_sys::Reflect::get(obj, &JsValue::from_str(key))?;
    v.as_bool()
        .ok_or_else(|| JsValue::from_str(&format!("missing/invalid bool field: {key}")))
}

#[wasm_bindgen]
pub fn choose_move(state: JsValue, cfg: JsValue) -> Result<JsValue, JsValue> {
    let black_lo = get_u32(&state, "blackLo")?;
    let black_hi = get_u32(&state, "blackHi")?;
    let white_lo = get_u32(&state, "whiteLo")?;
    let white_hi = get_u32(&state, "whiteHi")?;
    let player = get_u8(&state, "playerToMove")?;
    let first_move = get_bool(&state, "primeiraJogada")?;

    let black = ((black_hi as u64) << 32) | black_lo as u64;
    let white = ((white_hi as u64) << 32) | white_lo as u64;

    if (black & white) != 0 || ((black | white) & !FULL_MASK) != 0 {
        return Err(JsValue::from_str("invalid masks (overlap/out of range)"));
    }

    let difficulty = get_u8(&cfg, "difficulty")?;
    let time_ms = get_u32(&cfg, "timeMs")?;
    let candidate_k = get_u16(&cfg, "candidateK")?;
    let endgame_empty_n = get_u8(&cfg, "endgameEmptyN")?;
    let seed = js_sys::Reflect::get(&cfg, &JsValue::from_str("seed"))?
        .as_f64()
        .map(|n| n as u64)
        .unwrap_or_else(|| GLOBAL_SEED.with(|s| *s.borrow()));

    let player_to_move = if player == 0 { Stone::Black } else { Stone::White };

    let st = StateView {
        black,
        white,
        player_to_move,
        first_move,
    };

    let cfg = AiConfig {
        difficulty,
        time_ms,
        candidate_k,
        endgame_empty_n,
        seed,
    };

    let before_empty = (FULL_MASK & !(black | white)).count_ones() as usize;
    let mv: CoreMove = choose_move_core(st, cfg, board(), now);

    LAST_EXPLAIN.with(|e| {
        *e.borrow_mut() = format!(
            "cells={CELLS} empty_before={before_empty} diff={difficulty} time_ms={time_ms} cand={candidate_k} endgame_n={endgame_empty_n}"
        );
    });

    let out = js_sys::Object::new();
    js_sys::Reflect::set(&out, &JsValue::from_str("posA"), &JsValue::from_f64(mv.pos_a as f64))?;
    js_sys::Reflect::set(&out, &JsValue::from_str("colorA"), &JsValue::from_f64(mv.color_a as u8 as f64))?;
    js_sys::Reflect::set(&out, &JsValue::from_str("posB"), &JsValue::from_f64(mv.pos_b as f64))?;
    js_sys::Reflect::set(&out, &JsValue::from_str("colorB"), &JsValue::from_f64(mv.color_b as u8 as f64))?;
    Ok(out.into())
}

#[wasm_bindgen]
pub fn explain_last() -> String {
    LAST_EXPLAIN.with(|e| e.borrow().clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::board::FULL_MASK;
    use crate::core::movegen::Stone;
    use crate::core::scoring::score_for;

    #[test]
    fn board_has_61_cells_and_symmetric_neighbours() {
        let b = Board::new();
        assert_eq!(b.positions.len(), 61);
        for i in 0..61 {
            let neigh = b.neighbours[i];
            let mut tmp = neigh;
            while tmp != 0 {
                let j = tmp.trailing_zeros() as usize;
                tmp &= !(1u64 << j);
                assert!((b.neighbours[j] & (1u64 << i)) != 0);
            }
        }
    }

    #[test]
    fn score_product_is_zero_with_less_than_two_groups() {
        let b = Board::new();
        let one_group = (1u64 << 0) | (1u64 << 1);
        let s = score_for(one_group, &b);
        assert_eq!(s.product, 0);
    }

    #[test]
    fn masks_cover_61_bits_only() {
        assert_eq!(FULL_MASK.count_ones(), 61);
    }

    #[test]
    fn apply_move_opening_places_one_stone() {
        let b = board();
        let st = StateView {
            black: 0,
            white: 0,
            player_to_move: Stone::Black,
            first_move: true,
        };
        let cfg = AiConfig {
            difficulty: 0,
            time_ms: 10,
            candidate_k: 20,
            endgame_empty_n: 0,
            seed: 1,
        };
        let mv = choose_move_core(st, cfg, b, || 0.0);
        assert!(mv.pos_b < 0);
    }
}
