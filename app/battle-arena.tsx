"use client";

import { useMemo, useState } from "react";
import { occupancy } from "./lib/crypto/merkle";
import { bitmapCount, bitmapHas, coordinate, type ShotOutcome } from "./lib/game/battle";
import type { FleetPlacement } from "./lib/game/fleet";

export type BattleState = {
  creator: string;
  opponent: string;
  turn: number;
  pendingIndex: number;
  pendingAttacker: number;
  shots: [bigint, bigint];
  hits: [number, number];
  claimant: number;
  auditedWinner: number;
};

type Props = {
  phase: string;
  playerIndex: number;
  state: BattleState;
  fleet: FleetPlacement[];
  history: ShotOutcome[];
  deadlineExpired: boolean;
  busy: boolean;
  hasRecovery: boolean;
  onFire: (index: number) => void;
  onRespond: () => void;
  onClaimTimeout: () => void;
  onAudit: () => void;
  onPlayAgain: () => void;
};

function Board({ title, own, fleet, outcomes, shotBitmap, enabled, selected, pendingIndex, onSelect }: { title: string; own: boolean; fleet: FleetPlacement[]; outcomes: Map<number, ShotOutcome>; shotBitmap: bigint; enabled: boolean; selected: number | null; pendingIndex?: number; onSelect: (index: number) => void }) {
  const ships = own && fleet.every((ship) => ship.placed) ? occupancy(fleet) : Array<boolean>(64).fill(false);
  return <div className="battle-board-shell"><div className="board-title"><h4>{title}</h4><span>{own ? "PRIVATE DEPLOYMENT" : enabled ? "SELECT TARGET" : "ENEMY WATERS"}</span></div><div className="battle-board" role="grid" aria-label={title}>{Array.from({ length: 64 }, (_, index) => {
    const outcome = outcomes.get(index);
    const recorded = bitmapHas(shotBitmap, index);
    const status = outcome ? outcome.isShip ? "hit" : "miss" : recorded ? "unavailable" : "";
    const label = `${coordinate(index)}${ships[index] ? ", ship" : ""}${outcome ? outcome.isShip ? ", verified hit" : ", verified miss" : recorded ? ", result evidence loading" : ""}`;
    return <button key={index} type="button" role="gridcell" aria-label={label} className={`${ships[index] ? "own-ship" : ""} ${status} ${selected === index ? "targeted" : ""} ${pendingIndex === index ? "pending-impact" : ""}`} disabled={!enabled || recorded} onClick={() => onSelect(index)}><small>{coordinate(index)}</small>{status === "hit" ? <b>HIT</b> : status === "miss" ? <b>MISS</b> : status === "unavailable" ? <b>...</b> : null}</button>;
  })}</div></div>;
}

