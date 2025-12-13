use super::board::Board;
use super::groups::group_sizes;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Winner {
    Black,
    White,
    Draw,
}

#[derive(Clone, Copy, Debug)]
pub struct Score {
    pub top1: u8,
    pub top2: u8,
    pub product: u32,
    pub count: u8,
}

fn top2_from_sizes(mut sizes: Vec<u8>) -> (u8, u8) {
    if sizes.len() < 2 {
        let top1 = sizes.pop().unwrap_or(0);
        return (top1, 0);
    }
    sizes.sort_unstable_by(|a, b| b.cmp(a));
    (sizes[0], sizes[1])
}

pub fn score_for(mask: u64, board: &Board) -> Score {
    let sizes = group_sizes(mask, board);
    let (top1, top2) = top2_from_sizes(sizes);
    let product = if top2 == 0 { 0 } else { top1 as u32 * top2 as u32 };
    let count = mask.count_ones() as u8;
    Score {
        top1,
        top2,
        product,
        count,
    }
}

pub fn winner(black_mask: u64, white_mask: u64, board: &Board) -> Winner {
    let sb = score_for(black_mask, board);
    let sw = score_for(white_mask, board);

    if sb.product > sw.product {
        Winner::Black
    } else if sw.product > sb.product {
        Winner::White
    } else if sb.count < sw.count {
        Winner::Black
    } else if sw.count < sb.count {
        Winner::White
    } else {
        Winner::Draw
    }
}

