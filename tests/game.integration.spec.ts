import { describe, expect, it } from "vitest";
import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { occupancy, proof, salt, tree } from "../app/lib/crypto/merkle";
import type { Dreadtide } from "../app/idl/dreadtide";
import idl from "../app/idl/dreadtide.json";

describe("local validator match", () => {
  it("rejects a forged proof and verifies a complete match only after claimant audit", async () => {
    const connection = new Connection("http://127.0.0.1:8899", "confirmed");
    const creator = Keypair.generate();
    const opponent = Keypair.generate();
    const provider = new AnchorProvider(connection, new Wallet(creator), { commitment: "confirmed" });
    const program = new Program<Dreadtide>(idl as Dreadtide, provider);
    const programId = new PublicKey(idl.address);
    const gameId = 42n;
    const gameIdBytes = Buffer.alloc(8);
    gameIdBytes.writeBigUInt64LE(gameId);
    const [gamePda] = PublicKey.findProgramAddressSync([Buffer.from("game"), creator.publicKey.toBuffer(), gameIdBytes], programId);
    const airdrop = await connection.requestAirdrop(creator.publicKey, 2_000_000_000);
    await connection.confirmTransaction(airdrop, "confirmed");

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
    await program.methods.joinGame().accountsStrict({ game: gamePda, opponent: opponent.publicKey }).signers([opponent]).rpc();
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
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
      .rpc();
    const auditTransaction = await connection.getTransaction(auditSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    expect(auditTransaction?.meta?.err).toBeNull();
    expect(auditTransaction?.meta?.computeUnitsConsumed).toBeGreaterThan(200_000);
    expect(auditTransaction?.meta?.computeUnitsConsumed).toBeLessThanOrEqual(1_400_000);
    console.info(`Claimant audit consumed ${auditTransaction?.meta?.computeUnitsConsumed} CU`);
    const finished = await program.account.game.fetch(gamePda);
    expect(finished.phase).toEqual({ verifiedFinished: {} });
    expect(finished.auditedWinner).toBe(0);
  }, 300_000);
});
