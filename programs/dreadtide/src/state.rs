use crate::{crypto, fleet};
use anchor_lang::prelude::*;

// Browser wallet matches need enough time for a second player to receive the
// address, switch accounts or devices, approve, and confirm on Devnet.
pub const ACTION_SECONDS: i64 = 900;
pub const AUDIT_SECONDS: i64 = 300;
pub const BATTLE_SECONDS: i64 = 300;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Phase {
    Lobby,
    Commit,
    Fire,
    Respond,
    Audit,
    VerifiedFinished,
    NoVerifiedWinner,
    Cancelled,
}

#[account]
pub struct Game {
    pub creator: Pubkey,
    pub opponent: Pubkey,
    pub game_id: u64,
    pub bump: u8,
    pub phase: Phase,
    pub roots: [[u8; 32]; 2],
    pub committed: [bool; 2],
    pub turn: u8,
    pub pending_index: u8,
    pub pending_attacker: u8,
    pub shots: [u64; 2],
    pub hits: [u8; 2],
    pub deadline: i64,
    pub claimant: u8,
    pub audit_attempts: u8,
    pub audited_winner: u8,
}

pub struct ShotResult {
    pub attacker: u8,
    pub defender: u8,
    pub index: u8,
    pub is_ship: bool,
}

impl Game {
    pub const SPACE: usize = 32 + 32 + 8 + 1 + 1 + 64 + 2 + 1 + 1 + 1 + 16 + 2 + 8 + 1 + 1 + 1;

    pub fn player_index(&self, signer: &Pubkey) -> Option<u8> {
        if *signer == self.creator {
            Some(0)
        } else if *signer == self.opponent && self.opponent != Pubkey::default() {
            Some(1)
        } else {
            None
        }
    }

    pub fn player(&self, index: u8) -> Pubkey {
        if index == 0 {
            self.creator
        } else {
            self.opponent
        }
    }

    pub fn forfeit(&mut self, signer: &Pubkey) -> Result<u8> {
        require!(
            !matches!(
                self.phase,
                Phase::VerifiedFinished | Phase::NoVerifiedWinner | Phase::Cancelled
            ),
            DreadtideError::WrongPhase
        );
        require!(
            self.opponent != Pubkey::default(),
            DreadtideError::NoOpponent
        );
        let forfeiter = self.player_index(signer).ok_or(DreadtideError::NotPlayer)?;
        let winner = 1 - forfeiter;
        self.phase = Phase::VerifiedFinished;
        self.audited_winner = winner;
        self.claimant = winner;
        self.pending_index = u8::MAX;
        self.pending_attacker = u8::MAX;
        Ok(winner)
    }

    pub fn enter_audit(&mut self, claimant: u8, now: i64) -> Result<()> {
        require!(
            claimant < 2 && self.committed[claimant as usize],
            DreadtideError::NoEligibleClaimant
        );
        self.phase = Phase::Audit;
        self.claimant = claimant;
        self.deadline = now
            .checked_add(AUDIT_SECONDS)
            .ok_or(DreadtideError::ClockOverflow)?;
        Ok(())
    }

    pub fn fail_audit(&mut self, now: i64) -> Result<()> {
        self.audit_attempts |= 1 << self.claimant;
        let other = 1 - self.claimant;
        if self.audit_attempts & (1 << other) != 0 || !self.committed[other as usize] {
            self.phase = Phase::NoVerifiedWinner;
        } else {
            self.enter_audit(other, now)?;
        }
        Ok(())
    }

    pub fn fire(&mut self, signer: &Pubkey, index: u8, now: i64) -> Result<()> {
        require!(self.phase == Phase::Fire, DreadtideError::WrongPhase);
        require!(now <= self.deadline, DreadtideError::DeadlinePassed);
        require!(index < 64, DreadtideError::InvalidCell);
        let attacker = self.player_index(signer).ok_or(DreadtideError::NotPlayer)?;
        require!(attacker == self.turn, DreadtideError::WrongPlayer);
        let defender = (1 - attacker) as usize;
        require!(
            self.shots[defender] & (1u64 << index) == 0,
            DreadtideError::DuplicateShot
        );
        self.pending_index = index;
        self.pending_attacker = attacker;
        self.phase = Phase::Respond;
        Ok(())
    }

