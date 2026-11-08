use anchor_lang::prelude::*;

pub const DAILY_COINS: u64 = 100;
pub const MIN_STAKE: u64 = 50;
pub const LAMPORTS_PER_DCOIN: u64 = 10_000_000; // 0.01 SOL
pub const DAY_SECONDS: i64 = 86_400;

#[account]
pub struct PlayerProfile {
    pub owner: Pubkey,
    pub balance: u64,
    pub last_claim_day: i64,
    pub bump: u8,
}

impl PlayerProfile {
    pub const SPACE: usize = 32 + 8 + 8 + 1;

    pub fn credit(&mut self, amount: u64) -> Result<()> {
        self.balance = self
            .balance
            .checked_add(amount)
            .ok_or(EconomyError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn debit(&mut self, amount: u64) -> Result<()> {
        require!(self.balance >= amount, EconomyError::InsufficientDCoins);
        self.balance = self
            .balance
            .checked_sub(amount)
            .ok_or(EconomyError::ArithmeticOverflow)?;
        Ok(())
    }
}

#[account]
pub struct MatchStake {
    pub game: Pubkey,
    pub amount_per_player: u64,
    pub creator_deposited: bool,
    pub opponent_deposited: bool,
    pub settled: bool,
    pub bump: u8,
}

impl MatchStake {
    pub const SPACE: usize = 32 + 8 + 1 + 1 + 1 + 1;
}

#[event]
pub struct DCoinsPurchased {
    pub player: Pubkey,
    pub coins: u64,
    pub lamports: u64,
}

#[event]
pub struct DailyCoinsClaimed {
    pub player: Pubkey,
    pub coins: u64,
    pub day: i64,
}

#[event]
pub struct StakeSettled {
    pub game: Pubkey,
    pub winner: Pubkey,
    pub pot: u64,
    pub refunded: bool,
}

#[error_code]
pub enum EconomyError {
    #[msg("D-Coin arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Daily D-Coins have already been claimed today")]
    DailyAlreadyClaimed,
    #[msg("Stake must be at least 50 D-Coins")]
    StakeBelowMinimum,
    #[msg("D-Coin balance is too low")]
    InsufficientDCoins,
    #[msg("Stake has already been deposited")]
    StakeAlreadyDeposited,
    #[msg("Both players must escrow before settlement")]
    StakeNotReady,
    #[msg("Stake has already been settled")]
    StakeAlreadySettled,
    #[msg("Match is not ready for stake settlement")]
    MatchNotFinished,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(balance: u64) -> PlayerProfile {
        PlayerProfile {
            owner: Pubkey::new_unique(),
            balance,
            last_claim_day: 0,
            bump: 1,
        }
    }

    #[test]
    fn debit_never_allows_negative_balance() {
        let mut player = profile(50);
        assert!(player.debit(51).is_err());
        assert_eq!(player.balance, 50);
        player.debit(50).unwrap();
        assert_eq!(player.balance, 0);
    }

    #[test]
    fn conversion_rate_is_exactly_point_zero_one_sol() {
        assert_eq!(LAMPORTS_PER_DCOIN, 10_000_000);
        assert_eq!(100u64.checked_mul(LAMPORTS_PER_DCOIN), Some(1_000_000_000));
    }
}
