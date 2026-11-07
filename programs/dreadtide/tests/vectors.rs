use dreadtide::{crypto, fleet};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vector {
    game_id: String,
    player: String,
    seed: String,
    ships: [ShipFixture; 4],
    root: String,
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct ShipFixture {
    x: u8,
    y: u8,
    vertical: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    index: u8,
    is_ship: bool,
    salt: String,
    leaf: String,
    siblings: Vec<String>,
}

fn bytes(hex_string: &str) -> crypto::Hash {
    hex::decode(hex_string).unwrap().try_into().unwrap()
}

#[test]
fn shared_vectors_and_tampering() {
    let vector: Vector = serde_json::from_str(include_str!("../../../fixtures/merkle-vectors.json")).unwrap();
    let game_id: u64 = vector.game_id.parse().unwrap();
    let player = bytes(&vector.player);
    let seed = bytes(&vector.seed);
    let ships = vector.ships.map(|ship| fleet::Ship { x: ship.x, y: ship.y, vertical: ship.vertical });
    let board = fleet::occupancy(&ships).unwrap();
    assert_eq!(board.iter().filter(|occupied| **occupied).count(), 12);
    let root = bytes(&vector.root);
    assert_eq!(crypto::root(game_id, &player, &seed, &board), root);
    for fixture in &vector.cases {
        let salt = bytes(&fixture.salt);
        let siblings: crypto::Proof = fixture.siblings.iter().map(|s| bytes(s)).collect::<Vec<_>>().try_into().unwrap();
        assert_eq!(board[fixture.index as usize], fixture.is_ship);
        assert_eq!(crypto::salt(&seed, fixture.index), salt);
        assert_eq!(crypto::leaf(game_id, &player, fixture.index, fixture.is_ship, &salt), bytes(&fixture.leaf));
        assert_eq!(crypto::proof(game_id, &player, &seed, &board, fixture.index).unwrap(), siblings);
        assert!(crypto::verify(&root, game_id, &player, fixture.index, fixture.is_ship, &salt, &siblings));
        assert!(!crypto::verify(&root, game_id, &player, fixture.index, !fixture.is_ship, &salt, &siblings));
        assert!(!crypto::verify(&root, game_id + 1, &player, fixture.index, fixture.is_ship, &salt, &siblings));
        assert!(!crypto::verify(&root, game_id, &seed, fixture.index, fixture.is_ship, &salt, &siblings));
        let mut wrong_salt = salt;
        wrong_salt[0] ^= 1;
        assert!(!crypto::verify(&root, game_id, &player, fixture.index, fixture.is_ship, &wrong_salt, &siblings));
        let mut wrong_proof = siblings;
        wrong_proof[0][0] ^= 1;
        assert!(!crypto::verify(&root, game_id, &player, fixture.index, fixture.is_ship, &salt, &wrong_proof));
    }
    assert!(!crypto::verify(&root, game_id, &player, 64, false, &[0; 32], &[[0; 32]; 6]));
}

#[test]
fn illegal_fleets_are_rejected() {
    let valid = [
        fleet::Ship { x: 0, y: 0, vertical: false },
        fleet::Ship { x: 2, y: 2, vertical: true },
        fleet::Ship { x: 4, y: 4, vertical: false },
        fleet::Ship { x: 7, y: 6, vertical: true },
    ];
    let mut out_of_bounds = valid;
    out_of_bounds[0].x = 6;
    assert!(fleet::occupancy(&out_of_bounds).is_none());
    let mut overlapping = valid;
    overlapping[1].x = 0;
    overlapping[1].y = 0;
    assert!(fleet::occupancy(&overlapping).is_none());
}
