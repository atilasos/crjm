use super::board::{bit, Board, CELLS};

pub fn group_sizes(mask: u64, board: &Board) -> Vec<u8> {
    let mut sizes = Vec::new();
    let mut remaining = mask;

    while remaining != 0 {
        let start = remaining.trailing_zeros() as usize;
        let start_bit = bit(start);
        remaining &= !start_bit;

        let mut stack = start_bit;
        let mut group = start_bit;

        while stack != 0 {
            let idx = stack.trailing_zeros() as usize;
            let b = bit(idx);
            stack &= !b;

            let neigh = board.neighbours[idx] & remaining;
            if neigh != 0 {
                stack |= neigh;
                group |= neigh;
                remaining &= !neigh;
            }
        }

        sizes.push(group.count_ones() as u8);
    }

    sizes
}

pub fn component_ids(mask: u64, board: &Board) -> [u8; CELLS] {
    let mut ids = [0u8; CELLS];
    let mut remaining = mask;
    let mut next_id: u8 = 1;

    while remaining != 0 {
        let start = remaining.trailing_zeros() as usize;
        let start_bit = bit(start);
        remaining &= !start_bit;

        let mut stack = start_bit;
        ids[start] = next_id;

        while stack != 0 {
            let idx = stack.trailing_zeros() as usize;
            let b = bit(idx);
            stack &= !b;

            let neigh = board.neighbours[idx] & remaining;
            if neigh != 0 {
                let mut tmp = neigh;
                while tmp != 0 {
                    let j = tmp.trailing_zeros() as usize;
                    ids[j] = next_id;
                    tmp &= !bit(j);
                }
                stack |= neigh;
                remaining &= !neigh;
            }
        }

        next_id = next_id.wrapping_add(1);
        if next_id == 0 {
            break;
        }
    }

    ids
}

