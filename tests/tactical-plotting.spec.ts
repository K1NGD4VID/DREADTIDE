import { describe, expect, it } from "vitest";
import { adjacentUnexplored, tacticalHeat } from "../app/lib/game/tactical";

describe("private tactical plotting", () => {
  it("suggests only orthogonal unexplored neighbors", () => {
    expect([...adjacentUnexplored(new Set([27]), new Set([19]))].sort((a, b) => a - b)).toEqual([26, 28, 35]);
  });

  it("never scores a verified miss and favors continuations around hits", () => {
    const heat = tacticalHeat(new Set([27, 35]), new Set([19]));
    expect(heat[19]).toBe(0);
    expect(heat[43]).toBeGreaterThan(heat[0]);
    expect(Math.max(...heat)).toBe(1);
  });
});
