use anchor_lang::prelude::*;

pub const RESPONSE_SECONDS: i64 = 30;
pub const TIMED_MATCH_FLAG: u8 = 1 << 7;

#[account]
pub struct BattleClock {
    pub game: Pubkey,
    pub battle_deadline: i64,
    pub response_deadline: i64,
    pub bump: u8,
}

impl BattleClock {
    pub const SPACE: usize = 32 + 8 + 8 + 1;
}
