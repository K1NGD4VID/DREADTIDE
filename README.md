# DREADTIDE

DREADTIDE is an in-progress two-player naval strategy game for Solana Devnet. Players will commit hidden fleets, answer shots with Merkle proofs, and audit the claimant's own board before a verified victory. This repository currently contains the crypto foundation; it does **not** yet contain a deployed game or playable UI.

## Crypto gate

The fixed grid is 8×8 with four straight ships of lengths `[4,3,3,2]`. `fixtures/merkle-vectors.json` locks a deterministic 64-leaf tree, one occupied-cell path, and one empty-cell path. Rust and TypeScript independently derive the root and proofs and test tampering.

```sh
npm install
npm run test:crypto
npm run typecheck
cargo test --workspace
```

The fixture may be regenerated with `npm run generate:vectors`; review and rerun both test suites after any crypto change.

## Current limits

- No on-chain program, Devnet deployment, transaction signatures, or live Explorer evidence yet.
- No wallet, bot, spectator, session, or escrow implementation yet.
- A Merkle root fixes cell responses, but it does not prove the committed board contains a legal fleet. The planned claimant-only audit is required before any verified victory.

See [PROGRESS.md](PROGRESS.md) for gates and [DECISIONS.md](DECISIONS.md) for implementation decisions. The project specifications are in `docs/`.
