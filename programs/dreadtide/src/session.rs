use anchor_lang::prelude::*;

#[account]
pub struct MatchSession {
    pub game: Pubkey,
    pub player: Pubkey,
    pub delegate: Pubkey,
    pub expires_at: i64,
    pub bump: u8,
}

impl MatchSession {
    pub const SPACE: usize = 32 + 32 + 32 + 8 + 1;
}
