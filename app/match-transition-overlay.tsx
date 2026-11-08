"use client";

import { useEffect } from "react";

export type MatchTransition =
  | { kind: "accepted"; stake: number; pot: number; creator: string; opponent: string }
  | { kind: "engage"; pot: number }
  | { kind: "victory" | "defeat"; stake: number; pot: number; balance: number; winner: string }
  | { kind: "draw"; stake: number; pot: number; balance: number };

function short(value: string): string { return value ? `${value.slice(0, 5)}…${value.slice(-5)}` : "CAPTAIN"; }

export function MatchTransitionOverlay({ transition, onDismiss }: { transition: MatchTransition; onDismiss: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onDismiss]);
  const terminal = ["victory", "defeat", "draw"].includes(transition.kind);
  return <div className={`match-transition transition-${transition.kind}`} role="dialog" aria-modal="true" aria-labelledby="transition-title">
    <div className="transition-radar" aria-hidden="true"><i /><i /><i /></div>
    <section className="transition-panel">
      {transition.kind === "accepted" ? <>
        <p className="transition-status">OPPONENT JOINED · ESCROW CONFIRMED</p>
        <h2 id="transition-title">MATCH ACCEPTED</h2>
        <p className="transition-subtitle">TWO CAPTAINS. ONE BATTLEFIELD.</p>
        <div className="stake-convergence"><span><small>CREATOR</small><strong>{short(transition.creator)}</strong><b>{transition.stake} D</b></span><div aria-hidden="true"><i /><i /><i /><strong>{transition.pot} D</strong></div><span><small>OPPONENT</small><strong>{short(transition.opponent)}</strong><b>{transition.stake} D</b></span></div>
        <p className="locked-pot">TOTAL LOCKED POT <strong>{transition.pot} D</strong></p>
        <button type="button" autoFocus onClick={onDismiss}>DEPLOY YOUR FLEET</button>
      </> : transition.kind === "engage" ? <>
        <p className="transition-status">FLEETS CRYPTOGRAPHICALLY LOCKED</p>
        <h2 id="transition-title">BATTLE COMMENCING</h2>
        <div className="engage-count" aria-label="Three, two, one, engage"><span>3</span><span>2</span><span>1</span><strong>ENGAGE</strong></div>
        <p className="locked-pot">FIVE MINUTES · VERIFIED HITS · {transition.pot} D LOCKED</p>
        <button type="button" autoFocus onClick={onDismiss}>ENTER BATTLE</button>
      </> : transition.kind === "draw" ? <>
        <p className="transition-status">SETTLEMENT CONFIRMED ON DEVNET</p>
        <h2 id="transition-title">NO VERIFIED WINNER</h2>
        <p className="transition-subtitle">DRAW · STAKES RETURNED</p>
        <div className="result-ledger"><span>TOTAL POT <b>{transition.pot} D</b></span><span>YOUR REFUND <b>+{transition.stake} D</b></span><span>CONFIRMED BALANCE <b>{transition.balance} D</b></span></div>
        <button type="button" autoFocus onClick={onDismiss}>VIEW MATCH RESULTS</button>
      </> : <>
        <p className="transition-status">BOARD AUDIT COMPLETE · SETTLEMENT CONFIRMED</p>
        <h2 id="transition-title">{transition.kind === "victory" ? "VERIFIED VICTORY" : "DEFEAT"}</h2>
        <p className="transition-subtitle">WINNER · {short(transition.winner)}</p>
        <div className="result-ledger"><span>LOCKED POT <b>{transition.pot} D</b></span><span>NET RESULT <b>{transition.kind === "victory" ? `+${transition.stake}` : `−${transition.stake}`} D</b></span><span>CONFIRMED BALANCE <b>{transition.balance} D</b></span></div>
        <button type="button" autoFocus onClick={onDismiss}>VIEW MATCH RESULTS</button>
      </>}
      {!terminal ? <button type="button" className="skip-transition" onClick={onDismiss}>SKIP ANIMATION</button> : null}
    </section>
  </div>;
}
