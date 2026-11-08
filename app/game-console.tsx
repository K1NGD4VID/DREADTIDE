"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnchorProvider, BN, EventParser, Program } from "@anchor-lang/core";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import idl from "./idl/dreadtide.json";
import type { Dreadtide } from "./idl/dreadtide";
import { occupancy, proof, salt, tree } from "./lib/crypto/merkle";
import { FleetDeployment } from "./fleet-deployment";
import { emptyFleet, validateFleet, type FleetPlacement } from "./lib/game/fleet";
import { botProgram, botStorageKey, chooseBotTarget, createBotRecord, restoreBot, type BotRecord } from "./lib/game/browser-bot";
import { BattleArena, type BattleState } from "./battle-arena";
import type { ShotOutcome } from "./lib/game/battle";

const PROGRAM_ID = new PublicKey(idl.address);
const EMPTY_KEY = new PublicKey(new Uint8Array(32));
type FleetSecret = {
  schemaVersion: 1;
  matchAddress: string;
  playerAddress: string;
  gameId: string;
  placements: Array<{ x: number; y: number; vertical: boolean }>;
  seed: number[];
  root: number[];
};

function bytesFromSeed(): Uint8Array {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return seed;
}

function short(value: string): string { return `${value.slice(0, 6)}...${value.slice(-6)}`; }
function secretKey(match: string, player: string): string { return `dreadtide-fleet:v1:${match}:${player}`; }

function parseSecret(value: string): FleetSecret {
  const parsed = JSON.parse(value) as Partial<FleetSecret>;
  if (parsed.schemaVersion !== 1 || typeof parsed.matchAddress !== "string" || typeof parsed.playerAddress !== "string" || typeof parsed.gameId !== "string" || !Array.isArray(parsed.placements) || !Array.isArray(parsed.seed) || !Array.isArray(parsed.root)) throw new Error("This is not a DREADTIDE recovery file.");
  if (parsed.placements.length !== 4 || parsed.seed.length !== 32 || parsed.root.length !== 32 || parsed.seed.some((value) => !Number.isInteger(value) || value < 0 || value > 255) || parsed.root.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error("The recovery file has invalid fleet data.");
  const placements = parsed.placements.map((ship) => ({ x: Number(ship.x), y: Number(ship.y), vertical: Boolean(ship.vertical), placed: true }));
  if (!validateFleet(placements).valid) throw new Error("The recovery file contains an invalid fleet.");
  return parsed as FleetSecret;
}

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
  if (value.includes("DuplicateShot")) return "That coordinate was already attacked. Choose an untried cell.";
  if (value.includes("InvalidProof")) return "The fleet proof did not match the committed root. Restore the original recovery file.";
  if (value.includes("DeadlineNotPassed")) return "The action window is still open. Timeout resolution becomes available after the countdown expires.";
  if (value.includes("NoEligibleClaimant")) return "Neither player has a committed fleet eligible for this timeout result.";
  if (value.includes("AccountAlreadyInUse") || value.includes("already in use")) return "That match identifier was already used. Press Create Match again for a fresh one.";
  if (value.toLowerCase().includes("insufficient") || value.toLowerCase().includes("0x1")) return "This wallet needs Devnet SOL to pay the transaction fee.";
  if (value.toLowerCase().includes("reject") || value.toLowerCase().includes("cancel")) return "The wallet request was cancelled. No transaction was sent.";
  if (value.toLowerCase().includes("failed to fetch") || value.toLowerCase().includes("network")) return "Devnet could not be reached. Check your connection and try again.";
  return error.message;
}

