use anchor_lang::prelude::*;

pub mod crypto;
pub mod fleet;
pub mod state;

use state::{DreadtideError, Game, Phase, ACTION_SECONDS};

declare_id!("cGfHiC6Kgg3FpFZvgwGcswsCRtp4aBP2fzuXRQPizuN");

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ShipPlacement {
    pub x: u8,
    pub y: u8,
    pub vertical: bool,
}

#[program]
pub mod dreadtide {
    use super::*;

    pub fn create_game(ctx: Context<CreateGame>, game_id: u64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        game.creator = ctx.accounts.creator.key();
        game.opponent = Pubkey::default();
        game.game_id = game_id;
        game.bump = ctx.bumps.game;
        game.phase = Phase::Lobby;
        game.roots = [[0; 32]; 2];
        game.committed = [false; 2];
        game.turn = 0;
        game.pending_index = u8::MAX;
        game.pending_attacker = u8::MAX;
        game.shots = [0; 2];
        game.hits = [0; 2];
        game.claimant = u8::MAX;
        game.audit_attempts = 0;
        game.audited_winner = u8::MAX;
        game.deadline = now
            .checked_add(ACTION_SECONDS)
            .ok_or(DreadtideError::ClockOverflow)?;
        Ok(())
    }

    pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(game.phase == Phase::Lobby, DreadtideError::WrongPhase);
        require!(now <= game.deadline, DreadtideError::DeadlinePassed);
        require!(
            ctx.accounts.opponent.key() != game.creator,
            DreadtideError::SelfJoin
        );
        game.opponent = ctx.accounts.opponent.key();
        game.phase = Phase::Commit;
        game.deadline = now
            .checked_add(ACTION_SECONDS)
            .ok_or(DreadtideError::ClockOverflow)?;
        Ok(())
    }

    pub fn commit_board(ctx: Context<PlayerAction>, root: [u8; 32]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(game.phase == Phase::Commit, DreadtideError::WrongPhase);
        require!(now <= game.deadline, DreadtideError::DeadlinePassed);
        let player = game
            .player_index(&ctx.accounts.player.key())
            .ok_or(DreadtideError::NotPlayer)? as usize;
        require!(!game.committed[player], DreadtideError::AlreadyCommitted);
        game.roots[player] = root;
        game.committed[player] = true;
        if game.committed[0] && game.committed[1] {
            game.phase = Phase::Fire;
            game.turn = 0;
            game.deadline = now
                .checked_add(ACTION_SECONDS)
                .ok_or(DreadtideError::ClockOverflow)?;
        }
        Ok(())
    }

    pub fn fire(ctx: Context<PlayerAction>, index: u8) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(game.phase == Phase::Fire, DreadtideError::WrongPhase);
        require!(now <= game.deadline, DreadtideError::DeadlinePassed);
        require!(index < 64, DreadtideError::InvalidCell);
        let attacker = game
            .player_index(&ctx.accounts.player.key())
            .ok_or(DreadtideError::NotPlayer)?;
        require!(attacker == game.turn, DreadtideError::WrongPlayer);
        let defender = (1 - attacker) as usize;
        require!(
            game.shots[defender] & (1u64 << index) == 0,
            DreadtideError::DuplicateShot
        );
        game.pending_index = index;
        game.pending_attacker = attacker;
        game.phase = Phase::Respond;
        game.deadline = now
            .checked_add(ACTION_SECONDS)
            .ok_or(DreadtideError::ClockOverflow)?;
        Ok(())
    }

    pub fn respond(
        ctx: Context<PlayerAction>,
        is_ship: bool,
        cell_salt: [u8; 32],
        siblings: [[u8; 32]; 6],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(game.phase == Phase::Respond, DreadtideError::WrongPhase);
        require!(now <= game.deadline, DreadtideError::DeadlinePassed);
        let defender = game
            .player_index(&ctx.accounts.player.key())
            .ok_or(DreadtideError::NotPlayer)?;
        require!(
            defender == 1 - game.pending_attacker,
            DreadtideError::WrongPlayer
        );
        let index = game.pending_index;
        require!(
            crypto::verify(
                &game.roots[defender as usize],
                game.game_id,
                &ctx.accounts.player.key().to_bytes(),
                index,
                is_ship,
                &cell_salt,
                &siblings
            ),
            DreadtideError::InvalidProof
        );
        game.shots[defender as usize] |= 1u64 << index;
        if is_ship {
            game.hits[defender as usize] = game.hits[defender as usize]
                .checked_add(1)
                .ok_or(DreadtideError::InvalidCell)?;
        }
        emit!(state::ShotVerified {
            game: game.key(),
            attacker: game.player(game.pending_attacker),
            defender: ctx.accounts.player.key(),
            index,
            is_ship,
            root: game.roots[defender as usize],
        });
        let attacker = game.pending_attacker;
        game.pending_index = u8::MAX;
        game.pending_attacker = u8::MAX;
        if game.hits[defender as usize] == 12 {
            game.enter_audit(attacker, now)?;
        } else {
            game.phase = Phase::Fire;
            game.turn = defender;
            game.deadline = now
                .checked_add(ACTION_SECONDS)
                .ok_or(DreadtideError::ClockOverflow)?;
        }
        Ok(())
    }

    pub fn claim_timeout(ctx: Context<ClaimTimeout>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(now > game.deadline, DreadtideError::DeadlineNotPassed);
        match game.phase {
            Phase::Lobby => game.phase = Phase::Cancelled,
            Phase::Commit => match game.committed {
                [true, false] => game.enter_audit(0, now)?,
                [false, true] => game.enter_audit(1, now)?,
                _ => game.phase = Phase::NoVerifiedWinner,
            },
            Phase::Fire => {
                let beneficiary = 1 - game.turn;
                game.enter_audit(beneficiary, now)?;
            }
            Phase::Respond => {
                let beneficiary = game.pending_attacker;
                game.enter_audit(beneficiary, now)?;
            }
            Phase::Audit => game.fail_audit(now)?,
            _ => return err!(DreadtideError::WrongPhase),
        }
        Ok(())
    }

    pub fn audit_board(
        ctx: Context<PlayerAction>,
        seed: [u8; 32],
        placements: [ShipPlacement; 4],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(game.phase == Phase::Audit, DreadtideError::WrongPhase);
        require!(now <= game.deadline, DreadtideError::DeadlinePassed);
        let claimant = game
            .player_index(&ctx.accounts.player.key())
            .ok_or(DreadtideError::NotPlayer)?;
        require!(claimant == game.claimant, DreadtideError::WrongPlayer);
        let ships = placements.map(|ship| fleet::Ship {
            x: ship.x,
            y: ship.y,
            vertical: ship.vertical,
        });
        let valid = fleet::occupancy(&ships)
            .map(|board| {
                crypto::root(
                    game.game_id,
                    &ctx.accounts.player.key().to_bytes(),
                    &seed,
                    &board,
                ) == game.roots[claimant as usize]
            })
            .unwrap_or(false);
        if valid {
            game.phase = Phase::VerifiedFinished;
            game.audited_winner = claimant;
            emit!(state::AuditAccepted {
                game: game.key(),
                winner: ctx.accounts.player.key()
            });
        } else {
            emit!(state::AuditRejected {
                game: game.key(),
                claimant: ctx.accounts.player.key()
            });
            game.fail_audit(now)?;
        }
        Ok(())
    }

    pub fn cancel_game(ctx: Context<PlayerAction>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        require!(game.phase == Phase::Lobby, DreadtideError::WrongPhase);
        require!(
            ctx.accounts.player.key() == game.creator,
            DreadtideError::WrongPlayer
        );
        require!(now > game.deadline, DreadtideError::DeadlineNotPassed);
        game.phase = Phase::Cancelled;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(init, payer = creator, space = 8 + Game::SPACE, seeds = [b"game", creator.key().as_ref(), &game_id.to_le_bytes()], bump)]
    pub game: Account<'info, Game>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(mut, seeds = [b"game", game.creator.as_ref(), &game.game_id.to_le_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,
    pub opponent: Signer<'info>,
}

#[derive(Accounts)]
pub struct PlayerAction<'info> {
    #[account(mut, seeds = [b"game", game.creator.as_ref(), &game.game_id.to_le_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimTimeout<'info> {
    #[account(mut, seeds = [b"game", game.creator.as_ref(), &game.game_id.to_le_bytes()], bump = game.bump)]
    pub game: Account<'info, Game>,
    pub caller: Signer<'info>,
}
