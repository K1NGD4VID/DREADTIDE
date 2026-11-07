# DREADTIDE — Software Requirements Document
**Version:** 2.0 | **Status:** Implementation specification | **Network:** Solana Devnet

## 1. System boundary
The Solana Anchor program is authoritative for match membership, commitments, phase, turn, accepted shots, deadlines, audit outcomes, and optional escrow. The browser stores secret fleet data until disclosure. The UI and spectator index are untrusted read models. The browser bot is a genuine participant controlled by a local ephemeral keypair.

## 2. Functional requirements
**FR-01 Create:** A wallet creates a unique match with creator, expiry, and optional stake configuration. Match ID is unique and used in PDA seeds.
**FR-02 Join:** A different wallet joins only an open, non-expired match; cannot join twice.
**FR-03 Commit:** Each participant commits exactly one 32-byte board root; roots cannot change after commit.
**FR-04 Fire:** Only current attacker can fire a previously unshot cell when no attack is pending and deadline is live.
**FR-05 Respond:** Only defending participant can answer the pending cell with `is_ship`, 32-byte salt and exactly six sibling hashes; program verifies indexed path against defender root.
**FR-06 Progress:** Accepted response records outcome, updates target-specific shot bitmap and hits, then changes turn; at 12 hits provisional claimant is attacker.
**FR-07 Audit:** Only current victory claimant submits their own 32-byte seed and four ship placements; program checks fleet geometry and rebuilds all 64 leaves and root. Valid => VerifiedWinner; invalid => transfer claim to opponent for their audit or NoVerifiedWinner if both fail.
**FR-08 Audit expiry:** Any signer may advance a timed-out audit; beneficiary changes once, then requires their own audit. If second audit fails or expires => NoVerifiedWinner.
**FR-09 Timeouts:** Anyone may call `claim_timeout` after a phase deadline. Non-delinquent participant becomes provisional claimant, must pass own audit. No autonomous timeout claims.
**FR-10 Cancel:** Unjoined lobby expires/cancels with refund path; no arbitrary cancellation of active matches.
**FR-11 Sessions:** Owner authorizes/revokes game-specific session public key and expiry; only `fire`, `respond`, and optionally `commit_board` may use it. No vault actions.
**FR-12 Evidence:** Client displays confirmed accepted shots with actual transaction signature and Devnet Explorer link. Rejected attempt is distinctly labeled.
**FR-13 Browser bot:** Bot uses same RPC/IDL and real signed transactions, never simulated local match state presented as on-chain.
**FR-14 Stakes (P2):** Configured test mint, equal deposits, program vault, audited winner payout, cancel/no-winner refunds; no double claim.
**FR-15 Recovery:** Player can export/import local board seed and placements; validate commitment before continuing.
**FR-16 Cheat Lab:** Demonstrate invalid proof and illegal winner audit without fake evidence.

## 3. Nonfunctional requirements
- **Integrity:** checked arithmetic; account seeds and owner constraints; deterministic hashes and state transitions.
- **Security:** never store private keys server-side; scope session signer; no real-money stake support in MVP.
- **Availability:** no required always-on backend; public RPC may fail and must be surfaced.
- **Performance:** responsive optimistic pending UI; confirmations depend on RPC/network; do not guarantee sub-second finality.
- **Accessibility:** keyboard-operable grid, visible focus, non-color-only hit/miss indicators, mobile responsive.
- **Observability:** transaction signatures, program errors, state snapshots, events; explicit pending/confirmed/rejected states.
- **Testing:** Anchor program integration tests plus TypeScript hashing vectors and end-to-end UI smoke tests.

## 4. Game state machine
`Open -> Placing -> Active(AttackDue) -> Active(DefenseDue) -> Active(AttackDue)` until 12 verified hits or timeout; then `AwaitingClaimantAudit -> VerifiedFinished` on valid audit; invalid/expired first claimant => `AwaitingOtherClaimantAudit`; second failure/expiry => `NoVerifiedWinner`. `Open -> Cancelled` on expiry/cancel. Every state transition stores a new deadline where relevant.

The result must distinguish `VictoryReason::TwelveHits`, `VictoryReason::OpponentTimeout`, and `VictoryReason::AuditForfeit`; all **verified** winners still pass their own fleet audit.

## 5. Accounts and fields
### Game PDA
Seeds: `[b"game", creator_pubkey, game_id_u64_le]`.
Fields: `version`, `bump`, `id`, `creator`, `player_two`, `status`, `phase`, `turn`, `roots[2]`, `committed[2]`, `hit_counts[2]`, `shots_against[2]` as u64 bitmaps, `pending_cell: Option<u8>`, `pending_attacker`, `deadline_unix`, `claimant: Option<Pubkey>`, `audit_attempts_mask`, `result`, `victory_reason`, `stake_mint`, `stake_amount`, `deposit_mask`, `payout_claimed`, `refund_mask`, and reserved space.
A `hit_counts[target]` count refers to confirmed ship cells hit **on that target's board**, never the attacker's own losses.

### SessionAuth PDA
Seeds: `[b"session", game_pubkey, owner_pubkey]`.
Fields: `game`, `owner`, `session_pubkey`, `expires_at`, `revoked`, `permissions` (fixed supported move set), `bump`. Session signer is never authorized to claim payout, refund, change stake settings, or change game participants.

### Vault
Optional program-authority PDA + associated token account for configured mint; enforce SPL Token Program account/mint and token authority constraints.

