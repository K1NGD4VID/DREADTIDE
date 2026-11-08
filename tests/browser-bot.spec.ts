import { describe, expect, it } from "vitest";
import { chooseBotTarget } from "../app/lib/game/browser-bot";

describe("browser bot targeting", () => {
  it("chooses an untried parity cell during hunt mode", () => {
    const target = chooseBotTarget(0n);
    expect(((target % 8) + Math.floor(target / 8)) % 2).toBe(0);
  });

  it("never repeats an attacked cell", () => {
    const onlyCellLeft = 63;
    const attacked = ((1n << 64n) - 1n) ^ (1n << BigInt(onlyCellLeft));
    expect(chooseBotTarget(attacked)).toBe(onlyCellLeft);
  });
});
