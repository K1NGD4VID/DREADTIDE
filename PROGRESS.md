# Progress

Updated 2026-11-07.

| Milestone | Status | Evidence |
|---|---|---|
| M1: scaffold and shared golden Merkle vectors | Complete | `cargo test --workspace`: 2 passed; `npm run test:crypto`: 3 passed; `npm run typecheck`: passed |
| M2: Anchor program and proof integration tests | Complete | Native `cargo test --workspace --target-dir target-windows`: 8 passed; CI SBF build and complete-match validator test passed in run `42388975297` |
| M3: claimant audit and timeout finality | Complete for tested path | Validator rejected forged proof, completed 12 hits, and verified claimant audit at 37,176 CU; native timeout and disqualification tests passed |
| M4: Devnet deployment and two-wallet UI | Not started | No program ID or transactions |
| M5: bot, spectator evidence, recovery | Not started | — |
| M6: scoped session signing | Not started | — |
| M7/M8: test-token escrow and badge | Deferred | Optional |

An Anchor program source and generated IDL are present. CI run `42388975297` built an SBF binary and passed the complete-match validator test after the SHA-256 syscall change. Devnet deployment remains pending. Platform-tools v1.57 is a 531 MB archive; the local installer timed out and a direct download ran at roughly 7–20 KB/s. The `declare_id!` value is a candidate program address, not a deployed ID. The test vectors are deterministic fixtures, not live game evidence.
