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

function uniqueGameId(): bigint {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return BigInt(Date.now()) * 1_000_000n + BigInt(random[0] % 1_000_000);
}

function phaseName(phase: Record<string, unknown> | undefined): string {
  return Object.keys(phase ?? {})[0] ?? "lobby";
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "EXPIRED";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const value = error.message;
  if (value.includes("SelfJoin")) return "You created this match. Share its address with a different wallet to join.";
  if (value.includes("DeadlinePassed")) return "This action window expired. Create a fresh match and share it with your opponent.";
  if (value.includes("WrongPhase")) return "That action is not available in the match's current phase. Refresh the match state.";
  if (value.includes("NotPlayer")) return "This wallet is not one of the two captains in this match.";
  if (value.includes("WrongPlayer")) return "It is the other captain's turn to take this action.";
  if (value.includes("AlreadyCommitted")) return "This wallet has already committed its fleet.";
  if (value.includes("AccountAlreadyInUse") || value.includes("already in use")) return "That match identifier was already used. Press Create Match again for a fresh one.";
  if (value.toLowerCase().includes("insufficient") || value.toLowerCase().includes("0x1")) return "This wallet needs Devnet SOL to pay the transaction fee.";
  if (value.toLowerCase().includes("reject") || value.toLowerCase().includes("cancel")) return "The wallet request was cancelled. No transaction was sent.";
  if (value.toLowerCase().includes("failed to fetch") || value.toLowerCase().includes("network")) return "Devnet could not be reached. Check your connection and try again.";
  return error.message;
}

export function GameConsole() {
  const { connection } = useConnection();
  const { connected, publicKey, signAllTransactions, signTransaction } = useWallet();
  const [gameId, setGameId] = useState("Generated on create");
  const [activeGameAddress, setActiveGameAddress] = useState("");
  const [joinAddress, setJoinAddress] = useState("");
  const [role, setRole] = useState("Not assigned");
  const [phase, setPhase] = useState("LOBBY");
  const [players, setPlayers] = useState("Waiting for opponent");
  const [committed, setCommitted] = useState("0 / 2");
  const [deadline, setDeadline] = useState(0);
  const [clockNow, setClockNow] = useState(() => Math.floor(Date.now() / 1000));
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
      const nextPhase = phaseName(state.phase);
      setPhase(nextPhase.replace(/([A-Z])/g, " $1").toUpperCase());
      setCommitted(`${state.committed.filter(Boolean).length} / 2`);
      setPlayers(state.opponent?.toBase58?.() && state.opponent.toBase58() !== EMPTY_KEY.toBase58() ? "Opponent joined" : "Waiting for opponent");
      setGameId(state.gameId.toString());
      setDeadline(Number(state.deadline.toString()));
      if (publicKey?.equals(state.creator)) setRole("Creator");
      else if (publicKey?.equals(state.opponent)) setRole("Opponent");
      else setRole("Spectator");
      setMessage("Live state synced from Devnet.");
    } catch {
      setMessage("Could not read that game account. Check the address and Devnet network.");
    }
  }, [activeGameAddress, program, publicKey]);

  useEffect(() => { if (connected && activeGameAddress) void refresh(); }, [connected, activeGameAddress, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function createGame() {
    if (!program || !publicKey) return;
    setBusy(true); setMessage("Preparing a unique Devnet match...");
    try {
      let id = 0n;
      let pda: PublicKey | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        id = uniqueGameId();
        const idBytes = Buffer.alloc(8); idBytes.writeBigUInt64LE(id);
        const [candidate] = PublicKey.findProgramAddressSync([Buffer.from("game"), publicKey.toBuffer(), idBytes], PROGRAM_ID);
        if (!(await connection.getAccountInfo(candidate, "confirmed"))) {
          pda = candidate;
          break;
        }
      }
      if (!pda) throw new Error("Could not reserve a unique match identifier. Please try again.");
      setGameId(id.toString());
      setMessage("Awaiting wallet approval...");
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
      const nextPhase = phaseName(state.phase);
      const expiresAt = Number(state.deadline.toString());
      if (state.creator.toBase58() === publicKey.toBase58()) {
        setMessage("You created this match. Copy its address and open it with a different wallet.");
        return;
      }
      if (state.opponent.toBase58() !== EMPTY_KEY.toBase58()) {
        setMessage("This match already has two captains. Create or join another match.");
        return;
      }
      if (nextPhase !== "lobby") {
        setMessage("This match is no longer accepting an opponent.");
        return;
      }
      if (Math.floor(Date.now() / 1000) > expiresAt) {
        setMessage("This match invitation expired. Ask the creator to make a fresh match.");
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
          <div className="console-card create-card"><span className="step">01</span><h3>Create a match</h3><p>Generate a fresh game account with a 15 minute invitation window.</p><label htmlFor="game-id">Game ID</label><input id="game-id" value={gameId} readOnly /><button disabled={busy} onClick={createGame}>{busy ? "PREPARING..." : "CREATE FRESH MATCH"}</button>{role === "Creator" && activeGameAddress ? <div className="share-match"><span>YOUR MATCH ADDRESS</span><code>{activeGameAddress}</code><button className="secondary-console-action" onClick={copyMatchAddress}>COPY FOR OPPONENT</button></div> : null}</div>
          <div className="console-card join-card"><span className="step">02</span><h3>Join a match</h3><p>Use an address from another captain. Your own match cannot be joined by the same wallet.</p><label htmlFor="join-address">Opponent's game account</label><input id="join-address" value={joinAddress} onChange={(event) => setJoinAddress(event.target.value.trim())} placeholder="Paste a match address" /><button disabled={busy || !joinAddress} onClick={joinGame}>JOIN OPPONENT MATCH</button></div>
          <div className="console-card status-card"><span className="step">03</span><h3>Fleet status</h3><div className="status-lines"><span>GAME <b>{activeGameAddress ? short(activeGameAddress) : "NOT SET"}</b></span><span>ROLE <b>{role.toUpperCase()}</b></span><span>PHASE <b>{phase}</b></span><span>ACTION WINDOW <b className={deadline > 0 && deadline <= clockNow ? "expired" : ""}>{deadline ? formatRemaining(deadline - clockNow) : "NOT STARTED"}</b></span><span>PLAYERS <b>{players}</b></span><span>COMMITMENTS <b>{committed}</b></span></div><button className="commit-button" disabled={busy || !activeGameAddress || phase !== "COMMIT" || deadline <= clockNow} onClick={commitFleet}>COMMIT HIDDEN FLEET</button></div>
        </div>
      )}
      <p className="console-message" role="status">{message}</p>
    </section>
  );
}