    pub fn respond(
        &mut self,
        signer: &Pubkey,
        is_ship: bool,
        cell_salt: &crypto::Hash,
        siblings: &crypto::Proof,
        now: i64,
    ) -> Result<ShotResult> {
        require!(self.phase == Phase::Respond, DreadtideError::WrongPhase);
        require!(now <= self.deadline, DreadtideError::DeadlinePassed);
        let defender = self.player_index(signer).ok_or(DreadtideError::NotPlayer)?;
        require!(
            defender == 1 - self.pending_attacker,
            DreadtideError::WrongPlayer
        );
        let index = self.pending_index;
        require!(
            crypto::verify(
                &self.roots[defender as usize],
                self.game_id,
                &signer.to_bytes(),
                index,
                is_ship,
                cell_salt,
                siblings
            ),
            DreadtideError::InvalidProof
        );
        self.shots[defender as usize] |= 1u64 << index;
        if is_ship {
            self.hits[defender as usize] = self.hits[defender as usize]
                .checked_add(1)
                .ok_or(DreadtideError::InvalidCell)?;
        }
        let attacker = self.pending_attacker;
        self.pending_index = u8::MAX;
        self.pending_attacker = u8::MAX;
        if self.hits[defender as usize] == 12 {
            self.enter_audit(attacker, now)?;
        } else {
            self.phase = Phase::Fire;
            self.turn = defender;
        }
        Ok(ShotResult {
            attacker,
            defender,
            index,
            is_ship,
        })
    }

    pub fn claim_timeout(&mut self, now: i64) -> Result<()> {
        require!(now > self.deadline, DreadtideError::DeadlineNotPassed);
        match self.phase {
            Phase::Lobby => self.phase = Phase::Cancelled,
            Phase::Commit => match self.committed {
                [true, false] => self.enter_audit(0, now)?,
                [false, true] => self.enter_audit(1, now)?,
                _ => self.phase = Phase::NoVerifiedWinner,
            },
            Phase::Fire | Phase::Respond => {
                // Hits are stored against each defender, so hits[1] is damage
                // dealt by the creator and hits[0] is damage dealt by opponent.
                if self.hits[1] > self.hits[0] {
                    self.enter_audit(0, now)?;
                } else if self.hits[0] > self.hits[1] {
                    self.enter_audit(1, now)?;
                } else {
                    self.phase = Phase::NoVerifiedWinner;
                }
            }
            Phase::Audit => self.fail_audit(now)?,
            _ => return err!(DreadtideError::WrongPhase),
        }
        Ok(())
    }

    pub fn audit_board(
        &mut self,
        signer: &Pubkey,
        seed: &crypto::Hash,
        ships: &[fleet::Ship; 4],
        now: i64,
    ) -> Result<bool> {
        require!(self.phase == Phase::Audit, DreadtideError::WrongPhase);
        require!(now <= self.deadline, DreadtideError::DeadlinePassed);
        let claimant = self.player_index(signer).ok_or(DreadtideError::NotPlayer)?;
        require!(claimant == self.claimant, DreadtideError::WrongPlayer);
        let valid = fleet::occupancy(ships)
            .map(|board| {
                crypto::root(self.game_id, &signer.to_bytes(), seed, &board)
                    == self.roots[claimant as usize]
            })
            .unwrap_or(false);
        if valid {
            self.phase = Phase::VerifiedFinished;
            self.audited_winner = claimant;
        } else {
            self.fail_audit(now)?;
        }
        Ok(valid)
    }
}

#[event]
pub struct ShotVerified {
    pub game: Pubkey,
    pub attacker: Pubkey,
    pub defender: Pubkey,
    pub index: u8,
    pub is_ship: bool,
    pub root: [u8; 32],
}

#[event]
pub struct AuditAccepted {
    pub game: Pubkey,
    pub winner: Pubkey,
}

#[event]
pub struct AuditRejected {
    pub game: Pubkey,
    pub claimant: Pubkey,
}

#[event]
pub struct MatchForfeited {
    pub game: Pubkey,
    pub forfeiter: Pubkey,
    pub winner: Pubkey,
}

#[error_code]
pub enum DreadtideError {
    #[msg("Wrong game phase")]
    WrongPhase,
    #[msg("Action deadline has passed")]
    DeadlinePassed,
    #[msg("Action deadline has not passed")]
    DeadlineNotPassed,
    #[msg("Signer is not a player")]
    NotPlayer,
    #[msg("Wrong player for this action")]
    WrongPlayer,
    #[msg("Creator cannot join their own game")]
    SelfJoin,
    #[msg("Board already committed")]
    AlreadyCommitted,
    #[msg("Cell is outside the grid")]
    InvalidCell,
    #[msg("Cell has already been fired upon")]
    DuplicateShot,
    #[msg("Merkle proof does not match defender root")]
    InvalidProof,
    #[msg("No committed player can claim this timeout")]
    NoEligibleClaimant,
    #[msg("Clock arithmetic overflow")]
    ClockOverflow,
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
    #[msg("A match cannot be forfeited before an opponent joins")]
    NoOpponent,
}
