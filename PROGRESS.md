# Progress

Updated 2026-11-07.

| Milestone | Status | Evidence |
|---|---|---|
| M1: scaffold and shared golden Merkle vectors | Complete | `cargo test --workspace`: 2 passed; `npm run test:crypto`: 3 passed; `npm run typecheck`: passed |
| M2: Anchor program and proof integration tests | In progress | Native `cargo test --workspace`: 4 passed; local validator test written but not yet run |
| M3: claimant audit and timeout finality | In progress | Audit switch and double-failure state tests pass; on-chain integration not yet run |
| M4: Devnet deployment and two-wallet UI | Not started | No program ID or transactions |
| M5: bot, spectator evidence, recovery | Not started | — |
| M6: scoped session signing | Not started | — |
| M7/M8: test-token escrow and badge | Deferred | Optional |

An Anchor program source is present and compiles in native Rust tests. Anchor SBF build, local validator tests, and deployment are still pending. The `declare_id!` value is a compile-time placeholder, not a deployed program ID. The test vectors are deterministic fixtures, not live game evidence.
