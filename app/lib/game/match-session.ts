import { Keypair } from "@solana/web3.js";

export type MatchSessionRecord = {
  schemaVersion: 1;
  matchAddress: string;
  playerAddress: string;
  keypair: number[];
  expiresAt: number;
};

export function sessionStorageKey(match: string, player: string): string {
  return `dreadtide-session:v1:${match}:${player}`;
}

export function createSessionRecord(matchAddress: string, playerAddress: string, expiresAt: number): MatchSessionRecord {
  const delegate = Keypair.generate();
  return { schemaVersion: 1, matchAddress, playerAddress, keypair: Array.from(delegate.secretKey), expiresAt };
}

export function restoreSession(record: MatchSessionRecord): Keypair {
  if (record.schemaVersion !== 1 || record.keypair.length !== 64) throw new Error("Invalid local session key.");
  return Keypair.fromSecretKey(Uint8Array.from(record.keypair));
}

export function readSession(matchAddress: string, playerAddress: string): MatchSessionRecord | null {
  const value = localStorage.getItem(sessionStorageKey(matchAddress, playerAddress));
  if (!value) return null;
  try {
    const record = JSON.parse(value) as MatchSessionRecord;
    if (record.matchAddress !== matchAddress || record.playerAddress !== playerAddress || record.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    restoreSession(record);
    return record;
  } catch {
    return null;
  }
}
