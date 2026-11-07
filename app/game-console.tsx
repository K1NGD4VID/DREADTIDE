"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnchorProvider, BN, Program } from "@anchor-lang/core";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "./idl/dreadtide.json";
import type { Dreadtide } from "./idl/dreadtide";
import { occupancy, tree } from "./lib/crypto/merkle";

const PROGRAM_ID = new PublicKey(idl.address);
const EMPTY_KEY = new PublicKey(new Uint8Array(32));
const fleet = [
  { x: 0, y: 0, vertical: false },
  { x: 2, y: 2, vertical: true },
  { x: 4, y: 4, vertical: false },
  { x: 7, y: 6, vertical: true },
] as const;

function bytesFromSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return seed;
}

function short(value: string): string { return `${value.slice(0, 6)}...${value.slice(-6)}`; }

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes("SelfJoin")) return "You created this match. Share its address with a different wallet to join.";
  return error.message;
}

export function GameConsole() {
  const { connection } = useConnection();
  const { connected, publicKey, signAllTransactions, signTransaction } = useWallet();
  const [gameId, setGameId] = useState(() => String(Date.now()));
  const [activeGameAddress, setActiveGameAddress] = useState("");
  const [joinAddress, setJoinAddress] = useState("");
  const [role, setRole] = useState("Not assigned");
  const [phase, setPhase] = useState("LOBBY");
  const [players, setPlayers] = useState("Waiting for opponent");
  const [committed, setCommitted] = useState("0 / 2");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Connect a wallet to create or join a match.");

  const wallet = useMemo<any>(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    return { publicKey, signTransaction, signAllTransactions };
  }, [publicKey, signAllTransactions, signTransaction]);

  const program = useMemo(() => {
    if (!wallet) return null;
    return new Program<Dreadtide>(idl as Dreadtide, new AnchorProvider(connection, wallet, { commitment: "confirmed" }));
  }, [connection, wallet]);

  const refresh = useCallback(async (address = activeGameAddress) => {
    if (!program || !address) return;
    try {
      const state = await program.account.game.fetch(new PublicKey(address)) as any;
      const nextPhase = Object.keys(state.phase ?? {})[0] ?? "lobby";
      setPhase(nextPhase.replace(/([A-Z])/g, " $1").toUpperCase());
      setCommitted(`${state.committed.filter(Boolean).length} / 2`);
      setPlayers(state.opponent?.toBase58?.() && state.opponent.toBase58() !== EMPTY_KEY.toBase58() ? "Opponent joined" : "Waiting for opponent");
      setGameId(state.gameId.toString());
      setMessage("Live state synced from Devnet.");
    } catch {
      setMessage("Could not read that game account. Check the address and Devnet network.");
    }
  }, [activeGameAddress, program]);

  useEffect(() => { if (connected && activeGameAddress) void refresh(); }, [connected, activeGameAddress, refresh]);

  async function createGame() {
    if (!program || !publicKey) return;
    setBusy(true); setMessage("Awaiting wallet approval...");
    try {
      const id = BigInt(gameId);
      const idBytes = Buffer.alloc(8); idBytes.writeBigUInt64LE(id);
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from("game"), publicKey.toBuffer(), idBytes], PROGRAM_ID);
      await program.methods.createGame(new BN(id.toString())).accountsStrict({ game: pda, creator: publicKey, systemProgram: SystemProgram.programId }).rpc();
      setActiveGameAddress(pda.toBase58());
      setJoinAddress("");
      setRole("Creator");
      setPhase("LOBBY"); setPlayers("Waiting for opponent"); setMessage("Match created. Copy the address below and send it to a different wallet.");
    } catch (error) { setMessage(errorMessage(error, "Create transaction failed.")); }
    finally { setBusy(false); }
  }

  async function joinGame() {
    if (!program || !publicKey || !joinAddress) return;
    setBusy(true); setMessage("Checking the match on Devnet...");
    try {
      const address = new PublicKey(joinAddress);
      const state = await program.account.game.fetch(address) as any;
      if (state.creator.toBase58() === publicKey.toBase58()) {
        setMessage("You created this match. Copy its address and open it with a different wallet.");
        return;
      }
      if (state.opponent.toBase58() !== EMPTY_KEY.toBase58()) {
        setMessage("This match already has two captains. Create or join another match.");
        return;
      }
      setMessage("Awaiting wallet approval...");
      await program.methods.joinGame().accountsStrict({ game: address, opponent: publicKey }).rpc();
      setActiveGameAddress(address.toBase58());
      setRole("Opponent");
      await refresh(address.toBase58());
      setMessage("Joined. Both captains can now commit their fleet.");
    } catch (error) { setMessage(errorMessage(error, "Join transaction failed.")); }
    finally { setBusy(false); }
  }

  async function copyMatchAddress() {
    if (!activeGameAddress) return;
    await navigator.clipboard.writeText(activeGameAddress);
    setMessage("Match address copied. Send it to your opponent.");
  }

  async function commitFleet() {
    if (!program || !publicKey || !activeGameAddress) return;
    setBusy(true); setMessage("Building your private Merkle commitment...");
    try {
      const state = await program.account.game.fetch(new PublicKey(activeGameAddress)) as any;
      const stored = localStorage.getItem(`dreadtide-seed:${activeGameAddress}:${publicKey.toBase58()}`);
      const seed = stored ? Uint8Array.from(JSON.parse(stored) as number[]) : bytesFromSeed();
      localStorage.setItem(`dreadtide-seed:${activeGameAddress}:${publicKey.toBase58()}`, JSON.stringify(Array.from(seed)));
      const levels = await tree(BigInt(state.gameId.toString()), publicKey.toBytes(), seed, occupancy(fleet));
      await program.methods.commitBoard(Array.from(levels[6][0])).accountsStrict({ game: new PublicKey(activeGameAddress), player: publicKey }).rpc();
      await refresh();
      setMessage("Fleet committed. Your board remains hidden until an audit.");
    } catch (error) { setMessage(errorMessage(error, "Commit transaction failed.")); }
    finally { setBusy(false); }
  }

  return (
    <section className="game-console" aria-labelledby="game-console-title">
      <div className="console-heading">
        <div><p className="eyebrow">MATCH OPERATIONS</p><h2 id="game-console-title">Enter the war room.</h2></div>
        <span className={`live-badge ${connected ? "online" : ""}`}><i /> {connected ? "WALLET READY" : "WALLET OFFLINE"}</span>
      </div>
      {!connected ? <div className="console-empty"><h3>Your fleet is waiting.</h3><p>Connect Phantom or Solflare above to create a Devnet match, join an opponent, and commit your hidden board.</p></div> : (
        <div className="console-grid">
          <div className="console-card create-card"><span className="step">01</span><h3>Create a match</h3><p>Generate a new game account owned by your wallet.</p><label htmlFor="game-id">Game ID</label><input id="game-id" value={gameId} onChange={(event) => setGameId(event.target.value.replace(/[^0-9]/g, ""))} /><button disabled={busy || !gameId} onClick={createGame}>{busy ? "SIGNING..." : "CREATE MATCH"}</button>{role === "Creator" && activeGameAddress ? <div className="share-match"><span>YOUR MATCH ADDRESS</span><code>{activeGameAddress}</code><button className="secondary-console-action" onClick={copyMatchAddress}>COPY FOR OPPONENT</button></div> : null}</div>
          <div className="console-card join-card"><span className="step">02</span><h3>Join a match</h3><p>Use an address from another captain. Your own match cannot be joined by the same wallet.</p><label htmlFor="join-address">Opponent's game account</label><input id="join-address" value={joinAddress} onChange={(event) => setJoinAddress(event.target.value.trim())} placeholder="Paste a match address" /><button disabled={busy || !joinAddress} onClick={joinGame}>JOIN OPPONENT MATCH</button></div>
          <div className="console-card status-card"><span className="step">03</span><h3>Fleet status</h3><div className="status-lines"><span>GAME <b>{activeGameAddress ? short(activeGameAddress) : "NOT SET"}</b></span><span>ROLE <b>{role.toUpperCase()}</b></span><span>PHASE <b>{phase}</b></span><span>PLAYERS <b>{players}</b></span><span>COMMITMENTS <b>{committed}</b></span></div><button className="commit-button" disabled={busy || !activeGameAddress || phase !== "COMMIT"} onClick={commitFleet}>COMMIT HIDDEN FLEET</button></div>
        </div>
      )}
      <p className="console-message" role="status">{message}</p>
    </section>
  );
}
