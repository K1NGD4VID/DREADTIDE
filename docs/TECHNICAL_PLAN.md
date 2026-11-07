# DREADTIDE — Technical Implementation Plan
**Version:** 2.0 | **Target:** Solana Devnet | **Approach:** Vertical slice first

## 1. Architecture
- **Anchor/Rust program:** match PDA, commitment and proof checks, turn machine, deadlines, claimant audit, optional SPL escrow.
- **Next.js/TypeScript client:** wallet connection, fleet editor, battle grid, browser-local bot, session signer, recovery export/import, spectator route.
- **Shared fixtures:** canonical SHA-256 golden vectors used by Rust and TypeScript tests.
- **Solana RPC:** submit transactions, read accounts, fetch signatures and confirmation; optional indexer for convenience only.
- **No authoritative off-chain referee.** A read/indexing service cannot decide a hit, winner, or payout.

## 2. Repository layout
```text
dreadtide/
  programs/dreadtide/src/{lib.rs,state.rs,instructions/,crypto.rs,fleet.rs,errors.rs}
  tests/{game.spec.ts,crypto-vectors.spec.ts,escrow.spec.ts}
  app/{app/,components/,lib/solana/,lib/crypto/,lib/bot/,lib/recovery/}
  fixtures/merkle-vectors.json
  docs/{PRD.md,SRD.md,TECHNICAL_PLAN.md,AGENT_PROMPT.md}
  README.md
  DECISIONS.md
```

## 3. Crypto implementation gate
1. Fix canonical game ID, player pubkeys, seed, ship positions.
2. Produce a reference 64-leaf tree and proofs for one occupied and one empty cell.
3. Assert byte-for-byte equality in TypeScript and Rust; include malformed proof tests.
4. Only then implement `respond`.
5. Benchmark SHA-256 recomputation of 64 leaves + 63 nodes for `audit_board` on Anchor's runtime. Use explicit compute-budget instructions if necessary and document measured limits; do not silently drop on-chain verification.

## 4. Program implementation sequence
**Phase A — State:** `create_game`, `join_game`, account constraints, phases, deadlines. Prove no unauthorized state transitions.
**Phase B — Core battle:** `commit_board`, `fire`, `respond`, shot bitmaps, 12-hit provisional claim. Implement all cryptographic verification in program.
**Phase C — Claimant-only finality:** `audit_board`, `claim_timeout`, invalid-audit state transitions, second-claimant audit, NoVerifiedWinner. Implement this before polishing UI.
**Phase D — Playability:** wallet adapters, fleet placement, browser bot, local seed recovery, pending transaction UX, spectator Explorer links.
**Phase E — Session UX:** one-time `set_session` authorization; scoped fee-funded signer, expiry/revoke, no popup per supported move.
**Phase F — Optional escrow:** program vault and SPL test-token deposit/claim/refund only after core tests and demo are complete.
**Phase G — Optional NFT:** mint only on verified victory; never let badge block the demo.

## 5. Account and signer model
Game PDA: `[b"game", creator, game_id_le]`; Session PDA: `[b"session", game, owner]`; vault authority PDA: `[b"vault", game]`. Every instruction checks program IDs, expected account relationships, signer, owner, seeds, and current phase. A session key signs only match actions, never withdrawals. If an Anchor interface needs `remaining_accounts`, explicitly validate every one.

## 6. Winner-only audit algorithm
`audit_board(seed, ships)`:
1. Require claimant signer/authorized match action, current audit phase, and live deadline.
2. Validate four ships, lengths [4,3,3,2], straight lines, bounds, non-overlap.
3. Derive all 64 occupancy bits and salts, build Merkle root, compare claimant's previously committed root.
4. If legal and root matches, mark `VerifiedFinished` and record audited winner.
5. Otherwise, mark invalid-audit outcome in a **successful transaction** and assign opponent one audit opportunity; if the opponent already failed, mark `NoVerifiedWinner`.
6. Never require a reveal from the non-claimant. Never pay before `VerifiedFinished`.
7. For timeouts, apply exactly the same claimant audit. A procedural timeout is not a verified fleet result.

