import { describe, expect, it } from "vitest";
import vector from "../fixtures/merkle-vectors.json";
import { leaf, occupancy, proof, salt, tree, verify } from "../app/lib/crypto/merkle";

const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((part) => Number.parseInt(part, 16)));
const toHex = (bytes: Uint8Array) => Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
const player = fromHex(vector.player);
const seed = fromHex(vector.seed);
const gameId = BigInt(vector.gameId);
const board = occupancy(vector.ships);

describe("DREADTIDE Merkle vectors", () => {
  it("produces the locked root and both occupied and empty proofs", async () => {
    expect(board.filter(Boolean)).toHaveLength(12);
    const levels = await tree(gameId, player, seed, board);
    expect(toHex(levels[6][0])).toBe(vector.root);
    for (const fixture of vector.cases) {
      expect(board[fixture.index]).toBe(fixture.isShip);
      expect(toHex(await salt(seed, fixture.index))).toBe(fixture.salt);
      expect(toHex(await leaf(gameId, player, fixture.index, fixture.isShip, fromHex(fixture.salt)))).toBe(fixture.leaf);
      expect(proof(levels, fixture.index).map(toHex)).toEqual(fixture.siblings);
      expect(await verify(levels[6][0], gameId, player, fixture.index, fixture.isShip, fromHex(fixture.salt), fixture.siblings.map(fromHex))).toBe(true);
    }
  });

  it("rejects tampered proofs and wrong binding fields", async () => {
    const hit = vector.cases[0];
    const root = fromHex(vector.root);
    const siblings = hit.siblings.map(fromHex);
    const cellSalt = fromHex(hit.salt);
    expect(await verify(root, gameId, player, hit.index, !hit.isShip, cellSalt, siblings)).toBe(false);
    expect(await verify(root, gameId + 1n, player, hit.index, hit.isShip, cellSalt, siblings)).toBe(false);
    expect(await verify(root, gameId, fromHex(vector.seed), hit.index, hit.isShip, cellSalt, siblings)).toBe(false);
    expect(await verify(root, gameId, player, hit.index + 1, hit.isShip, cellSalt, siblings)).toBe(false);
    const badSalt = cellSalt.slice();
    badSalt[0] ^= 1;
    expect(await verify(root, gameId, player, hit.index, hit.isShip, badSalt, siblings)).toBe(false);
    const badSiblings = siblings.map((s) => s.slice());
    badSiblings[0][0] ^= 1;
    expect(await verify(root, gameId, player, hit.index, hit.isShip, cellSalt, badSiblings)).toBe(false);
    expect(await verify(root, gameId, player, 64, hit.isShip, cellSalt, siblings)).toBe(false);
    expect(await verify(root, gameId, player, hit.index, hit.isShip, cellSalt, siblings.slice(1))).toBe(false);
  });

  it("rejects illegal fleets", () => {
    expect(() => occupancy([{ x: 6, y: 0, vertical: false }, ...vector.ships.slice(1)])).toThrow("out of bounds");
    expect(() => occupancy([{ x: 0, y: 0, vertical: false }, { x: 0, y: 0, vertical: true }, ...vector.ships.slice(2)])).toThrow("overlap");
  });
});
