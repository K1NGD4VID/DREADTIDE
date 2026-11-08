use anchor_lang::prelude::*;

pub mod crypto;
pub mod economy;
pub mod fleet;
pub mod state;

use state::{DreadtideError, Game, Phase, ACTION_SECONDS, BATTLE_SECONDS};

declare_id!("BNFQudgxvwLNZNhj1aSTVXqzXpBn68jifArJ5xRCGUE4");

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
                .checked_add(BATTLE_SECONDS)
                .ok_or(DreadtideError::ClockOverflow)?;
        }
        Ok(())
    }

    pub fn fire(ctx: Context<PlayerAction>, index: u8) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        ctx.accounts
            .game
            .fire(&ctx.accounts.player.key(), index, now)
    }

    pub fn respond(
        ctx: Context<PlayerAction>,
        is_ship: bool,
        cell_salt: [u8; 32],
        siblings: [[u8; 32]; 6],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        let shot = game.respond(
            &ctx.accounts.player.key(),
            is_ship,
            &cell_salt,
            &siblings,
            now,
        )?;
        emit!(state::ShotVerified {
            game: game.key(),
            attacker: game.player(shot.attacker),
            defender: ctx.accounts.player.key(),
            index: shot.index,
            is_ship: shot.is_ship,
            root: game.roots[shot.defender as usize],
        });
        Ok(())
    }

    pub fn claim_timeout(ctx: Context<ClaimTimeout>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        ctx.accounts.game.claim_timeout(now)
    }

    pub fn audit_board(
        ctx: Context<PlayerAction>,
        seed: [u8; 32],
        placements: [ShipPlacement; 4],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let game = &mut ctx.accounts.game;
        let ships = placements.map(|ship| fleet::Ship {
            x: ship.x,
            y: ship.y,
            vertical: ship.vertical,
        });
        let valid = game.audit_board(&ctx.accounts.player.key(), &seed, &ships, now)?;
        if valid {
            emit!(state::AuditAccepted {
                game: game.key(),
                winner: ctx.accounts.player.key()
            });
        } else {
            emit!(state::AuditRejected {
                game: game.key(),
                claimant: ctx.accounts.player.key()
            });
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

    pub fn forfeit_game(ctx: Context<PlayerAction>) -> Result<()> {
        let game = &mut ctx.accounts.game;
        let winner = game.forfeit(&ctx.accounts.player.key())?;
        emit!(state::MatchForfeited {
            game: game.key(),
            forfeiter: ctx.accounts.player.key(),
            winner: game.player(winner),
        });
        Ok(())
    }

    pub fn create_profile(ctx: Context<CreateProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.owner = ctx.accounts.player.key();
        profile.balance = economy::DAILY_COINS;
        profile.last_claim_day = Clock::get()?
            .unix_timestamp
            .div_euclid(economy::DAY_SECONDS);
        profile.bump = ctx.bumps.profile;
        emit!(economy::DailyCoinsClaimed {
            player: profile.owner,
            coins: economy::DAILY_COINS,
            day: profile.last_claim_day
        });
        Ok(())
    }

    pub fn claim_daily(ctx: Context<ProfileAction>) -> Result<()> {
        let day = Clock::get()?
            .unix_timestamp
            .div_euclid(economy::DAY_SECONDS);
        let profile = &mut ctx.accounts.profile;
        require!(
            day > profile.last_claim_day,
            DreadtideError::DailyAlreadyClaimed
        );
        profile.credit(economy::DAILY_COINS)?;
        profile.last_claim_day = day;
        emit!(economy::DailyCoinsClaimed {
            player: profile.owner,
            coins: economy::DAILY_COINS,
            day
        });
        Ok(())
    }

    pub fn buy_coins(ctx: Context<BuyCoins>, coins: u64) -> Result<()> {
        require!(coins > 0, DreadtideError::StakeBelowMinimum);
        let lamports = coins
            .checked_mul(economy::LAMPORTS_PER_DCOIN)
            .ok_or(DreadtideError::ArithmeticOverflow)?;
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            lamports,
        )?;
        ctx.accounts.profile.credit(coins)?;
        emit!(economy::DCoinsPurchased {
            player: ctx.accounts.player.key(),
            coins,
            lamports
        });
        Ok(())
    }

    pub fn open_stake(ctx: Context<OpenStake>, amount: u64) -> Result<()> {
        require!(
            amount >= economy::MIN_STAKE,
            DreadtideError::StakeBelowMinimum
        );
        require!(
            ctx.accounts.game.creator == ctx.accounts.creator.key(),
            DreadtideError::WrongPlayer
        );
        require!(
            ctx.accounts.game.phase == Phase::Lobby,
            DreadtideError::WrongPhase
        );
        ctx.accounts.creator_profile.debit(amount)?;
        let stake = &mut ctx.accounts.stake;
        stake.game = ctx.accounts.game.key();
        stake.amount_per_player = amount;
        stake.creator_deposited = true;
        stake.opponent_deposited = false;
        stake.settled = false;
        stake.bump = ctx.bumps.stake;
        Ok(())
    }

    pub fn accept_stake(ctx: Context<AcceptStake>) -> Result<()> {
        require!(
            ctx.accounts.game.opponent == ctx.accounts.opponent.key(),
            DreadtideError::WrongPlayer
        );
        require!(
            !ctx.accounts.stake.opponent_deposited,
            DreadtideError::StakeAlreadyDeposited
        );
        ctx.accounts
            .opponent_profile
            .debit(ctx.accounts.stake.amount_per_player)?;
        ctx.accounts.stake.opponent_deposited = true;
        Ok(())
    }

    pub fn settle_stake(ctx: Context<SettleStake>) -> Result<()> {
        let stake = &mut ctx.accounts.stake;
        require!(!stake.settled, DreadtideError::StakeAlreadySettled);
        require!(
            stake.creator_deposited && stake.opponent_deposited,
            DreadtideError::StakeNotReady
        );
        let pot = stake
            .amount_per_player
            .checked_mul(2)
            .ok_or(DreadtideError::ArithmeticOverflow)?;
        let (winner, refunded) = match ctx.accounts.game.phase {
            Phase::VerifiedFinished => {
                if ctx.accounts.game.audited_winner == 0 {
                    ctx.accounts.creator_profile.credit(pot)?;
                    (ctx.accounts.game.creator, false)
                } else {
                    ctx.accounts.opponent_profile.credit(pot)?;
                    (ctx.accounts.game.opponent, false)
                }
            }
            Phase::NoVerifiedWinner | Phase::Cancelled => {
                ctx.accounts
                    .creator_profile
                    .credit(stake.amount_per_player)?;
                ctx.accounts
                    .opponent_profile
                    .credit(stake.amount_per_player)?;
                (Pubkey::default(), true)
            }
            _ => return err!(DreadtideError::MatchNotFinished),
        };
        stake.settled = true;
        emit!(economy::StakeSettled {
            game: ctx.accounts.game.key(),
            winner,
            pot,
            refunded
        });
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

#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(init, payer = player, space = 8 + economy::PlayerProfile::SPACE, seeds = [b"profile", player.key().as_ref()], bump)]
    pub profile: Account<'info, economy::PlayerProfile>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProfileAction<'info> {
    #[account(mut, seeds = [b"profile", player.key().as_ref()], bump = profile.bump, constraint = profile.owner == player.key())]
    pub profile: Account<'info, economy::PlayerProfile>,
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct BuyCoins<'info> {
    #[account(mut, seeds = [b"profile", player.key().as_ref()], bump = profile.bump, constraint = profile.owner == player.key())]
    pub profile: Account<'info, economy::PlayerProfile>,
    #[account(mut)]
    pub player: Signer<'info>,
    /// CHECK: program-derived SOL treasury; it only receives lamports.
    #[account(mut, seeds = [b"treasury"], bump)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OpenStake<'info> {
    pub game: Account<'info, Game>,
    #[account(init, payer = creator, space = 8 + economy::MatchStake::SPACE, seeds = [b"stake", game.key().as_ref()], bump)]
    pub stake: Account<'info, economy::MatchStake>,
    #[account(mut, seeds = [b"profile", creator.key().as_ref()], bump = creator_profile.bump, constraint = creator_profile.owner == creator.key())]
    pub creator_profile: Account<'info, economy::PlayerProfile>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptStake<'info> {
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [b"stake", game.key().as_ref()], bump = stake.bump, constraint = stake.game == game.key())]
    pub stake: Account<'info, economy::MatchStake>,
    #[account(mut, seeds = [b"profile", opponent.key().as_ref()], bump = opponent_profile.bump, constraint = opponent_profile.owner == opponent.key())]
    pub opponent_profile: Account<'info, economy::PlayerProfile>,
    pub opponent: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleStake<'info> {
    pub game: Account<'info, Game>,
    #[account(mut, seeds = [b"stake", game.key().as_ref()], bump = stake.bump, constraint = stake.game == game.key())]
    pub stake: Account<'info, economy::MatchStake>,
    #[account(mut, seeds = [b"profile", game.creator.as_ref()], bump = creator_profile.bump, constraint = creator_profile.owner == game.creator)]
    pub creator_profile: Account<'info, economy::PlayerProfile>,
    #[account(mut, seeds = [b"profile", game.opponent.as_ref()], bump = opponent_profile.bump, constraint = opponent_profile.owner == game.opponent)]
    pub opponent_profile: Account<'info, economy::PlayerProfile>,
    pub caller: Signer<'info>,
}
