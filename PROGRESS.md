# Progress

Updated 2026-11-07.

| Milestone | Status | Evidence |
|---|---|---|
| M1: scaffold and shared golden Merkle vectors | Complete | `cargo test --workspace`: 2 passed; `npm run test:crypto`: 3 passed; `npm run typecheck`: passed |
| M2: Anchor program and proof integration tests | In progress | Native `cargo test --workspace --target-dir target-windows`: 8 passed; typed IDL generated; local validator test written but not yet run |
| M3: claimant audit and timeout finality | In progress | 12-hit provisional claim, legal audit, invalid-audit transition, and timeout-beneficiary audit pass native tests; on-chain integration not yet run |
| M4: Devnet deployment and two-wallet UI | Not started | No program ID or transactions |
| M5: bot, spectator evidence, recovery | Not started | — |
| M6: scoped session signing | Not started | — |
| M7/M8: test-token escrow and badge | Deferred | Optional |

An Anchor program source and generated IDL are present. Anchor SBF build, local validator tests, and deployment are still pending. Platform-tools v1.57 is a 531 MB archive; the installer timed out and a direct download ran at roughly 7–20 KB/s. The `declare_id!` value is a compile-time placeholder, not a deployed program ID. The test vectors are deterministic fixtures, not live game evidence.
