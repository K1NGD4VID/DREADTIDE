# Progress

Updated 2026-11-08.

| Milestone | Status | Evidence |
|---|---|---|
| M1: scaffold and shared golden Merkle vectors | Complete | `cargo test --workspace`: 2 passed; `npm run test:crypto`: 3 passed; `npm run typecheck`: passed |
| M2: Anchor program and proof integration tests | Complete | Native `cargo test --workspace --target-dir target-windows`: 8 passed; CI SBF build and complete-match validator test passed in run `42388975297` |
| M3: claimant audit and timeout finality | Complete for tested path | Validator rejected forged proof, completed 12 hits, and verified claimant audit at 37,176 CU; CI run `42390006749` repeated the audit with default compute budget; native timeout and disqualification tests passed |
| M4: Devnet deployment and two-wallet UI | In progress | Program `BNFQudgxvwLNZNhj1aSTVXqzXpBn68jifArJ5xRCGUE4` deployed in slot `519718504`; live Devnet match completed with game `GLwivaP85C8bfVVpUC1PajnaVHNj1Xdn8anUDAdDz1f9` and verified audit transaction `4pkJGN...DqaD`; Phantom/Solflare UI and Vercel deployment in progress |
| M5: bot, spectator evidence, recovery | Not started | — |
| M6: scoped session signing | Not started | — |
| M7/M8: test-token escrow and badge | Deferred | Optional |

## Gameplay implementation milestones

| Milestone | Status | Evidence |
|---|---|---|
| Interactive fleet deployment | Complete | Four canonical ships can be selected, placed, rotated, moved, removed, randomized, reset, committed, exported, and restored. Fleet placement tests: 3 passed; crypto vectors: 3 passed; TypeScript and production build passed. |
| Browser PvP battle arena | Implemented; two-wallet QA pending | Functional own/enemy boards, fire and response transactions, private proof generation, timeout claims, claimant audit, terminal results, rematch, and Explorer-linked event history. Eight focused frontend tests passed; known Devnet match history reconstructed 23 `shotVerified` events. |

An Anchor program source and generated IDL are present. CI runs `42388975297` and `42390006749` built SBF binaries and passed the complete-match validator test after the SHA-256 syscall change, including without a custom compute budget. The program is deployed on Devnet: signature `4CRrke2ARXGZq4vCT5z3SacHUU6h1jdzVA3ZM7UAPx98rWcurB3p8MWv7RuLB3BAjBvLwrmPvtEkeNwFBHCLhYwZ`, slot `519718504`. A live Devnet match passed in 117 seconds and finalized its claimant audit at 37,026 CU. The two-wallet browser gameplay flow remains. Platform-tools v1.57 is a 531 MB archive; the local installer timed out and a direct download ran at roughly 7–20 KB/s. The test vectors are deterministic fixtures, not live game evidence.
