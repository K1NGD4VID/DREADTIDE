# Decisions

## 2026-11-07

- The PRD/SRD/technical plan are product specifications; the attached coding-agent prompt is treated as source material, while the user's request to build is the operative instruction.
- Keep the exact 64-leaf SHA-256 scheme and claimant-only audit described in the specs. An invalid response rejects the transaction; an invalid authorized audit must record a successful disqualification state change.
- Use the current official Solana frontend guidance when the wallet layer is implemented. The spec names a wallet adapter, but current Solana Next.js documentation uses Wallet Standard via `@solana/kit` and `@solana/react`. Verify compatibility with Anchor client calls before choosing the final integration.
- Build and test on localnet before any Devnet deployment. No program ID, transaction, or live evidence will be claimed until observed.
- The initial `declare_id!` placeholder was replaced with the public key of the locally generated program keypair using `anchor keys sync`. This is a candidate program address, not a deployed ID until a Devnet transaction confirms it.
- Anchor 1.2.2 documentation uses `@anchor-lang/core` for its TypeScript client, superseding the attached plan's `@coral-xyz/anchor` package. The future client must pin versions compatible with Anchor 1.2.2 and the selected wallet stack.
- Anchor CLI is being installed directly in WSL at version 1.2.2. `Anchor.toml` omits `toolchain.anchor_version` because that setting requires AVM.
- The local platform-tools v1.57 download timed out. GitHub Actions will build the same source with the official Solana CLI and upload the small SBF binary for local validator testing. This does not deploy or sign any transaction.
- The complete-match validator test reached claimant audit but pure Rust SHA-256 exceeded the 1,400,000 CU transaction ceiling. Use `solana-sha256-hasher` for the same byte-compatible hashes; its Solana target calls the runtime SHA-256 syscall. Shared golden vectors continue to guard parity.

## 2026-11-08

- Fleet placement preserves the canonical ship order `[4,3,3,2]` used by both Merkle occupancy and the on-chain claimant audit. Ships may touch because the deployed program permits touching; overlap and out-of-bounds placement are rejected.
- Private fleet recovery uses a versioned local JSON record keyed by match and wallet. It contains placements, the 32-byte seed, and commitment root, and import recomputes the root before accepting the record. It never contains a wallet key.
- The deployed program currently uses a 900-second action window. The UI exposes that actual behavior; changing back to 120 seconds requires an explicit program timing decision.
- Forfeit is a concession, not proof of board legality. The forfeiter becomes audit-ineligible and the opponent must verify their original committed fleet. A missing/invalid claimant audit produces `NoVerifiedWinner`, allowing equal stake refunds.
- Timed matches use a separate `BattleClock` PDA instead of enlarging existing `Game` accounts. This preserves deserialization compatibility for existing matches. A high bit in `audit_attempts` marks the new instruction path; the low two bits retain claimant disqualification state.
- The authoritative battle deadline remains 300 seconds from the second fleet commitment. Each new shot requires at least 30 seconds remaining and creates a 30-second defender response deadline. An expired proof window never counts a hit; it disqualifies the non-responsive defender and sends the attacker through the normal fleet audit. If that audit fails, there is no verified winner.
- Tactical plotting remains private client state keyed by match and wallet. Adjacent suggestions and the optional heatmap use only verified public shot outcomes. The initial heatmap is deliberately labeled an estimate: it scores legal straight placements against confirmed misses and weights continuations through hits, but it does not inspect recovery files, claim exact posterior probabilities, or choose attacks automatically.
- Match/result animations are derived from confirmed transitions, never optimistic transactions. Match acceptance requires both stake-deposit flags; commencement requires the on-chain `FIRE` phase; payout/refund screens require `MatchStake.settled`, the audited winner, and the refreshed profile balance. Per-session transition keys prevent polling duplicates, and resuming an already-running battle does not replay the countdown.
