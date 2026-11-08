import { describe, expect, it } from "vitest";
import { bitmapCount, bitmapHas, coordinate } from "../app/lib/game/battle";

describe("battle state helpers", () => {
  it("maps the 8 by 8 board to canonical coordinates", () => {
    expect(coordinate(0)).toBe("A1");
    expect(coordinate(18)).toBe("C3");
    expect(coordinate(63)).toBe("H8");
  });

  it("reads Solana u64 shot bitmaps without losing high bits", () => {
    const bitmap = (1n << 0n) | (1n << 18n) | (1n << 63n);
    expect(bitmapHas(bitmap, 0)).toBe(true);
    expect(bitmapHas(bitmap, 18)).toBe(true);
    expect(bitmapHas(bitmap, 63)).toBe(true);
    expect(bitmapHas(bitmap, 62)).toBe(false);
    expect(bitmapCount(bitmap)).toBe(3);
  });
});