## 6. Cryptographic specification
Use exactly these bytes in browser and Rust:
- `seed`: 32 cryptographically random bytes per player/game.
- `salt_i = SHA256(ASCII("DT-SALT") || seed[32] || u8(i))`.
- `leaf_i = SHA256(0x00 || u64_le(game_id) || player_pubkey[32] || u8(i) || u8(is_ship) || salt_i[32])`.
- `node = SHA256(0x01 || left[32] || right[32])`.
- Exactly 64 leaves, indices 0–63, `i = y*8+x`; 6 sibling levels. For each level, current bit of index determines left/right concatenation; no sorting.
- `verify`: start with supplied leaf, fold 6 siblings, compare final digest to committed root.
- Proof is bound to game ID, player pubkey, and cell index. Check all proof sizes and indices.
- Fleet: lengths multiset [4,3,3,2]; each ship specified by `(start_x, start_y, orientation)`; in bounds, straight, no overlap, touching permitted; canonical ship order for serialization and audit.
- Board audit recomputes 64 occupancy bits and root from the seed and fleet. Full board seed is intentionally revealed only at audit.
- Generate golden fixtures with a fixed 32-byte seed, fixed two-player public keys, fixed game ID, placement, expected root, and proof for hit/miss; tests must match across Rust and TypeScript.
- Hashing is binding against computationally feasible collisions and hides individual occupancy given secret salt; the final audit makes the claimant's board public.

## 7. Instruction contracts
`create_game(game_id, optional_stake)` validates creator signer, unique PDA, allowed expiry.
`join_game()` validates distinct participant and status.
`commit_board(root)` validates participant, phase, authorization, and one-time commitment.
`set_session(session_pubkey, expires_at)` validates owner signature and bounded expiry.
`revoke_session()` validates owner signature.
`fire(cell)` validates authorized signer, phase, deadline, bitmaps, no pending shot.
`respond(is_ship, salt, siblings[6])` validates defender, phase, deadline, pending index, Merkle path; on success updates hit/turn and emits `ShotVerified`.
`audit_board(seed, ships[4])` validates claimant and phase; computes legality and root; **records invalid audit as a successful state transition** rather than throwing for incorrect fleet/root, enabling auditable disqualification. Malformed accounts/unauthorized callers still error.
`claim_timeout()` validates phase deadline and advances to appropriate claimant/audit state.
`cancel_game()` only before join or after permitted lobby expiry.
`deposit_stake()` optional; validates exact mint/amount and one deposit per player.
`claim_payout()` optional; requires VerifiedFinished and claimant is audited winner, no prior payout.
`refund_stake()` optional; requires Cancelled or NoVerifiedWinner, one refund per depositor.

## 8. Deadline and claim semantics
A phase's deadline is set only when entering that phase, not on arbitrary account touches. Use `Clock::get()?.unix_timestamp` with checked additions. A late `respond` cannot succeed after expiry even if `claim_timeout` has not been called. Claims may be permissionless but winner/audit rights are constrained. The provisional winner must reveal own legal fleet for any route to VerifiedFinished. If both potential claimants fail/expire their audits, NoVerifiedWinner prevents any payout and allows equal refunds.

## 9. Evidence API/read model
No centralized trusted verification service required. `/watch/[id]` fetches game PDA and confirmed transactions (RPC or optional indexer) and shows shot coordinates/outcomes with exact signatures. Explorer URL: `https://explorer.solana.com/tx/<signature>?cluster=devnet`. Do not label a transaction verified until confirmed and state agrees. Provide a client-side verifier for fetched instruction data where available; missing proof history must be disclosed. A failed transaction is not a successful on-chain cheat event.

## 10. Session security and wallet UX
User signs `set_session` once; browser stores session private key in local storage or IndexedDB only with an explicit warning and best-effort encryption; do not call it secure against malicious scripts. Scope session to one game and a short expiry; allow revocation. Fund with minimal Devnet SOL and rate-limit client retries. If session setup unavailable, show honest wallet-approval fallback. “No popups per move” applies only while a valid authorized session is active.

## 11. Test matrix
1. Join rejects creator/self/third player/expired lobby.
2. Commit rejects duplicate/wrong player.
3. Fire rejects wrong turn, repeated cell, out-of-bounds, expired deadline, pending shot.
4. Respond accepts correct proof, rejects flipped bit, wrong salt, wrong sibling, wrong game, wrong player, wrong index, expired deadline.
5. 12 distinct verified hits produces provisional claimant only.
6. Legal claimant audit verifies root and shape and finalizes.
7. Illegal claimant audit transitions to opponent-audit; **does not revert leaving claimant eligible**.
8. Opponent audit success => verified winner; second invalid/expired => NoVerifiedWinner.
9. Attacker and defender inactivity yield proper provisional claimant and still require audit.
10. Sessions accept valid scoped move; reject wrong game, revoked/expired session and all money-moving instructions.
11. Stakes reject wrong mint, duplicate deposit, early payout, unauthorized payout, double payout; refund once each.
12. Cross-language golden vectors identical.
13. Browser bot can finish a full match via real transactions.
14. Spectator evidence shows real confirmed signature and rejects fake/unconfirmed state.

## 12. Acceptance and release
Release only after Anchor tests pass, Devnet program ID is published, two-player and bot flows are verified, winner-only audit works, spectator links resolve, and README states the fairness limitations. Stakes and NFT are optional and must not block core completion.
