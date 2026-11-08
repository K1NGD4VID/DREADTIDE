# DREADTIDE

DREADTIDE is a two-player verified naval strategy game on Solana Devnet. Players stake D-Coins, arrange a private four-ship fleet on an interactive 8×8 board, commit its Merkle root, and battle under an authoritative five-minute clock. Every hit or miss requires a Merkle proof, and every provisional winner must audit the original committed fleet before stake settlement.

## Crypto gate

The fixed grid is 8×8 with four straight ships of lengths `[4,3,3,2]`. `fixtures/merkle-vectors.json` locks a deterministic 64-leaf tree, one occupied-cell path, and one empty-cell path. Rust and TypeScript independently derive the root and proofs and test tampering.

```sh
npm install
npm run test:crypto
npx vitest run tests/fleet-placement.spec.ts
npm run typecheck
cargo test --workspace --target-dir target-windows
```

The fixture may be regenerated with `npm run generate:vectors`; review and rerun both test suites after any crypto change.

On Windows, use `--target-dir target-windows` for native Rust tests so WSL's Rust compiler can use `target/` without mixing incompatible artifacts.

## Local validator gate (passed in CI)

The integration test in `tests/game.integration.spec.ts` requires a validator on `http://127.0.0.1:8899` with the DREADTIDE program loaded at the address in `app/idl/dreadtide.json`. GitHub Actions builds the SBF program, starts that validator, and runs `npm run test:local`. [Run 42388975297](https://github.com/K1NGD4VID/DREADTIDE/actions/runs/42388975297) passed the full 12-hit match, forged-proof rejection, and claimant audit at 37,176 CU. [Run 42390006749](https://github.com/K1NGD4VID/DREADTIDE/actions/runs/42390006749) passed with the standard transaction compute budget.

## Devnet match check

After deployment, copy `.env.example` to the ignored `.env` file and set `DREADTIDE_RPC_URL` and `DREADTIDE_FEE_PAYER_KEYPAIR`. Run `npm run test:devnet` from a trusted machine with a funded Devnet fee payer. The test sends real Devnet transactions, creates a fresh game account, and prints its address and the verified audit signature for Solana Explorer. Keep the keypair file and `.env` private.

## Browser gameplay

The current UI supports Phantom and Solflare, match creation and joining, live phase/deadline polling, interactive fleet placement, randomized valid fleets, commitment, and private recovery files. The battle arena supports targeting, `fire`, defender Merkle proof generation and `respond`, verified hit/miss history from program events, timeout claims, claimant audit, final results, and rematches. Recovery files contain the fleet seed and must be kept private.

## Security and timing

- Combat begins when the second valid fleet commitment lands and lasts exactly 300 on-chain seconds.
- Timed matches use a match-specific `BattleClock` PDA. A shot is accepted only when at least 30 seconds remain, and its defender receives a 30-second proof window.
- An unanswered shot is never recorded as a hit. Expiring its response window disqualifies the non-responsive defender and makes the attacker a provisional claimant who must still pass the fleet audit.
- Forfeits follow the same audit rule. A claimant who did not commit, submits an invalid board, or misses audit produces no verified winner and the contract refunds eligible stakes.
- Stake settlement is idempotent, linked to the match PDA, blocked before terminal verified/refund states, and reads authoritative profile balances.

## Current limits

- The [Devnet program](https://explorer.solana.com/address/BNFQudgxvwLNZNhj1aSTVXqzXpBn68jifArJ5xRCGUE4?cluster=devnet) is deployed; [deployment transaction](https://explorer.solana.com/tx/4CRrke2ARXGZq4vCT5z3SacHUU6h1jdzVA3ZM7UAPx98rWcurB3p8MWv7RuLB3BAjBvLwrmPvtEkeNwFBHCLhYwZ?cluster=devnet).
- A [complete Devnet match](https://explorer.solana.com/address/GLwivaP85C8bfVVpUC1PajnaVHNj1Xdn8anUDAdDz1f9?cluster=devnet) passed; its [claimant audit transaction](https://explorer.solana.com/tx/4pkJGNKMSVBzw6EVqJake9PhaiYQwg2A9tnt9qP45zHVDJvtmJ5ZurH5fsWHtPZfiGretNa8crres2mbHVkqDqaD?cluster=devnet) finalized at 37,026 CU.
- Wallet, fleet commitment, browser PvP, browser bot, spectator mode, D-Coin escrow, and match-scoped session authorization are implemented.
- The forfeit-audit and bounded-response release is deployed on Devnet. [Upgrade transaction](https://explorer.solana.com/tx/XrnEL196YkA3kHSshd2o4AciigjfJypc7zf7progiXNdnrhERFnnweHkrLYhj19EKs8VEAd8Mp3z33B7zwD8Nn8?cluster=devnet); [verified timed match](https://explorer.solana.com/address/CxcFzjLMbN49ymHNbjmKebRJE7j1uKHYaN1VM2GdqR58?cluster=devnet); [winner audit](https://explorer.solana.com/tx/2eZ3uBmQmgBYCjPKeWvhoum5nb41NHNCLwVoVhcg5dECL1fvUuxSiRJNi3iBz9mPGRzFRJLngZcphc2UEfT6H4Gi?cluster=devnet).

See [PROGRESS.md](PROGRESS.md) for gates and [DECISIONS.md](DECISIONS.md) for implementation decisions. The project specifications are in `docs/`.