export function GameConsole() {
  const { connection } = useConnection();
  const { connected, publicKey, signAllTransactions, signTransaction, sendTransaction } = useWallet();
  const [gameId, setGameId] = useState("Generated on create");
  const [activeGameAddress, setActiveGameAddress] = useState("");
  const [joinAddress, setJoinAddress] = useState("");
  const [watchAddress, setWatchAddress] = useState("");
  const [role, setRole] = useState("Not assigned");
  const [phase, setPhase] = useState("LOBBY");
  const [players, setPlayers] = useState("Waiting for opponent");
  const [committed, setCommitted] = useState("0 / 2");
  const [myCommitted, setMyCommitted] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [clockNow, setClockNow] = useState(() => Math.floor(Date.now() / 1000));
  const [busy, setBusy] = useState(false);
  const [fleet, setFleet] = useState<FleetPlacement[]>(() => emptyFleet());
  const [hasRecovery, setHasRecovery] = useState(false);
  const [message, setMessage] = useState("Connect a wallet to create or join a match.");
  const [playerIndex, setPlayerIndex] = useState(-1);
  const [battleState, setBattleState] = useState<BattleState>({ creator: "", opponent: "", turn: 0, pendingIndex: 255, pendingAttacker: 255, shots: [0n, 0n], hits: [0, 0], claimant: 255, auditedWinner: 255 });
  const [history, setHistory] = useState<ShotOutcome[]>([]);
  const botBusy = useRef(false);

  const wallet = useMemo<any>(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    return { publicKey, signTransaction, signAllTransactions };
  }, [publicKey, signAllTransactions, signTransaction]);

  const readonlyWallet = useMemo<any>(() => ({ publicKey: EMPTY_KEY, signTransaction: async () => { throw new Error("Connect a wallet to sign transactions."); }, signAllTransactions: async () => { throw new Error("Connect a wallet to sign transactions."); } }), []);
  const program = useMemo(() => new Program<Dreadtide>(idl as Dreadtide, new AnchorProvider(connection, wallet ?? readonlyWallet, { commitment: "confirmed" })), [connection, readonlyWallet, wallet]);

  const refresh = useCallback(async (address = activeGameAddress) => {
    if (!address) return;
    try {
      const state = await program.account.game.fetch(new PublicKey(address)) as any;
      const nextPhase = phaseName(state.phase);
      setPhase(nextPhase.replace(/([A-Z])/g, " $1").toUpperCase());
      setCommitted(`${state.committed.filter(Boolean).length} / 2`);
      setMyCommitted(publicKey?.equals(state.creator) ? state.committed[0] : publicKey?.equals(state.opponent) ? state.committed[1] : false);
      setPlayers(state.opponent?.toBase58?.() && state.opponent.toBase58() !== EMPTY_KEY.toBase58() ? "Opponent joined" : "Waiting for opponent");
      setGameId(state.gameId.toString());
      setDeadline(Number(state.deadline.toString()));
      const index = publicKey?.equals(state.creator) ? 0 : publicKey?.equals(state.opponent) ? 1 : -1;
      setPlayerIndex(index);
      if (index === 0) setRole("Creator");
      else if (index === 1) setRole("Opponent");
      else setRole("Spectator");
      setBattleState({ creator: state.creator.toBase58(), opponent: state.opponent.toBase58(), turn: state.turn, pendingIndex: state.pendingIndex, pendingAttacker: state.pendingAttacker, shots: [BigInt(state.shots[0].toString()), BigInt(state.shots[1].toString())], hits: [state.hits[0], state.hits[1]], claimant: state.claimant, auditedWinner: state.auditedWinner });
    } catch {
      setMessage("Could not read that game account. Check the address and Devnet network.");
    }
  }, [activeGameAddress, program, publicKey]);

  const walletAddress = publicKey?.toBase58();
  useEffect(() => {
    const previous = walletAddress ? localStorage.getItem(`dreadtide-match:${walletAddress}`) : null;
    setActiveGameAddress(previous ?? "");
    setRole("Not assigned");
    setPhase("LOBBY");
    setDeadline(0);
    setCommitted("0 / 2");
    setMyCommitted(false);
    setPlayerIndex(-1);
    setHistory([]);
  }, [walletAddress]);

  const loadShotHistory = useCallback(async (address = activeGameAddress) => {
    if (!address) return;
    try {
      const game = new PublicKey(address);
      const signatures = await connection.getSignaturesForAddress(game, { limit: 100 }, "confirmed");
      const transactions = await connection.getTransactions(signatures.map((item) => item.signature), { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      const parser = new EventParser(PROGRAM_ID, program.coder);
      const events: ShotOutcome[] = [];
      for (let index = transactions.length - 1; index >= 0; index -= 1) {
        const transaction = transactions[index];
        const logs = transaction?.meta?.logMessages;
        if (!logs) continue;
        for (const event of parser.parseLogs(logs)) {
          if (event.name !== "shotVerified") continue;
          const data = event.data as any;
          if (data.game.toBase58() !== address) continue;
          events.push({ signature: signatures[index].signature, slot: signatures[index].slot, attacker: data.attacker.toBase58(), defender: data.defender.toBase58(), index: data.index, isShip: Boolean(data.isShip ?? data.is_ship) });
        }
      }
      setHistory(events);
    } catch {
      setMessage("Battle state is live, but historical shot evidence could not be loaded yet.");
    }
  }, [activeGameAddress, connection, program]);
  useEffect(() => {
    if (!walletAddress || !activeGameAddress) {
      setFleet(emptyFleet());
      setHasRecovery(false);
      return;
    }
    const stored = localStorage.getItem(secretKey(activeGameAddress, walletAddress));
    if (!stored) {
      setFleet(emptyFleet());
      setHasRecovery(false);
      return;
    }
    try {
      const record = parseSecret(stored);
      if (record.matchAddress !== activeGameAddress || record.playerAddress !== walletAddress) throw new Error("Recovery record does not match this wallet and match.");
      setFleet(record.placements.map((ship) => ({ ...ship, placed: true })));
      setHasRecovery(true);
    } catch {
      setFleet(emptyFleet());
      setHasRecovery(false);
      setMessage("Stored fleet recovery data is invalid. Import a valid private recovery file.");
    }
  }, [activeGameAddress, walletAddress]);
  useEffect(() => {
    if (!activeGameAddress) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [activeGameAddress, refresh]);
  useEffect(() => {
    if (!activeGameAddress || !["FIRE", "RESPOND", "AUDIT", "VERIFIED FINISHED", "NO VERIFIED WINNER"].includes(phase)) return;
    void loadShotHistory();
  }, [activeGameAddress, battleState.shots, loadShotHistory, phase]);
  useEffect(() => {
    if (!activeGameAddress || botBusy.current) return;
    const stored = localStorage.getItem(botStorageKey(activeGameAddress));
    if (!stored) return;
    const runBot = async () => {
      botBusy.current = true;
      try {
        const record = JSON.parse(stored) as BotRecord;
        if (record.schemaVersion !== 1 || record.matchAddress !== activeGameAddress) throw new Error("Invalid browser bot record.");
        const { keypair: bot, fleet: botFleet } = restoreBot(record);
        const opponentProgram = botProgram(connection, bot);
        const game = new PublicKey(activeGameAddress);
        const state = await opponentProgram.account.game.fetch(game) as any;
        const currentPhase = phaseName(state.phase);
        if (!bot.publicKey.equals(state.opponent)) return;
        if (currentPhase === "commit" && !state.committed[1]) {
          await opponentProgram.methods.commitBoard(record.root).accountsStrict({ game, player: bot.publicKey }).rpc();
          setMessage("Browser bot locked its hidden fleet. Waiting for your commitment.");
        } else if (currentPhase === "fire" && state.turn === 1) {
          const target = chooseBotTarget(BigInt(state.shots[0].toString()));
          await opponentProgram.methods.fire(target).accountsStrict({ game, player: bot.publicKey }).rpc();
          setMessage(`Browser bot fired at ${String.fromCharCode(65 + target % 8)}${Math.floor(target / 8) + 1}. Prove the result from your fleet.`);
        } else if (currentPhase === "respond" && state.pendingAttacker === 0) {
          const index = state.pendingIndex;
          const board = occupancy(botFleet);
          const seed = Uint8Array.from(record.seed);
          const levels = await tree(BigInt(state.gameId.toString()), bot.publicKey.toBytes(), seed, board);
          await opponentProgram.methods.respond(board[index], Array.from(await salt(seed, index)), proof(levels, index).map((item) => Array.from(item))).accountsStrict({ game, player: bot.publicKey }).rpc();
          setMessage(`Bot proof verified: your shot at ${String.fromCharCode(65 + index % 8)}${Math.floor(index / 8) + 1} was a ${board[index] ? "hit" : "miss"}.`);
        } else if (currentPhase === "audit" && state.claimant === 1) {
          await opponentProgram.methods.auditBoard(record.seed, record.placements).accountsStrict({ game, player: bot.publicKey }).rpc();
          setMessage("Browser bot completed its fleet audit. Final result confirmed on Devnet.");
        } else return;
        await refresh(activeGameAddress);
        await loadShotHistory(activeGameAddress);
      } catch (error) {
        setMessage(errorMessage(error, "The browser bot paused. Keep this tab open and refresh the match to resume it."));
      } finally { botBusy.current = false; }
    };
    const timer = window.setTimeout(() => void runBot(), 900);
    return () => window.clearTimeout(timer);
  }, [activeGameAddress, battleState.pendingIndex, battleState.shots, battleState.turn, connection, loadShotHistory, phase, refresh]);
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
      localStorage.setItem(`dreadtide-match:${publicKey.toBase58()}`, pda.toBase58());
      setJoinAddress("");
      setRole("Creator");
      setPhase("LOBBY"); setPlayers("Waiting for opponent"); setCommitted("0 / 2"); setMyCommitted(false);
      await refresh(pda.toBase58());
      setMessage("Match created. Copy the address below and send it to a different wallet.");
    } catch (error) { setMessage(errorMessage(error, "Create transaction failed.")); }
    finally { setBusy(false); }
  }

  async function startSoloGame() {
    if (!program || !publicKey) return;
    setBusy(true); setMessage("Creating your solo Devnet match...");
    try {
      const id = uniqueGameId();
      const idBytes = Buffer.alloc(8); idBytes.writeBigUInt64LE(id);
      const [game] = PublicKey.findProgramAddressSync([Buffer.from("game"), publicKey.toBuffer(), idBytes], PROGRAM_ID);
      await program.methods.createGame(new BN(id.toString())).accountsStrict({ game, creator: publicKey, systemProgram: SystemProgram.programId }).rpc();
      const record = await createBotRecord(game.toBase58(), id);
      const { keypair: bot } = restoreBot(record);
      setMessage("Approve 0.01 Devnet SOL to fund the local bot's transaction fees. This has no real-world value.");
      const fundingSignature = await sendTransaction(new Transaction().add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: bot.publicKey, lamports: Math.round(.01 * LAMPORTS_PER_SOL) })), connection);
      await connection.confirmTransaction(fundingSignature, "confirmed");
      const opponentProgram = botProgram(connection, bot);
      await opponentProgram.methods.joinGame().accountsStrict({ game, opponent: bot.publicKey }).rpc();
      localStorage.setItem(botStorageKey(game.toBase58()), JSON.stringify(record));
      localStorage.setItem(`dreadtide-match:${publicKey.toBase58()}`, game.toBase58());
      setGameId(id.toString()); setActiveGameAddress(game.toBase58()); setRole("Creator"); setPhase("COMMIT"); setPlayers("Browser bot joined"); setCommitted("0 / 2");
      await refresh(game.toBase58());
      setMessage("Solo opponent online. Deploy and lock your fleet; the bot will handle its turns automatically while this tab remains open.");
    } catch (error) { setMessage(errorMessage(error, "Could not start the solo match.")); }
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
      localStorage.setItem(`dreadtide-match:${publicKey.toBase58()}`, address.toBase58());
      setRole("Opponent");
      await refresh(address.toBase58());
      setMessage("Joined. Both captains can now commit their fleet.");
    } catch (error) { setMessage(errorMessage(error, "Join transaction failed.")); }
    finally { setBusy(false); }
  }

  async function resumeGame() {
    if (!program || !publicKey || !joinAddress) return;
    setBusy(true); setMessage("Checking match membership on Devnet...");
    try {
      const address = new PublicKey(joinAddress);
      const state = await program.account.game.fetch(address) as any;
      if (!publicKey.equals(state.creator) && !publicKey.equals(state.opponent)) throw new Error("NotPlayer");
      setActiveGameAddress(address.toBase58());
      localStorage.setItem(`dreadtide-match:${publicKey.toBase58()}`, address.toBase58());
      await refresh(address.toBase58());
      setMessage("Existing match restored. Import your private fleet recovery if this browser does not have it.");
    } catch (error) { setMessage(errorMessage(error, "Could not resume that match.")); }
    finally { setBusy(false); }
  }

  async function watchGame() {
    if (!watchAddress) return;
    setBusy(true); setMessage("Loading public match state from Solana Devnet...");
    try {
      const address = new PublicKey(watchAddress);
      await program.account.game.fetch(address);
      setActiveGameAddress(address.toBase58());
      setRole("Spectator");
      setPlayerIndex(-1);
      await refresh(address.toBase58());
      await loadShotHistory(address.toBase58());
      setMessage("Spectator feed live. Public match state refreshes every five seconds.");
    } catch (error) { setMessage(errorMessage(error, "Could not watch that match.")); }
    finally { setBusy(false); }
  }

  async function copyMatchAddress() {
    if (!activeGameAddress) return;
    try {
      await navigator.clipboard.writeText(activeGameAddress);
      setMessage("Match address copied. Send it to your opponent.");
    } catch {
      setMessage("Clipboard access was blocked. Select and copy the address above.");
    }
  }

  async function commitFleet() {
    if (!program || !publicKey || !activeGameAddress) return;
    setBusy(true); setMessage("Building your private Merkle commitment...");
    try {
      const state = await program.account.game.fetch(new PublicKey(activeGameAddress)) as any;
      const playerIndex = publicKey.equals(state.creator) ? 0 : publicKey.equals(state.opponent) ? 1 : -1;
      if (playerIndex < 0) throw new Error("NotPlayer");
      if (phaseName(state.phase) !== "commit") throw new Error("WrongPhase");
      if (state.committed[playerIndex]) throw new Error("AlreadyCommitted");
      if (Math.floor(Date.now() / 1000) > Number(state.deadline.toString())) throw new Error("DeadlinePassed");
      if (!validateFleet(fleet).valid) throw new Error("Place a valid fleet before committing.");
      const existing = localStorage.getItem(secretKey(activeGameAddress, publicKey.toBase58()));
      const seed = existing ? Uint8Array.from(parseSecret(existing).seed) : bytesFromSeed();
      const levels = await tree(BigInt(state.gameId.toString()), publicKey.toBytes(), seed, occupancy(fleet));
      const root = Array.from(levels[6][0]);
      const record: FleetSecret = { schemaVersion: 1, matchAddress: activeGameAddress, playerAddress: publicKey.toBase58(), gameId: state.gameId.toString(), placements: fleet.map(({ x, y, vertical }) => ({ x, y, vertical })), seed: Array.from(seed), root };
      localStorage.setItem(secretKey(activeGameAddress, publicKey.toBase58()), JSON.stringify(record));
      setHasRecovery(true);
      await program.methods.commitBoard(root).accountsStrict({ game: new PublicKey(activeGameAddress), player: publicKey }).rpc();
      await refresh();
      setMessage("Fleet committed. Your board remains hidden until an audit.");
    } catch (error) { setMessage(errorMessage(error, "Commit transaction failed.")); }
    finally { setBusy(false); }
  }

  function exportRecovery() {
    if (!publicKey || !activeGameAddress) return;
    const stored = localStorage.getItem(secretKey(activeGameAddress, publicKey.toBase58()));
    if (!stored) return;
    const blob = new Blob([stored], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dreadtide-recovery-${short(activeGameAddress).replace("...", "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Private recovery file exported. Store it securely and do not share it.");
  }

  async function importRecovery(file: File) {
    if (!publicKey || !activeGameAddress) return;
    try {
      const record = parseSecret(await file.text());
      if (record.matchAddress !== activeGameAddress || record.playerAddress !== publicKey.toBase58() || record.gameId !== gameId) throw new Error("This recovery file belongs to a different match, wallet, or game ID.");
      const restored = record.placements.map((ship) => ({ ...ship, placed: true }));
      const levels = await tree(BigInt(record.gameId), publicKey.toBytes(), Uint8Array.from(record.seed), occupancy(restored));
      if (!levels[6][0].every((value, index) => value === record.root[index])) throw new Error("Recovery verification failed: commitment root mismatch.");
      localStorage.setItem(secretKey(activeGameAddress, publicKey.toBase58()), JSON.stringify(record));
      setFleet(restored);
      setHasRecovery(true);
      setMessage("Private fleet recovery verified and restored.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import that recovery file.");
    }
  }

  function requireSecret(): FleetSecret {
    if (!publicKey || !activeGameAddress) throw new Error("Connect the match wallet first.");
    const stored = localStorage.getItem(secretKey(activeGameAddress, publicKey.toBase58()));
    if (!stored) throw new Error("Private fleet data is missing. Import your recovery file.");
    const record = parseSecret(stored);
    if (record.matchAddress !== activeGameAddress || record.playerAddress !== publicKey.toBase58() || record.gameId !== gameId) throw new Error("Private fleet data does not match this wallet and game.");
    return record;
  }

  async function fireAt(index: number) {
    if (!program || !publicKey || !activeGameAddress) return;
    setBusy(true); setMessage(`Devnet fire transaction: target ${String.fromCharCode(65 + index % 8)}${Math.floor(index / 8) + 1}. Confirm in your wallet.`);
    try {
      const state = await program.account.game.fetch(new PublicKey(activeGameAddress)) as any;
      const currentIndex = publicKey.equals(state.creator) ? 0 : publicKey.equals(state.opponent) ? 1 : -1;
      if (phaseName(state.phase) !== "fire" || currentIndex < 0 || state.turn !== currentIndex) throw new Error("WrongPlayer");
      const defender = 1 - currentIndex;
      if ((BigInt(state.shots[defender].toString()) & (1n << BigInt(index))) !== 0n) throw new Error("DuplicateShot");
      await program.methods.fire(index).accountsStrict({ game: new PublicKey(activeGameAddress), player: publicKey }).rpc();
      await refresh();
      setMessage("Attack confirmed. Waiting for the defender's cryptographic response.");
    } catch (error) { setMessage(errorMessage(error, "Fire transaction failed.")); }
    finally { setBusy(false); }
  }

  async function respondToShot() {
    if (!program || !publicKey || !activeGameAddress) return;
    setBusy(true); setMessage("Preparing the six-sibling Merkle proof from your private fleet...");
    try {
      const record = requireSecret();
      const state = await program.account.game.fetch(new PublicKey(activeGameAddress)) as any;
      if (phaseName(state.phase) !== "respond") throw new Error("WrongPhase");
      const currentIndex = publicKey.equals(state.creator) ? 0 : publicKey.equals(state.opponent) ? 1 : -1;
      if (currentIndex < 0 || currentIndex === state.pendingAttacker) throw new Error("WrongPlayer");
      const index = state.pendingIndex;
      const placements = record.placements.map((ship) => ({ ...ship, placed: true }));
      const board = occupancy(placements);
      const seed = Uint8Array.from(record.seed);
      const levels = await tree(BigInt(record.gameId), publicKey.toBytes(), seed, board);
      const cellSalt = await salt(seed, index);
      const siblings = proof(levels, index).map((item) => Array.from(item));
      setMessage(`Devnet response transaction: prove ${board[index] ? "hit" : "miss"} at ${String.fromCharCode(65 + index % 8)}${Math.floor(index / 8) + 1}. Confirm in your wallet.`);
      await program.methods.respond(board[index], Array.from(cellSalt), siblings).accountsStrict({ game: new PublicKey(activeGameAddress), player: publicKey }).rpc();
      await refresh();
      await loadShotHistory();
      setMessage(`Verified ${board[index] ? "hit" : "miss"}. The next turn is now live.`);
    } catch (error) { setMessage(errorMessage(error, "Response transaction failed.")); }
    finally { setBusy(false); }
  }

  async function claimTimeout() {
    if (!program || !publicKey || !activeGameAddress) return;
    setBusy(true); setMessage("Devnet timeout resolution transaction. Confirm in your wallet.");
    try {
      await program.methods.claimTimeout().accountsStrict({ game: new PublicKey(activeGameAddress), caller: publicKey }).rpc();
      await refresh();
      setMessage("Expired action resolved on-chain. The new match phase is confirmed.");
    } catch (error) { setMessage(errorMessage(error, "Timeout transaction failed.")); }
    finally { setBusy(false); }
  }

  async function auditFleet() {
    if (!program || !publicKey || !activeGameAddress) return;
    setBusy(true); setMessage("Preparing your original fleet for claimant verification...");
    try {
      const record = requireSecret();
      const placements = record.placements.map(({ x, y, vertical }) => ({ x, y, vertical }));
      setMessage("Devnet winner audit transaction. Your fleet is revealed to verify the result; confirm in your wallet.");
      await program.methods.auditBoard(record.seed, placements).accountsStrict({ game: new PublicKey(activeGameAddress), player: publicKey }).rpc();
      await refresh();
      setMessage("Fleet audit confirmed. Final match result loaded from Devnet.");
    } catch (error) { setMessage(errorMessage(error, "Fleet audit failed.")); }
    finally { setBusy(false); }
  }

  function playAgain() {
    if (walletAddress) localStorage.removeItem(`dreadtide-match:${walletAddress}`);
    setActiveGameAddress("");
    setJoinAddress("");
    setGameId("Generated on create");
    setFleet(emptyFleet());
    setHistory([]);
    setBattleState({ creator: "", opponent: "", turn: 0, pendingIndex: 255, pendingAttacker: 255, shots: [0n, 0n], hits: [0, 0], claimant: 255, auditedWinner: 255 });
    setRole("Not assigned"); setPlayerIndex(-1); setPhase("LOBBY"); setDeadline(0); setCommitted("0 / 2"); setMyCommitted(false); setHasRecovery(false);
    setMessage("Ready for a fresh match with new private commitments.");
  }

  return (
    <section className="game-console" aria-labelledby="game-console-title">
      <div className="console-heading">
        <div><p className="eyebrow">MATCH OPERATIONS</p><h2 id="game-console-title">Enter the war room.</h2></div>
        <span className={`live-badge ${connected ? "online" : ""}`}><i /> {connected ? "WALLET READY" : "WALLET OFFLINE"}</span>
      </div>
      {!connected ? <div className="console-empty"><div><h3>Watch the battle live.</h3><p>Paste any DREADTIDE match address to follow its public on-chain state. No wallet is required.</p></div><div className="spectator-entry"><label htmlFor="watch-address">MATCH ADDRESS</label><input id="watch-address" value={watchAddress} onChange={(event) => setWatchAddress(event.target.value.trim())} placeholder="Paste a Devnet game account" /><button disabled={busy || !watchAddress} onClick={watchGame}>{busy ? "LOADING..." : "WATCH MATCH"}</button></div><p className="connect-note">Connect Phantom or Solflare to command a fleet.</p></div> : (
        <div className="console-grid">
          <div className="console-card create-card"><span className="step">01</span><h3>Create a match</h3><p>Challenge another captain or launch a local browser opponent on Devnet.</p><label htmlFor="game-id">Game ID</label><input id="game-id" value={gameId} readOnly /><button disabled={busy} onClick={createGame}>{busy ? "PREPARING..." : "CREATE PVP MATCH"}</button><button className="secondary-console-action" disabled={busy} onClick={startSoloGame}>PLAY VS BROWSER BOT</button>{role === "Creator" && activeGameAddress ? <div className="share-match"><span>YOUR MATCH ADDRESS</span><code>{activeGameAddress}</code><button className="secondary-console-action" onClick={copyMatchAddress}>COPY FOR OPPONENT</button></div> : null}</div>
          <div className="console-card join-card"><span className="step">02</span><h3>Join or resume</h3><p>Join a new opponent match, or restore a match already owned by this wallet.</p><label htmlFor="join-address">Game account</label><input id="join-address" value={joinAddress} onChange={(event) => setJoinAddress(event.target.value.trim())} placeholder="Paste a match address" /><button disabled={busy || !joinAddress} onClick={joinGame}>JOIN OPPONENT MATCH</button><button className="secondary-console-action" disabled={busy || !joinAddress} onClick={resumeGame}>RESUME MY MATCH</button></div>
          <div className="console-card status-card"><span className="step">03</span><h3>Fleet status</h3><div className="status-lines"><span>GAME <b>{activeGameAddress ? short(activeGameAddress) : "NOT SET"}</b></span><span>ROLE <b>{role.toUpperCase()}</b></span><span>PHASE <b>{phase}</b></span><span>ACTION WINDOW <b className={deadline > 0 && deadline <= clockNow ? "expired" : ""}>{deadline ? formatRemaining(deadline - clockNow) : "NOT STARTED"}</b></span><span>PLAYERS <b>{players}</b></span><span>COMMITMENTS <b>{committed}</b></span></div><button className="commit-button" disabled={phase !== "COMMIT" || myCommitted} onClick={() => document.getElementById("fleet-title")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{myCommitted ? "FLEET COMMITTED" : phase === "COMMIT" ? "DEPLOY FLEET BELOW" : "AWAITING OPPONENT"}</button></div>
        </div>
      )}
      {connected && activeGameAddress && phase === "COMMIT" ? <FleetDeployment fleet={fleet} onChange={setFleet} onCommit={commitFleet} onExport={exportRecovery} onImport={importRecovery} committed={myCommitted} busy={busy} canCommit={deadline > clockNow} hasRecovery={hasRecovery} /> : null}
      {activeGameAddress && ["FIRE", "RESPOND", "AUDIT", "VERIFIED FINISHED", "NO VERIFIED WINNER", "CANCELLED"].includes(phase) ? <BattleArena phase={phase} playerIndex={playerIndex} state={battleState} fleet={fleet} history={history} deadlineExpired={deadline > 0 && deadline <= clockNow} busy={busy} hasRecovery={hasRecovery} onFire={fireAt} onRespond={respondToShot} onClaimTimeout={claimTimeout} onAudit={auditFleet} onPlayAgain={playAgain} /> : null}
      <p className="console-message" role="status">{message}</p>
    </section>
  );
}
