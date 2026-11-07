# DREADTIDE

DREADTIDE is an in-progress two-player naval strategy game for Solana Devnet. Players commit hidden fleets, answer shots with Merkle proofs, and audit the claimant's own board before a verified victory. The Anchor program has passed a complete-match local validator test. Devnet deployment and the playable UI are next.

## Crypto gate

The fixed grid is 8×8 with four straight ships of lengths `[4,3,3,2]`. `fixtures/merkle-vectors.json` locks a deterministic 64-leaf tree, one occupied-cell path, and one empty-cell path. Rust and TypeScript independently derive the root and proofs and test tampering.

```sh
npm install
npm run test:crypto
npm run typecheck
cargo test --workspace --target-dir target-windows
```

The fixture may be regenerated with `npm run generate:vectors`; review and rerun both test suites after any crypto change.

On Windows, use `--target-dir target-windows` for native Rust tests so WSL's Rust compiler can use `target/` without mixing incompatible artifacts.

## Local validator gate (passed in CI)

The integration test in `tests/game.integration.spec.ts` requires a validator on `http://127.0.0.1:8899` with the DREADTIDE program loaded at the address in `app/idl/dreadtide.json`. GitHub Actions builds the SBF program, starts that validator, and runs `npm run test:local`. [Run 42388975297](https://github.com/K1NGD4VID/DREADTIDE/actions/runs/42388975297) passed the full 12-hit match, forged-proof rejection, and claimant audit at 37,176 CU. [Run 42390006749](https://github.com/K1NGD4VID/DREADTIDE/actions/runs/42390006749) passed with the standard transaction compute budget.

## Devnet match check

After deployment, copy `.env.example` to the ignored `.env` file and set `DREADTIDE_RPC_URL` and `DREADTIDE_FEE_PAYER_KEYPAIR`. Run `npm run test:devnet` from a trusted machine with a funded Devnet fee payer. The test sends real Devnet transactions, creates a fresh game account, and prints its address and the verified audit signature for Solana Explorer. Keep the keypair file and `.env` private.

## Current limits

- The candidate program address is `BNFQudgxvwLNZNhj1aSTVXqzXpBn68jifArJ5xRCGUE4`. It is not deployed yet.
- No Devnet deployment, transaction signatures, or live Explorer evidence yet.
- No wallet, bot, spectator, session, or escrow implementation yet.
- A Merkle root fixes cell responses, but it does not prove the committed board contains a legal fleet. The planned claimant-only audit is required before any verified victory.

See [PROGRESS.md](PROGRESS.md) for gates and [DECISIONS.md](DECISIONS.md) for implementation decisions. The project specifications are in `docs/`.
