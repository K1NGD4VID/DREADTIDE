import { FLEET_LENGTHS, occupancy, type Ship } from "../crypto/merkle";

export const SHIP_NAMES = ["Battleship", "Frigate", "Destroyer", "Patrol boat"] as const;
export type FleetPlacement = Ship & { placed: boolean };

export function emptyFleet(): FleetPlacement[] {
  return FLEET_LENGTHS.map(() => ({ x: 0, y: 0, vertical: false, placed: false }));
}

export function shipCells(ship: Pick<FleetPlacement, "x" | "y" | "vertical">, shipIndex: number): number[] {
  return Array.from({ length: FLEET_LENGTHS[shipIndex] }, (_, step) => {
    const x = ship.x + (ship.vertical ? 0 : step);
    const y = ship.y + (ship.vertical ? step : 0);
    return y * 8 + x;
  });
}

export function validateFleet(fleet: readonly FleetPlacement[]): { valid: boolean; message: string } {
  if (fleet.length !== 4 || fleet.some((ship) => !ship.placed)) return { valid: false, message: "Place all four ships before committing." };
  try {
    const board = occupancy(fleet);
    if (board.filter(Boolean).length !== 12) return { valid: false, message: "The fleet must occupy exactly 12 cells." };
    return { valid: true, message: "Fleet ready: 4 ships, 12 protected cells." };
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : "Invalid fleet placement." };
  }
}

export function canPlace(fleet: readonly FleetPlacement[], shipIndex: number, candidate: FleetPlacement): boolean {
  const next = fleet.map((ship, index) => index === shipIndex ? candidate : ship);
  const occupied = new Set<number>();
  for (let index = 0; index < next.length; index += 1) {
    const ship = next[index];
    if (!ship.placed) continue;
    for (let step = 0; step < FLEET_LENGTHS[index]; step += 1) {
      const x = ship.x + (ship.vertical ? 0 : step);
      const y = ship.y + (ship.vertical ? step : 0);
      const cell = y * 8 + x;
      if (x < 0 || x > 7 || y < 0 || y > 7 || occupied.has(cell)) return false;
      occupied.add(cell);
    }
  }
  return true;
}

export function randomFleet(random: () => number = Math.random): FleetPlacement[] {
  const fleet = emptyFleet();
  for (let shipIndex = 0; shipIndex < fleet.length; shipIndex += 1) {
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt += 1) {
      const candidate: FleetPlacement = {
        x: Math.floor(random() * 8),
        y: Math.floor(random() * 8),
        vertical: random() >= 0.5,
        placed: true,
      };
      if (canPlace(fleet, shipIndex, candidate)) {
        fleet[shipIndex] = candidate;
        placed = true;
      }
    }
    if (!placed) return randomFleet(random);
  }
  return fleet;
}

