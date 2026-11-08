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
| P0 forfeit audit hardening | Complete and deployed | Forfeit now creates an audit claimant instead of a verified winner. Native tests cover valid audit, invalid audit, and uncommitted claimant fallback. Commit `745dc5b`; Devnet upgrade slot `520073149`. |
| P0 timed response protection | Complete and deployed | Compatibility-safe `BattleClock` PDA, immutable 300-second combat clock, 30-second proof window, no-hit non-response resolution, timed session and bot paths. CI `42496797102` and live Devnet match `CxcFzjLMbN49ymHNbjmKebRJE7j1uKHYaN1VM2GdqR58` passed. |
| P1 tactical plotting | Implemented | Private local markers, orthogonal follow-up hints after verified hits, and opt-in estimate heatmap derived only from verified outcomes. Focused tests: 2 passed; TypeScript and production build passed. |

The current Devnet program was upgraded from CI artifact SHA-256 `E32C1B85D49B8692CB58ECB9E05A421A7C5EE3783E40C88FCC81B052938B5ECA`: deployment transaction `XrnEL196YkA3kHSshd2o4AciigjfJypc7zf7progiXNdnrhERFnnweHkrLYhj19EKs8VEAd8Mp3z33B7zwD8Nn8`, slot `520073149`, deployed length 357,560 bytes. Live timed match `CxcFzjLMbN49ymHNbjmKebRJE7j1uKHYaN1VM2GdqR58` passed in 157 seconds; audit transaction `2eZ3uBmQmgBYCjPKeWvhoum5nb41NHNCLwVoVhcg5dECL1fvUuxSiRJNi3iBz9mPGRzFRJLngZcphc2UEfT6H4Gi` consumed 37,040 CU and settlement succeeded.
