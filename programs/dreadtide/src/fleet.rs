pub const FLEET_LENGTHS: [u8; 4] = [4, 3, 3, 2];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ship {
    pub x: u8,
    pub y: u8,
    pub vertical: bool,
}

pub fn occupancy(ships: &[Ship; 4]) -> Option<[bool; 64]> {
    let mut board = [false; 64];
    for (ship, len) in ships.iter().zip(FLEET_LENGTHS) {
        for step in 0..len {
            let x = ship.x.checked_add(if ship.vertical { 0 } else { step })?;
            let y = ship.y.checked_add(if ship.vertical { step } else { 0 })?;
            if x >= 8 || y >= 8 {
                return None;
            }
            let index = usize::from(y) * 8 + usize::from(x);
            if board[index] {
                return None;
            }
            board[index] = true;
        }
    }
    Some(board)
}
