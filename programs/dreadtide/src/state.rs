use anchor_lang::prelude::*;

pub const ACTION_SECONDS: i64 = 120;
pub const AUDIT_SECONDS: i64 = 300;

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
}
