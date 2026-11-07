export type Bytes32 = Uint8Array<ArrayBuffer>;
export type Ship = { x: number; y: number; vertical: boolean };
export const FLEET_LENGTHS = [4, 3, 3, 2] as const;
const encoder = new TextEncoder();

function concat(...parts: Uint8Array[]): Bytes32 {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function sha256(...parts: Uint8Array[]): Promise<Bytes32> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", concat(...parts)));
}

function byte(value: number): Bytes32 {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error("invalid byte");
  return Uint8Array.of(value);
}

function gameIdBytes(gameId: bigint): Bytes32 {
  if (gameId < 0n || gameId > 0xffff_ffff_ffff_ffffn) throw new Error("invalid game ID");
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, gameId, true);
  return bytes;
}

function check32(bytes: Uint8Array): void {
  if (bytes.length !== 32) throw new Error("expected 32 bytes");
}

export function occupancy(ships: readonly Ship[]): boolean[] {
  if (ships.length !== FLEET_LENGTHS.length) throw new Error("expected four ships");
  const board = Array<boolean>(64).fill(false);
  ships.forEach((ship, shipIndex) => {
    if (!Number.isInteger(ship.x) || !Number.isInteger(ship.y)) throw new Error("invalid coordinate");
    for (let step = 0; step < FLEET_LENGTHS[shipIndex]; step++) {
      const x = ship.x + (ship.vertical ? 0 : step);
      const y = ship.y + (ship.vertical ? step : 0);
      if (x < 0 || x >= 8 || y < 0 || y >= 8) throw new Error("ship out of bounds");
      const index = y * 8 + x;
      if (board[index]) throw new Error("ships overlap");
      board[index] = true;
    }
  });
  return board;
}

export async function salt(seed: Uint8Array, index: number): Promise<Bytes32> {
  check32(seed);
  if (index >= 64) throw new Error("invalid cell");
  return sha256(encoder.encode("DT-SALT"), seed, byte(index));
}

export async function leaf(gameId: bigint, player: Uint8Array, index: number, isShip: boolean, cellSalt: Uint8Array): Promise<Bytes32> {
  check32(player);
  check32(cellSalt);
  if (index >= 64) throw new Error("invalid cell");
  return sha256(byte(0), gameIdBytes(gameId), player, byte(index), byte(isShip ? 1 : 0), cellSalt);
}

export async function node(left: Uint8Array, right: Uint8Array): Promise<Bytes32> {
  check32(left);
  check32(right);
  return sha256(byte(1), left, right);
}

export async function tree(gameId: bigint, player: Uint8Array, seed: Uint8Array, board: readonly boolean[]): Promise<Bytes32[][]> {
  check32(player);
  check32(seed);
  if (board.length !== 64) throw new Error("expected 64 cells");
  const leaves = await Promise.all(board.map(async (isShip, index) => leaf(gameId, player, index, isShip, await salt(seed, index))));
  const levels = [leaves];
  while (levels.at(-1)!.length > 1) {
    const previous = levels.at(-1)!;
    levels.push(await Promise.all(Array.from({ length: previous.length / 2 }, (_, index) => node(previous[2 * index], previous[2 * index + 1]))));
  }
  return levels;
}

export function proof(levels: readonly (readonly Bytes32[])[], index: number): Bytes32[] {
  if (!Number.isInteger(index) || index < 0 || index >= 64 || levels.length !== 7) throw new Error("invalid proof request");
  let position = index;
  const siblings = levels.slice(0, 6).map((level) => {
    const sibling = level[position ^ 1];
    position >>= 1;
    return sibling;
  });
  return siblings;
}

export async function verify(root: Uint8Array, gameId: bigint, player: Uint8Array, index: number, isShip: boolean, cellSalt: Uint8Array, siblings: readonly Uint8Array[]): Promise<boolean> {
  if (root.length !== 32 || !Number.isInteger(index) || index < 0 || index >= 64 || siblings.length !== 6 || siblings.some((s) => s.length !== 32)) return false;
  let hash = await leaf(gameId, player, index, isShip, cellSalt);
  let position = index;
  for (const sibling of siblings) {
    hash = position & 1 ? await node(sibling, hash) : await node(hash, sibling);
    position >>= 1;
  }
  return hash.every((value, offset) => value === root[offset]);
}
