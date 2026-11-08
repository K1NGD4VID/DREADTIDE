export type ShotOutcome = {
  signature: string;
  slot: number;
  attacker: string;
  defender: string;
  index: number;
  isShip: boolean;
};

export function coordinate(index: number): string {
  return `${String.fromCharCode(65 + index % 8)}${Math.floor(index / 8) + 1}`;
}

export function bitmapHas(bitmap: bigint, index: number): boolean {
  return (bitmap & (1n << BigInt(index))) !== 0n;
}

export function bitmapCount(bitmap: bigint): number {
  let value = bitmap;
  let count = 0;
  while (value) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