export function BattleArena({ phase, playerIndex, state, fleet, history, deadlineExpired, busy, hasRecovery, onFire, onRespond, onClaimTimeout, onAudit, onPlayAgain }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const spectator = playerIndex < 0;
  const myAddress = playerIndex === 0 ? state.creator : state.opponent;
  const enemyIndex = playerIndex >= 0 ? 1 - playerIndex : 0;
  const enemyAddress = enemyIndex === 0 ? state.creator : state.opponent;
  const myOutcomes = useMemo(() => new Map(history.filter((shot) => shot.defender === myAddress).map((shot) => [shot.index, shot])), [history, myAddress]);
  const enemyOutcomes = useMemo(() => new Map(history.filter((shot) => shot.defender === enemyAddress).map((shot) => [shot.index, shot])), [history, enemyAddress]);
  const creatorOutcomes = useMemo(() => new Map(history.filter((shot) => shot.defender === state.creator).map((shot) => [shot.index, shot])), [history, state.creator]);
  const opponentOutcomes = useMemo(() => new Map(history.filter((shot) => shot.defender === state.opponent).map((shot) => [shot.index, shot])), [history, state.opponent]);
  const canFire = phase === "FIRE" && playerIndex >= 0 && state.turn === playerIndex && !deadlineExpired;
  const mustRespond = phase === "RESPOND" && playerIndex >= 0 && state.pendingAttacker === enemyIndex && !deadlineExpired;
  const canAudit = phase === "AUDIT" && state.claimant === playerIndex && !deadlineExpired;
  const totalRecorded = bitmapCount(state.shots[0]) + bitmapCount(state.shots[1]);
  const title = spectator ? phase === "VERIFIED FINISHED" ? "Verified match complete" : phase === "RESPOND" ? `Proof pending at ${coordinate(state.pendingIndex)}` : "Live spectator feed" : phase === "FIRE" ? canFire ? "Your firing solution" : "Enemy is choosing a target" : phase === "RESPOND" ? mustRespond ? `Incoming fire at ${coordinate(state.pendingIndex)}` : "Waiting for defender proof" : phase === "AUDIT" ? canAudit ? "Verify your fleet to claim victory" : "Winner verification in progress" : phase === "VERIFIED FINISHED" ? state.auditedWinner === playerIndex ? "Verified victory" : "Defeat confirmed" : phase === "NO VERIFIED WINNER" ? "No verified winner" : phase === "CANCELLED" ? "Match cancelled" : "Battle synchronization";

  return <section className={`battle-arena phase-${phase.toLowerCase().replaceAll(" ", "-")} ${spectator ? "spectator-mode" : ""}`} aria-labelledby="battle-title"><header className="battle-heading"><div><p className="eyebrow">{spectator ? "PUBLIC DEVNET TELEMETRY" : "LIVE ENGAGEMENT"}</p><h3 id="battle-title">{title}</h3></div><div className="battle-score"><span>{spectator ? "CREATOR" : "YOU"} <b>{state.hits[spectator ? 1 : enemyIndex]}/12 HITS</b></span><span>{spectator ? "OPPONENT" : "RIVAL"} <b>{state.hits[spectator ? 0 : playerIndex]}/12 HITS</b></span></div></header>
    {!hasRecovery && playerIndex >= 0 ? <div className="battle-alert">PRIVATE FLEET DATA MISSING. Import your recovery file before responding or auditing.</div> : null}
    {history.length < totalRecorded ? <div className="battle-evidence-note">Some confirmed cell outcomes are still being reconstructed from Devnet transaction evidence.</div> : null}
    <div className="battle-boards">{spectator ? <><Board title="Creator Waters" own={false} fleet={[]} outcomes={creatorOutcomes} shotBitmap={state.shots[0]} enabled={false} selected={null} pendingIndex={phase === "RESPOND" && state.pendingAttacker === 1 ? state.pendingIndex : undefined} onSelect={() => undefined} /><Board title="Opponent Waters" own={false} fleet={[]} outcomes={opponentOutcomes} shotBitmap={state.shots[1]} enabled={false} selected={null} pendingIndex={phase === "RESPOND" && state.pendingAttacker === 0 ? state.pendingIndex : undefined} onSelect={() => undefined} /></> : <><Board title="My Fleet" own fleet={fleet} outcomes={myOutcomes} shotBitmap={state.shots[playerIndex]} enabled={false} selected={null} pendingIndex={mustRespond ? state.pendingIndex : undefined} onSelect={() => undefined} /><Board title="Enemy Waters" own={false} fleet={[]} outcomes={enemyOutcomes} shotBitmap={state.shots[enemyIndex]} enabled={canFire} selected={selected} onSelect={setSelected} /></>}</div>
    <div className="battle-actions"><div className="turn-readout"><span>PHASE</span><strong>{phase}</strong><small>{spectator ? `Turn: ${state.turn === 0 ? "creator" : "opponent"}. Read-only state confirmed from Devnet.` : canFire ? "Choose an untried coordinate." : mustRespond ? "Your saved fleet will generate the exact Merkle proof." : "Match state is confirmed from Devnet."}</small></div>{!spectator && canFire ? <button type="button" onClick={() => { if (selected !== null) onFire(selected); }} disabled={busy || selected === null}>FIRE {selected === null ? "ON TARGET" : coordinate(selected)}</button> : null}{!spectator && mustRespond ? <button type="button" onClick={onRespond} disabled={busy || !hasRecovery}>PROVE {coordinate(state.pendingIndex)}</button> : null}{!spectator && canAudit ? <button type="button" onClick={onAudit} disabled={busy || !hasRecovery}>VERIFY VICTORY</button> : null}{!spectator && deadlineExpired && !["VERIFIED FINISHED", "NO VERIFIED WINNER", "CANCELLED"].includes(phase) ? <button type="button" onClick={onClaimTimeout} disabled={busy}>RESOLVE EXPIRED TURN</button> : null}{!spectator && ["VERIFIED FINISHED", "NO VERIFIED WINNER", "CANCELLED"].includes(phase) ? <button type="button" onClick={onPlayAgain} disabled={busy}>PLAY AGAIN</button> : null}</div>
    <div className="battle-log"><div className="board-title"><h4>Verified battle log</h4><span>{history.length} PROVEN RESPONSES</span></div>{history.length === 0 ? <p>No verified shots yet.</p> : <ol>{[...history].reverse().slice(0, 8).map((shot) => <li key={shot.signature}><span className={shot.isShip ? "log-hit" : "log-miss"}>{shot.isShip ? "HIT" : "MISS"}</span><strong>{coordinate(shot.index)}</strong><a href={`https://explorer.solana.com/tx/${shot.signature}?cluster=devnet`} target="_blank" rel="noreferrer">VIEW PROOF ↗</a></li>)}</ol>}</div>
  </section>;
}
