use sha2::{Digest, Sha256};

pub type Hash = [u8; 32];
pub type Proof = [Hash; 6];

pub fn salt(seed: &Hash, index: u8) -> Hash {
    let mut hasher = Sha256::new();
    hasher.update(b"DT-SALT");
    hasher.update(seed);
    hasher.update([index]);
    hasher.finalize().into()
}

pub fn leaf(game_id: u64, player: &Hash, index: u8, is_ship: bool, cell_salt: &Hash) -> Hash {
    let mut hasher = Sha256::new();
    hasher.update([0]);
    hasher.update(game_id.to_le_bytes());
    hasher.update(player);
    hasher.update([index]);
    hasher.update([u8::from(is_ship)]);
    hasher.update(cell_salt);
    hasher.finalize().into()
}

pub fn node(left: &Hash, right: &Hash) -> Hash {
    let mut hasher = Sha256::new();
    hasher.update([1]);
    hasher.update(left);
    hasher.update(right);
    hasher.finalize().into()
}

pub fn root(game_id: u64, player: &Hash, seed: &Hash, board: &[bool; 64]) -> Hash {
    let mut level = [Hash::default(); 64];
    for i in 0..64 {
        level[i] = leaf(game_id, player, i as u8, board[i], &salt(seed, i as u8));
    }
    let mut width = 64;
    while width > 1 {
        for i in 0..width / 2 {
            level[i] = node(&level[2 * i], &level[2 * i + 1]);
        }
        width /= 2;
    }
    level[0]
}

pub fn verify(root: &Hash, game_id: u64, player: &Hash, index: u8, is_ship: bool, cell_salt: &Hash, proof: &Proof) -> bool {
    if index >= 64 {
        return false;
    }
    let mut hash = leaf(game_id, player, index, is_ship, cell_salt);
    let mut position = index;
    for sibling in proof {
        hash = if position & 1 == 0 { node(&hash, sibling) } else { node(sibling, &hash) };
        position >>= 1;
    }
    &hash == root
}

pub fn proof(game_id: u64, player: &Hash, seed: &Hash, board: &[bool; 64], index: u8) -> Option<Proof> {
    if index >= 64 {
        return None;
    }
    let mut level = [Hash::default(); 64];
    for i in 0..64 {
        level[i] = leaf(game_id, player, i as u8, board[i], &salt(seed, i as u8));
    }
    let mut path = [Hash::default(); 6];
    let mut width = 64;
    let mut position = usize::from(index);
    for sibling in &mut path {
        *sibling = level[position ^ 1];
        for i in 0..width / 2 {
            level[i] = node(&level[2 * i], &level[2 * i + 1]);
        }
        position /= 2;
        width /= 2;
    }
    Some(path)
}