## 7. Browser bot
Generate an ephemeral keypair locally and fund it with limited Devnet SOL. Bot selects legal fleet and stores its seed locally; submits the same on-chain instructions as a person. Implement hunt/target targeting. The bot acts only while the relevant browser page is running; do not advertise it as persistent or always online. For demo stability, optionally seed a controlled test match and pre-generate a scripted sequence, but all outcomes shown as on-chain must be real confirmed transactions.

## 8. Wallet and session UX
Connect wallet, authorize session signer for a single game, optionally deposit minimal fee SOL, then use session-signed transactions for `fire`/`respond` (and allowed setup actions). Show a clear status badge: `Session active`, `Wallet approval required`, or `Session expired`. A valid session does not guarantee immediate finality; show transaction pending/confirmed. Use random seed + recovery file; never depend on deterministic wallet signatures.

## 9. Spectator and Cheat Lab
`/watch/[id]`: read PDA, confirmed shot history, show exact Explorer links and audit status. Build evidence inspector that rechecks fetched proof data when available. Invalid attempts must be presented as failed transaction signatures or explicitly labeled local/preflight checks, never successful game events.
Cheat Lab cases: wrong `is_ship`, wrong salt, wrong sibling, illegal claimant fleet. Record invalid claimant audit as a successful state transition so judges can see disqualification on-chain.

## 10. Optional stakes design
A configured SPL test mint and equal deposits in an ATA controlled by program vault PDA. Deposit before battle activation if stakes enabled; enforce deposit gating. On `VerifiedFinished`, only audited winner may claim. On `Cancelled`/`NoVerifiedWinner`, contributors may each refund exactly their deposits. Mark settlement state before CPI; rely on atomic rollback if transfer fails. Use Anchor SPL token interfaces; validate token program/mint/ATA and reject unsupported extensions unless explicitly tested. No real funds in hackathon.

## 11. Test strategy
- Unit: hashing, fleet placement legality, state transitions.
- Anchor integration: valid/invalid proofs, replay, timeout, audit switching, double-failure refunds, session restrictions, token vault.
- UI E2E: create/join, bot move, restore secret, show Explorer link, no-popups with session, explicit fallback without session.
- Security: fuzz malformed proof, invalid coordinate, bad accounts, wrong seeds, expired session, double payout.
- Acceptance gate: demo an actual confirmed shot and a rejected forged proof before adding extras.

## 12. Delivery checkpoints (relative to start)
| Window | Milestone | Gate |
|---|---|---|
| 0–3 h | Project scaffold, golden vectors | Rust/TS hashes identical |
| 3–9 h | Core program + tests | Valid proof passes, tampered fails |
| 9–14 h | Audit + timeouts | Only audited claimant can win |
| 14–20 h | UI + browser bot | End-to-end Devnet match |
| 20–24 h | Spectator + session signer | Explorer evidence; no popup moves |
| Remaining | Polish, demo, optional stakes | No regressions; clear README |

Actual time remaining may be shorter than this idealized plan; prioritize the earliest uncompleted gate and verify official submission deadline.

## 13. Deployment and handoff
- `anchor build`, `anchor test`, `anchor deploy --provider.cluster devnet`.
- Configure `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_DREADTIDE_PROGRAM_ID`, `NEXT_PUBLIC_CLUSTER=devnet`, optional test mint.
- Deploy Next.js frontend to supported host; ensure environment variables contain no private keys.
- README includes build instructions, live program ID, game demo URL, verified transaction examples, threat model, tests, dependencies/credits, and truthful prior-work disclosure where required by event rules.
- Record unimplemented features explicitly; never claim optional escrow or session UX is complete if not demonstrated.

## 14. Stop/go and cuts
If golden vectors fail, stop program feature work. If core proof verification fails, do not build stakes or NFT. If claimant audit fails, do not claim secure victories. Cut NFT first, then stakes, then visual polish; retain basic spectator evidence, timeouts, and winner audit. If session authorization is not reliable, retain wallet-signing fallback and remove “no wallet popups” from the live demo claim.
