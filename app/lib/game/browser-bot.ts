import { AnchorProvider, Program } from "@anchor-lang/core";
import { Keypair, Transaction, VersionedTransaction, type Connection } from "@solana/web3.js";
import idl from "../../idl/dreadtide.json";
import type { Dreadtide } from "../../idl/dreadtide";
import { occupancy, tree } from "../crypto/merkle";
import { randomFleet, type FleetPlacement } from "./fleet";

export type BotRecord = {
  schemaVersion: 1;
  matchAddress: string;
  keypair: number[];
  seed: number[];
  placements: Array<{ x: number; y: number; vertical: boolean }>;
  root: number[];
};

export function botStorageKey(match: string): string { return `dreadtide-bot:v1:${match}`; }

export function botProgram(connection: Connection, bot: Keypair): Program<Dreadtide> {
  const wallet = {
    publicKey: bot.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> { transaction instanceof Transaction ? transaction.partialSign(bot) : transaction.sign([bot]); return transaction; },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> { for (const transaction of transactions) transaction instanceof Transaction ? transaction.partialSign(bot) : transaction.sign([bot]); return transactions; },
  };
  return new Program<Dreadtide>(idl as Dreadtide, new AnchorProvider(connection, wallet, { commitment: "confirmed" }));
}

export async function createBotRecord(matchAddress: string, gameId: bigint): Promise<BotRecord> {
  const bot = Keypair.generate();
  const seed = crypto.getRandomValues(new Uint8Array(32));
  const fleet = randomFleet();
  const levels = await tree(gameId, bot.publicKey.toBytes(), seed, occupancy(fleet));
  return { schemaVersion: 1, matchAddress, keypair: Array.from(bot.secretKey), seed: Array.from(seed), placements: fleet.map(({ x, y, vertical }) => ({ x, y, vertical })), root: Array.from(levels[6][0]) };
}

export function restoreBot(record: BotRecord): { keypair: Keypair; fleet: FleetPlacement[] } {
  return { keypair: Keypair.fromSecretKey(Uint8Array.from(record.keypair)), fleet: record.placements.map((ship) => ({ ...ship, placed: true })) };
}

export function chooseBotTarget(shots: bigint): number {
  const available = Array.from({ length: 64 }, (_, index) => index).filter((index) => (shots & (1n << BigInt(index))) === 0n);
  const hunt = available.filter((index) => ((index % 8) + Math.floor(index / 8)) % 2 === 0);
  const pool = hunt.length ? hunt : available;
  if (!pool.length) throw new Error("Bot has no legal targets remaining.");
  return pool[Math.floor(Math.random() * pool.length)];
}
