use anchor_lang::prelude::Pubkey;
use dreadtide::state::{Game, Phase, AUDIT_SECONDS};

fn audit_game() -> Game {
    Game {
        creator: Pubkey::new_from_array([1; 32]),
        opponent: Pubkey::new_from_array([2; 32]),
        game_id: 42,
        bump: 1,
        phase: Phase::Fire,
        roots: [[0; 32]; 2],
        committed: [true, true],
        turn: 0,
        pending_index: u8::MAX,
        pending_attacker: u8::MAX,
        shots: [0; 2],
        hits: [0; 2],
        deadline: 0,
        claimant: u8::MAX,
        audit_attempts: 0,
        audited_winner: u8::MAX,
    }
}

#[test]
fn failed_claimant_moves_to_opponent_then_no_verified_winner() {
    let mut game = audit_game();
    game.enter_audit(0, 1_000).unwrap();
    assert_eq!(game.deadline, 1_000 + AUDIT_SECONDS);
    game.fail_audit(1_100).unwrap();
    assert_eq!(game.phase, Phase::Audit);
    assert_eq!(game.claimant, 1);
    assert_eq!(game.audit_attempts, 1);
    assert_eq!(game.deadline, 1_100 + AUDIT_SECONDS);
    game.fail_audit(1_200).unwrap();
    assert_eq!(game.phase, Phase::NoVerifiedWinner);
    assert_eq!(game.audit_attempts, 3);
    assert_eq!(game.audited_winner, u8::MAX);
}

#[test]
fn uncommitted_player_cannot_become_claimant() {
    let mut game = audit_game();
    game.committed[1] = false;
    assert!(game.enter_audit(1, 1_000).is_err());
    game.enter_audit(0, 1_000).unwrap();
    game.fail_audit(1_100).unwrap();
    assert_eq!(game.phase, Phase::NoVerifiedWinner);
}
