mod core;

use core::engine::Engine;
use core::rules::{apply_move as apply_move_core, legal_moves as legal_moves_core, Color};

use std::cell::RefCell;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Date)]
    fn now() -> f64;
}

#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

thread_local! {
    static ENGINE: RefCell<Engine> = RefCell::new(Engine::new(0x1234_5678_9abc_def0, 18)); // 256K
}

#[wasm_bindgen]
pub fn init(seed: u32) {
    ENGINE.with(|e| e.borrow_mut().set_seed(seed as u64));
}

#[wasm_bindgen]
pub fn set_position(board: js_sys::Uint8Array, to_play: u8) -> Result<(), JsValue> {
    if board.length() != 81 {
        return Err(JsValue::from_str("board must be Uint8Array(81)"));
    }
    let v = board.to_vec();
    let mut black = 0u128;
    let mut white = 0u128;
    for (i, &b) in v.iter().enumerate() {
        match b {
            0 => {}
            1 => black |= 1u128 << i,
            2 => white |= 1u128 << i,
            _ => return Err(JsValue::from_str("invalid cell value (expected 0/1/2)")),
        }
    }
    if (black & white) != 0 {
        return Err(JsValue::from_str("invalid board: overlap"));
    }
    let side = if to_play == 1 { Color::White } else { Color::Black };
    ENGINE.with(|e| e.borrow_mut().set_position(black, white, side));
    Ok(())
}

#[wasm_bindgen]
pub fn best_move(time_ms: u32, level: u8) -> i32 {
    ENGINE.with(|e| e.borrow_mut().best_move(time_ms, level, now))
}

#[wasm_bindgen]
pub fn apply_move(idx: i32) -> Result<JsValue, JsValue> {
    if idx < 0 || idx > 80 {
        return Err(JsValue::from_str("idx out of range"));
    }
    ENGINE.with(|e| {
        let mut eng = e.borrow_mut();
        let (nst, res) = apply_move_core(
            eng.state,
            idx as u8,
            &eng.board,
            &eng.zobrist.stone,
            eng.zobrist.to_play,
        );
        if !res.legal {
            let out = js_sys::Object::new();
            js_sys::Reflect::set(&out, &JsValue::from_str("ok"), &JsValue::FALSE)?;
            return Ok(out.into());
        }
        eng.state = nst;
        let out = js_sys::Object::new();
        js_sys::Reflect::set(&out, &JsValue::from_str("ok"), &JsValue::TRUE)?;
        js_sys::Reflect::set(
            &out,
            &JsValue::from_str("captured"),
            &JsValue::from_f64(res.captured as f64),
        )?;
        let winner = match res.winner {
            None => 0,
            Some(Color::Black) => 1,
            Some(Color::White) => 2,
        };
        js_sys::Reflect::set(&out, &JsValue::from_str("winner"), &JsValue::from_f64(winner as f64))?;
        Ok(out.into())
    })
}

#[wasm_bindgen]
pub fn legal_moves() -> JsValue {
    ENGINE.with(|e| {
        let eng = e.borrow();
        let (moves, _has_capture) = legal_moves_core(
            eng.state,
            &eng.board,
            &eng.zobrist.stone,
            eng.zobrist.to_play,
        );
        let arr = js_sys::Array::new();
        for m in moves {
            arr.push(&JsValue::from_f64(m as f64));
        }
        arr.into()
    })
}

#[wasm_bindgen]
pub fn stats() -> JsValue {
    ENGINE.with(|e| {
        let eng = e.borrow();
        let s = eng.last_stats;
        let out = js_sys::Object::new();
        let _ = js_sys::Reflect::set(&out, &JsValue::from_str("nodes"), &JsValue::from_f64(s.nodes as f64));
        let _ = js_sys::Reflect::set(&out, &JsValue::from_str("depth"), &JsValue::from_f64(s.depth as f64));
        let _ = js_sys::Reflect::set(&out, &JsValue::from_str("ttHits"), &JsValue::from_f64(s.tt_hits as f64));
        let _ = js_sys::Reflect::set(&out, &JsValue::from_str("ttProbes"), &JsValue::from_f64(s.tt_probes as f64));
        let _ = js_sys::Reflect::set(&out, &JsValue::from_str("cutoffs"), &JsValue::from_f64(s.cutoffs as f64));
        let _ = js_sys::Reflect::set(&out, &JsValue::from_str("elapsedMs"), &JsValue::from_f64(s.elapsed_ms as f64));
        out.into()
    })
}

#[cfg(test)]
mod tests {
    use crate::core::board::{Board, SIZE};
    use crate::core::rules::{apply_move as apply_move_rules, legal_moves, Color, State};
    use crate::core::zobrist::Zobrist;

    #[test]
    fn board_has_81_cells_and_symmetric_neighbours() {
        let b = Board::new();
        assert_eq!(SIZE * SIZE, 81);
        for i in 0..81 {
            let neigh = b.neigh[i];
            let mut tmp = neigh;
            while tmp != 0 {
                let lsb = tmp & tmp.wrapping_neg();
                tmp ^= lsb;
                let j = lsb.trailing_zeros() as usize;
                assert!((b.neigh[j] & (1u128 << i)) != 0);
            }
        }
    }

    #[test]
    fn suicide_is_illegal_unless_capture() {
        let b = Board::new();
        let z = Zobrist::new(&b, 1);
        // Position: white stones at (0,1) and (1,0), black to play; (0,0) is suicide for black.
        let white = (1u128 << 1) | (1u128 << 9);
        let st = State {
            black: 0,
            white,
            to_play: Color::Black,
            hash: 0,
        };
        let (_nst, res) = apply_move_rules(st, 0, &b, &z.stone, z.to_play);
        assert!(!res.legal);
    }

    #[test]
    fn capture_is_immediate_win() {
        let b = Board::new();
        let z = Zobrist::new(&b, 1);
        // White stone at (0,0), black stone at (1,0), black plays (0,1) to capture.
        let white = 1u128 << 0;
        let black = 1u128 << 9;
        let st = State {
            black,
            white,
            to_play: Color::Black,
            hash: 0,
        };
        let (_nst, res) = apply_move_rules(st, 1, &b, &z.stone, z.to_play);
        assert!(res.legal);
        assert_eq!(res.captured, 1);
        assert_eq!(res.winner, Some(Color::Black));
    }

    #[test]
    fn legal_moves_short_circuits_on_capture() {
        let b = Board::new();
        let z = Zobrist::new(&b, 1);
        let white = 1u128 << 0;
        let black = 1u128 << 9;
        let st = State {
            black,
            white,
            to_play: Color::Black,
            hash: 0,
        };
        let (mv, has_capture) = legal_moves(st, &b, &z.stone, z.to_play);
        assert!(has_capture);
        assert_eq!(mv, vec![1]);
    }
}
