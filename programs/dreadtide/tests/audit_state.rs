use anchor_lang::prelude::Pubkey;
use dreadtide::state::{Game, Phase, AUDIT_SECONDS};
use dreadtide::{crypto, fleet};

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

fn ships() -> [fleet::Ship; 4] {
    [
        fleet::Ship {
            x: 0,
            y: 0,
            vertical: false,
        },
        fleet::Ship {
            x: 2,
            y: 2,
            vertical: true,
        },
        fleet::Ship {
            x: 4,
            y: 4,
            vertical: false,
        },
        fleet::Ship {
            x: 7,
            y: 6,
            vertical: true,
        },
    ]
}

fn committed_game() -> (Game, [u8; 32], [u8; 32], [bool; 64]) {
    let mut game = audit_game();
    let seed0 = [7; 32];
    let seed1 = [8; 32];
    let board = fleet::occupancy(&ships()).unwrap();
    game.roots[0] = crypto::root(game.game_id, &game.creator.to_bytes(), &seed0, &board);
    game.roots[1] = crypto::root(game.game_id, &game.opponent.to_bytes(), &seed1, &board);
    game.deadline = 120;
    (game, seed0, seed1, board)
}

#[test]
fn proof_response_changes_turn_only_after_valid_proof() {
    let (mut game, _, seed1, board) = committed_game();
    let creator = game.creator;
    let opponent = game.opponent;
    assert!(game.fire(&opponent, 18, 1).is_err());
    assert!(game.fire(&creator, 64, 1).is_err());
    game.fire(&creator, 18, 1).unwrap();
    assert_eq!(game.phase, Phase::Respond);
    assert!(game.fire(&creator, 19, 2).is_err());
    let salt = crypto::salt(&seed1, 18);
    let proof = crypto::proof(game.game_id, &opponent.to_bytes(), &seed1, &board, 18).unwrap();
    assert!(game.respond(&creator, true, &salt, &proof, 2).is_err());
    let mut forged = proof;
    forged[0][0] ^= 1;
    assert!(game.respond(&opponent, true, &salt, &forged, 2).is_err());
    assert_eq!(game.hits, [0, 0]);
    assert_eq!(game.shots, [0, 0]);
    assert_eq!(game.phase, Phase::Respond);
    game.respond(&opponent, true, &salt, &proof, 2).unwrap();
    assert_eq!(game.hits, [0, 1]);
    assert_eq!(game.shots[1], 1u64 << 18);
    assert_eq!(game.phase, Phase::Fire);
    assert_eq!(game.turn, 1);
    assert!(game.fire(&creator, 19, 3).is_err());
    game.turn = 0;
    assert!(game.fire(&creator, 18, 3).is_err());
    assert!(game.fire(&creator, 19, game.deadline + 1).is_err());
}

#[test]
fn twelfth_distinct_hit_is_provisional_until_claimant_audit() {
    let (mut game, seed0, seed1, board) = committed_game();
    let creator = game.creator;
    let opponent = game.opponent;
    let hits: Vec<u8> = board
        .iter()
        .enumerate()
        .filter_map(|(i, occupied)| occupied.then_some(i as u8))
        .collect();
    let misses: Vec<u8> = board
        .iter()
        .enumerate()
        .filter_map(|(i, occupied)| (!occupied).then_some(i as u8))
        .take(11)
        .collect();
    for (round, hit) in hits.iter().enumerate() {
        let now = 2 + (round as i64) * 4;
        game.fire(&creator, *hit, now).unwrap();
        let salt1 = crypto::salt(&seed1, *hit);
        let proof1 =
            crypto::proof(game.game_id, &opponent.to_bytes(), &seed1, &board, *hit).unwrap();
        game.respond(&opponent, true, &salt1, &proof1, now + 1)
            .unwrap();
        if round < 11 {
            assert_eq!(game.phase, Phase::Fire);
            game.fire(&opponent, misses[round], now + 2).unwrap();
            let salt0 = crypto::salt(&seed0, misses[round]);
            let proof0 = crypto::proof(
                game.game_id,
                &creator.to_bytes(),
                &seed0,
                &board,
                misses[round],
            )
            .unwrap();
            game.respond(&creator, false, &salt0, &proof0, now + 3)
                .unwrap();
        }
    }
    assert_eq!(game.hits[1], 12);
    assert_eq!(game.phase, Phase::Audit);
    assert_eq!(game.claimant, 0);
    assert_eq!(game.audited_winner, u8::MAX);
    assert!(game.audit_board(&opponent, &seed1, &ships(), 50).is_err());
    assert!(game.audit_board(&creator, &seed0, &ships(), 50).unwrap());
    assert_eq!(game.phase, Phase::VerifiedFinished);
    assert_eq!(game.audited_winner, 0);
}

#[test]
fn illegal_audit_records_disqualification_and_opponent_can_audit() {
    let (mut game, _, seed1, _) = committed_game();
    let creator = game.creator;
    let opponent = game.opponent;
    game.enter_audit(0, 10).unwrap();
    let mut illegal = ships();
    illegal[0].x = 6;
    assert!(!game.audit_board(&creator, &[7; 32], &illegal, 11).unwrap());
    assert_eq!(game.audit_attempts, 1);
    assert_eq!(game.phase, Phase::Audit);
    assert_eq!(game.claimant, 1);
    assert!(game.audit_board(&opponent, &seed1, &ships(), 12).unwrap());
    assert_eq!(game.phase, Phase::VerifiedFinished);
    assert_eq!(game.audited_winner, 1);
}

#[test]
fn procedural_timeout_still_requires_beneficiary_audit() {
    let (mut game, _, seed1, _) = committed_game();
    let opponent = game.opponent;
    game.turn = 0;
    game.hits = [3, 1]; // opponent dealt three hits; creator dealt one
    assert!(game.claim_timeout(120).is_err());
    game.claim_timeout(121).unwrap();
    assert_eq!(game.phase, Phase::Audit);
    assert_eq!(game.claimant, 1);
    assert_eq!(game.audited_winner, u8::MAX);
    assert!(game.audit_board(&opponent, &seed1, &ships(), 122).unwrap());
    assert_eq!(game.audited_winner, 1);
}

#[test]
fn tied_battle_at_five_minutes_has_no_winner() {
    let (mut game, _, _, _) = committed_game();
    game.hits = [4, 4];
    game.claim_timeout(121).unwrap();
    assert_eq!(game.phase, Phase::NoVerifiedWinner);
    assert_eq!(game.audited_winner, u8::MAX);
}
