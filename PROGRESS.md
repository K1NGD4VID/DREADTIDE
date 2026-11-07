# Progress

Updated 2026-11-07.

| Milestone | Status | Evidence |
|---|---|---|
| M1: scaffold and shared golden Merkle vectors | Complete | `cargo test --workspace`: 2 passed; `npm run test:crypto`: 3 passed; `npm run typecheck`: passed |
| M2: Anchor program and proof integration tests | In progress | Native `cargo test --workspace --target-dir target-windows`: 8 passed; CI SBF build succeeded; validator completed 12 hits and rejected forged proof |
| M3: claimant audit and timeout finality | In progress | Native audit tests pass; first validator audit exceeded default 200,000 CU. Explicit budget and measurement pending rerun |
| M4: Devnet deployment and two-wallet UI | Not started | No program ID or transactions |
| M5: bot, spectator evidence, recovery | Not started | — |
| M6: scoped session signing | Not started | — |
| M7/M8: test-token escrow and badge | Deferred | Optional |

An Anchor program source and generated IDL are present. CI built an SBF binary; the complete-match validator test failed at the audit compute limit. Devnet deployment remains pending. Platform-tools v1.57 is a 531 MB archive; the local installer timed out and a direct download ran at roughly 7–20 KB/s. The `declare_id!` value is a candidate program address, not a deployed ID. The test vectors are deterministic fixtures, not live game evidence.
