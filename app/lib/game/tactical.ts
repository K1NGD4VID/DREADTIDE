export type TacticalMarker = "suspected" | "empty" | "priority" | "direction" | "investigate";

export const TACTICAL_MARKERS: Array<TacticalMarker | null> = [null, "suspected", "empty", "priority", "direction", "investigate"];

export function adjacentUnexplored(hits: Set<number>, explored: Set<number>): Set<number> {
  const suggestions = new Set<number>();
  for (const index of hits) {
    const x = index % 8;
    const y = Math.floor(index / 8);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const next = ny * 8 + nx;
      if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && !explored.has(next)) suggestions.add(next);
    }
  }
  return suggestions;
}

export function tacticalHeat(hits: Set<number>, misses: Set<number>): number[] {
  const lengths = [4, 3, 3, 2];
  const scores = Array<number>(64).fill(0);
  for (const length of lengths) {
    for (const vertical of [false, true]) {
      const maxX = vertical ? 8 : 9 - length;
      const maxY = vertical ? 9 - length : 8;
      for (let y = 0; y < maxY; y += 1) for (let x = 0; x < maxX; x += 1) {
        const cells = Array.from({ length }, (_, offset) => (y + (vertical ? offset : 0)) * 8 + x + (vertical ? 0 : offset));
        if (cells.some((cell) => misses.has(cell))) continue;
        const evidenceWeight = 1 + cells.filter((cell) => hits.has(cell)).length * 4;
        for (const cell of cells) if (!hits.has(cell)) scores[cell] += evidenceWeight;
      }
    }
  }
  const maximum = Math.max(1, ...scores);
  return scores.map((score) => score / maximum);
}
