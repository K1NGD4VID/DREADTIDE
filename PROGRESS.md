# Progress

Updated 2026-11-07.

| Milestone | Status | Evidence |
|---|---|---|
| M1: scaffold and shared golden Merkle vectors | Complete | `cargo test --workspace`: 2 passed; `npm run test:crypto`: 3 passed; `npm run typecheck`: passed |
| M2: Anchor program and proof integration tests | In progress | Solana/Anchor CLI installation pending in WSL |
| M3: claimant audit and timeout finality | Not started | No on-chain implementation yet |
| M4: Devnet deployment and two-wallet UI | Not started | No program ID or transactions |
| M5: bot, spectator evidence, recovery | Not started | — |
| M6: scoped session signing | Not started | — |
| M7/M8: test-token escrow and badge | Deferred | Optional |

The Rust library is currently a crypto/fleet foundation. It is not yet an Anchor program and has not been deployed. The test vectors are deterministic fixtures, not live game evidence.
