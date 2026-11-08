import { describe, expect, it } from "vitest";
import { canPlace, emptyFleet, randomFleet, shipCells, validateFleet, type FleetPlacement } from "../app/lib/game/fleet";

describe("fleet placement", () => {
  it("creates randomized legal fleets with the canonical 12 occupied cells", () => {
    for (let index = 0; index < 25; index += 1) {
      const fleet = randomFleet();
      expect(validateFleet(fleet)).toEqual({ valid: true, message: "Fleet ready: 4 ships, 12 protected cells." });
      expect(new Set(fleet.flatMap(shipCells)).size).toBe(12);
    }
  });

  it("rejects overlaps and out-of-bounds placements", () => {
    const fleet = emptyFleet();
    fleet[0] = { x: 0, y: 0, vertical: false, placed: true };
    expect(canPlace(fleet, 1, { x: 2, y: 0, vertical: true, placed: true })).toBe(false);
    expect(canPlace(fleet, 1, { x: 7, y: 6, vertical: true, placed: true })).toBe(false);
  });

  it("keeps the canonical ship order used by the on-chain audit", () => {
    const fleet: FleetPlacement[] = [
      { x: 0, y: 0, vertical: false, placed: true },
      { x: 0, y: 2, vertical: false, placed: true },
      { x: 4, y: 2, vertical: true, placed: true },
      { x: 6, y: 6, vertical: false, placed: true },
    ];
    expect(fleet.map((ship, index) => shipCells(ship, index).length)).toEqual([4, 3, 3, 2]);
    expect(validateFleet(fleet).valid).toBe(true);
  });
});
