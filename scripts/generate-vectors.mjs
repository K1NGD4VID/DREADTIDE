import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const hash = (...parts) => createHash("sha256").update(Buffer.concat(parts)).digest();
const hex = (bytes) => bytes.toString("hex");
const seed = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
const player = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 32));
const gameId = 42n;
const gameBytes = Buffer.alloc(8);
gameBytes.writeBigUInt64LE(gameId);
const ships = [
  { x: 0, y: 0, vertical: false },
  { x: 2, y: 2, vertical: true },
  { x: 4, y: 4, vertical: false },
  { x: 7, y: 6, vertical: true },
];
const board = Array(64).fill(false);
ships.forEach((ship, s) => {
  for (let step = 0; step < [4, 3, 3, 2][s]; step++) {
    const x = ship.x + (ship.vertical ? 0 : step);
    const y = ship.y + (ship.vertical ? step : 0);
    board[y * 8 + x] = true;
  }
});
const salts = board.map((_, i) => hash(Buffer.from("DT-SALT"), seed, Buffer.from([i])));
const leaves = board.map((isShip, i) => hash(Buffer.from([0]), gameBytes, player, Buffer.from([i, Number(isShip)]), salts[i]));
const levels = [leaves];
while (levels.at(-1).length > 1) {
  const previous = levels.at(-1);
  levels.push(Array.from({ length: previous.length / 2 }, (_, i) => hash(Buffer.from([1]), previous[2 * i], previous[2 * i + 1])));
}
const cases = [18, 15].map((index) => {
  let position = index;
  const siblings = levels.slice(0, 6).map((level) => {
    const sibling = hex(level[position ^ 1]);
    position >>= 1;
    return sibling;
  });
  return { index, isShip: board[index], salt: hex(salts[index]), leaf: hex(leaves[index]), siblings };
});
const vector = {
  scheme: "DREADTIDE-SHA256-MERKLE-v1",
  gameId: gameId.toString(),
  player: hex(player),
  seed: hex(seed),
  ships,
  root: hex(levels.at(-1)[0]),
  cases,
};
writeFileSync(new URL("../fixtures/merkle-vectors.json", import.meta.url), JSON.stringify(vector, null, 2) + "\n");
