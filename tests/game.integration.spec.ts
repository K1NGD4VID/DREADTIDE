import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { occupancy, proof, salt, tree } from "../app/lib/crypto/merkle";
import type { Dreadtide } from "../app/idl/dreadtide";
import idl from "../app/idl/dreadtide.json";

describe("local validator match", () => {
  it("rejects a forged proof and verifies a complete match only after claimant audit", async () => {
    const rpcUrl = process.env.DREADTIDE_RPC_URL ?? "http://127.0.0.1:8899";
    const signerPath = process.env.DREADTIDE_FEE_PAYER_KEYPAIR;
    const connection = new Connection(rpcUrl, "confirmed");
    const creator = signerPath
      ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(signerPath, "utf8")) as number[]))
      : Keypair.generate();
    const opponent = Keypair.generate();
    const provider = new AnchorProvider(connection, new Wallet(creator), { commitment: "confirmed" });
    const program = new Program<Dreadtide>(idl as Dreadtide, provider);
    const programId = new PublicKey(idl.address);
    if (rpcUrl !== "http://127.0.0.1:8899" && !signerPath) {
      throw new Error("DREADTIDE_FEE_PAYER_KEYPAIR is required for a remote match");
    }
    const gameId = signerPath ? BigInt(Date.now()) : 42n;
    const gameIdBytes = Buffer.alloc(8);
    gameIdBytes.writeBigUInt64LE(gameId);
    const [gamePda] = PublicKey.findProgramAddressSync([Buffer.from("game"), creator.publicKey.toBuffer(), gameIdBytes], programId);
    const [creatorProfile] = PublicKey.findProgramAddressSync([Buffer.from("profile"), creator.publicKey.toBuffer()], programId);
    const [opponentProfile] = PublicKey.findProgramAddressSync([Buffer.from("profile"), opponent.publicKey.toBuffer()], programId);
    const [stakePda] = PublicKey.findProgramAddressSync([Buffer.from("stake"), gamePda.toBuffer()], programId);
    if (!signerPath) {
      const airdrop = await connection.requestAirdrop(creator.publicKey, 2_000_000_000);
      await connection.confirmTransaction(airdrop, "confirmed");
    }
    console.info(`Game account: ${gamePda.toBase58()}`);

    if (!(await connection.getAccountInfo(creatorProfile, "confirmed"))) {
      await program.methods.createProfile().accountsStrict({ profile: creatorProfile, player: creator.publicKey, systemProgram: SystemProgram.programId }).rpc();
    }
    const funding = await provider.sendAndConfirm(new Transaction().add(SystemProgram.transfer({ fromPubkey: creator.publicKey, toPubkey: opponent.publicKey, lamports: Math.round(.01 * LAMPORTS_PER_SOL) })));
    expect(funding).toBeTruthy();
    await program.methods.createProfile().accountsStrict({ profile: opponentProfile, player: opponent.publicKey, systemProgram: SystemProgram.programId }).signers([opponent]).rpc();

    const ships = [
      { x: 0, y: 0, vertical: false },
      { x: 2, y: 2, vertical: true },
      { x: 4, y: 4, vertical: false },
      { x: 7, y: 6, vertical: true },
    ];
    const board = occupancy(ships);
    const creatorSeed = new Uint8Array(32).fill(7);
    const opponentSeed = new Uint8Array(32).fill(8);
    const creatorTree = await tree(gameId, creator.publicKey.toBytes(), creatorSeed, board);
    const opponentTree = await tree(gameId, opponent.publicKey.toBytes(), opponentSeed, board);
    const creatorRoot = Array.from(creatorTree[6][0]);
    const opponentRoot = Array.from(opponentTree[6][0]);

    await program.methods.createGame(new BN(gameId.toString())).accountsStrict({ game: gamePda, creator: creator.publicKey, systemProgram: SystemProgram.programId }).rpc();
    await program.methods.openStake(new BN(50)).accountsStrict({ game: gamePda, stake: stakePda, creatorProfile, creator: creator.publicKey, systemProgram: SystemProgram.programId }).rpc();
    const created = await program.account.game.fetch(gamePda);
    const chainTime = await connection.getBlockTime(await connection.getSlot("confirmed"));
    expect(Number(created.deadline.toString()) - (chainTime ?? Math.floor(Date.now() / 1000))).toBeGreaterThanOrEqual(880);
    expect(Number(created.deadline.toString()) - (chainTime ?? Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(920);
    await program.methods.joinGame().accountsStrict({ game: gamePda, opponent: opponent.publicKey }).signers([opponent]).rpc();
    await program.methods.acceptStake().accountsStrict({ game: gamePda, stake: stakePda, opponentProfile, opponent: opponent.publicKey }).signers([opponent]).rpc();
    await program.methods.commitBoard(creatorRoot).accountsStrict({ game: gamePda, player: creator.publicKey }).rpc();
    await program.methods.commitBoard(opponentRoot).accountsStrict({ game: gamePda, player: opponent.publicKey }).signers([opponent]).rpc();

    await program.methods.fire(18).accountsStrict({ game: gamePda, player: creator.publicKey }).rpc();
    await expect(program.methods.fire(19).accountsStrict({ game: gamePda, player: creator.publicKey }).rpc()).rejects.toThrow();
    const cellSalt = Array.from(await salt(opponentSeed, 18));
    const siblings = proof(opponentTree, 18).map((item) => Array.from(item));
    const wrongSalt = [...cellSalt];
    wrongSalt[0] ^= 1;
    await expect(program.methods.respond(true, wrongSalt, siblings).accountsStrict({ game: gamePda, player: opponent.publicKey }).signers([opponent]).rpc()).rejects.toThrow();
    await program.methods.respond(true, cellSalt, siblings).accountsStrict({ game: gamePda, player: opponent.publicKey }).signers([opponent]).rpc();

    const state = await program.account.game.fetch(gamePda);
    expect(state.hits[1]).toBe(1);
    expect(state.shots[1].toString()).toBe((1n << 18n).toString());
    expect(state.phase).toEqual({ fire: {} });
    expect(state.turn).toBe(1);
    await expect(program.methods.fire(18).accountsStrict({ game: gamePda, player: creator.publicKey }).rpc()).rejects.toThrow();

    const remainingHits = board.flatMap((occupied, index) => occupied && index !== 18 ? [index] : []);
    const misses = board.flatMap((occupied, index) => !occupied ? [index] : []).slice(0, remainingHits.length);
    for (let round = 0; round < remainingHits.length; round++) {
      const miss = misses[round];
      await program.methods.fire(miss).accountsStrict({ game: gamePda, player: opponent.publicKey }).signers([opponent]).rpc();
      await program.methods.respond(false, Array.from(await salt(creatorSeed, miss)), proof(creatorTree, miss).map((item) => Array.from(item)))
        .accountsStrict({ game: gamePda, player: creator.publicKey }).rpc();
      const hit = remainingHits[round];
      await program.methods.fire(hit).accountsStrict({ game: gamePda, player: creator.publicKey }).rpc();
      await program.methods.respond(true, Array.from(await salt(opponentSeed, hit)), proof(opponentTree, hit).map((item) => Array.from(item)))
        .accountsStrict({ game: gamePda, player: opponent.publicKey }).signers([opponent]).rpc();
    }
    const provisional = await program.account.game.fetch(gamePda);
    expect(provisional.hits[1]).toBe(12);
    expect(provisional.phase).toEqual({ audit: {} });
    expect(provisional.claimant).toBe(0);
    expect(provisional.auditedWinner).toBe(255);

    const auditSignature = await program.methods.auditBoard(Array.from(creatorSeed), ships)
      .accountsStrict({ game: gamePda, player: creator.publicKey })
      .rpc();
    let auditTransaction = await connection.getTransaction(auditSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    for (let attempt = 0; !auditTransaction && attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      auditTransaction = await connection.getTransaction(auditSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    }
    expect(auditTransaction?.meta?.err).toBeNull();
    expect(auditTransaction?.meta?.computeUnitsConsumed).toBeGreaterThan(0);
    expect(auditTransaction?.meta?.computeUnitsConsumed).toBeLessThanOrEqual(200_000);
    console.info(`Claimant audit consumed ${auditTransaction?.meta?.computeUnitsConsumed} CU`);
    const finished = await program.account.game.fetch(gamePda);
    expect(finished.phase).toEqual({ verifiedFinished: {} });
    expect(finished.auditedWinner).toBe(0);
    await program.methods.settleStake().accountsStrict({ game: gamePda, stake: stakePda, creatorProfile, opponentProfile, caller: creator.publicKey }).rpc();
    const creatorEconomy = await program.account.playerProfile.fetch(creatorProfile);
    const opponentEconomy = await program.account.playerProfile.fetch(opponentProfile);
    const settledStake = await program.account.matchStake.fetch(stakePda);
    expect(settledStake.settled).toBe(true);
    expect(Number(creatorEconomy.balance.toString())).toBeGreaterThanOrEqual(150);
    expect(Number(opponentEconomy.balance.toString())).toBe(50);
    console.info(`Verified match transaction: ${auditSignature}`);
  }, process.env.DREADTIDE_FEE_PAYER_KEYPAIR ? 900_000 : 300_000);
});
