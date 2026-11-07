# DREADTIDE — Product Requirements Document
**Version:** 2.0 | **Status:** Build-ready specification | **Platform:** Solana Devnet | **Track:** Gaming

## 1. Executive summary
DREADTIDE is a fast, competitive two-player naval strategy game. Each captain secretly places a fleet on an 8×8 ocean, commits its Merkle root to Solana, and takes turns firing at enemy cells. The defender supplies a Merkle proof for each hit or miss; the program accepts only proofs consistent with the committed board. Spectators can inspect accepted moves and corresponding Solana Explorer transactions. Players can delegate limited match actions to an ephemeral session signer, avoiding a wallet approval for every shot after a one-time authorization.

**Tagline:** Trust no captain. Verify every shot.

**Player fantasy:** Outthink your opponent, find their hidden ships, and win a tactical duel whose critical outcomes can be independently verified.

**Why Solana:** Cheap, fast-settling on-chain actions make proof-backed turns practical; limited session authorization enables fluid gameplay; public transactions make the evidence inspectable; optional SPL-token escrow enables referee-free stake settlement. “Instant” describes responsive UI and fast confirmation, not guaranteed zero-latency finality or zero fees.

## 2. Problem and opportunity
Ordinary online hidden-information games require players to trust the game operator to enforce board immutability and resolve disputes. DREADTIDE replaces that trust with a public commitment, program-verified individual responses, explicit timeout rules, and an audit of the **claimant's own board before a victory becomes final or any stake can be paid**.

This is a competitive game, not a claim to be the first blockchain naval game. The value proposition is playable tactics plus inspectable evidence, not a novelty claim.

## 3. Audience and user journeys
- **Competitive player:** connect wallet once, host or join, arrange ships, commit, play a rapid match with a session key, inspect the result.
- **Solo demonstrator:** play against a clearly labeled browser-controlled bot using the same on-chain rules.
- **Spectator/judge:** open a read-only match page, inspect confirmed attacks, verify proof data, and open relevant transactions on Solana Explorer.
- **Optional staked player:** explicitly opt into equal stakes using a configured Devnet SPL test mint; winner receives funds only after successful claimant audit.

## 4. Core gameplay
- Grid: 8×8; index `i = y*8+x`, x/y ∈ [0,7].
- Fleet: four straight, non-overlapping ships of lengths [4,3,3,2], touching permitted; 12 occupied cells.
- Each player commits a root before any attack. The creator attacks first.
- An attack is a public coordinate; **no attack commit–reveal**.
- Only one unresolved attack exists. Defender answers with claimed `is_ship`, salt, and a six-sibling Merkle path.
- The program verifies the response against the defender's locked root and the exact cell index. Accepted hits increase the hit counter; accepted misses do not. The next attacker is the previous defender.
- A player who scores 12 distinct verified hits against the opponent becomes the **provisional winner**, not yet the final winner.
- The provisional winner must reveal **only their own board** (seed and four ship placements) before the audit deadline. The program rebuilds the Merkle root and checks all four ship shapes. Valid audit => verified victory; invalid audit or expired audit => opponent wins by disqualification/forfeit, subject to the same winner-audit requirement before payout.
- **No rule requires both players to reveal their boards.** The loser cannot be forced to cooperate.

### Important fairness limitation
A malicious player can commit an illegal fleet and remain hard or impossible to defeat by the 12-hit route. That player cannot receive a **verified** victory or stake payout without auditing their own board. This is an economic/integrity safeguard, not a guarantee that every opponent's initial board was legal. A timeout or forfeit is a **procedural result**, not evidence that the absent player's board was valid.

### Audit of a forfeit beneficiary
Any player about to become the final winner—whether by 12 hits, opponent timeout, or opponent's invalid/expired audit—must pass their own board audit before final victory/payout. If that claimant also fails or times out, resolve as **No Verified Winner**; refund any escrowed stakes under the specified refund rule. This prevents an illegal-board player from profiting through timeout paths.

## 5. Timeouts and abandonment
- Default action window: 120 seconds, counted using Solana Clock when the phase is entered.
- Default audit window: 300 seconds.
- Waiting for second player: host may cancel after lobby expiry; refund any funded stake.
- Waiting for board commitment: a committed player may initiate opponent-forfeit resolution after deadline; the beneficiary must still audit their own board.
- Waiting for attack: defender may initiate opponent-forfeit resolution after deadline.
- Waiting for defense proof: attacker may initiate opponent-forfeit resolution after deadline.
- Waiting for winner audit: opponent may initiate an audit-forfeit resolution after deadline; the new beneficiary must audit their own board.
- Repeated or irrelevant transactions never reset the action deadline.
- The chain does not execute timeouts automatically: a user/bot/spectator submits `claim_timeout` after expiry.
- If neither participant can produce a legal board audit, the result is **No Verified Winner** with stake refunds.
- Any claim of a verified win is reserved for a successful on-chain board audit.

## 6. Core features and priorities
| Priority | Capability | Acceptance condition |
|---|---|---|
| P0 | Host/join lobby | Two distinct wallets create/join an on-chain game |
| P0 | Fleet placement | UI validates 8×8 fleet before commitment |
| P0 | Merkle commitment | Root stored once and bound to game/player |
| P0 | Fire/respond | Correct turns; valid proof accepted; tampered proof rejected |
| P0 | Claimant-only audit | Only claimant reveals; legal board finalizes; invalid board cannot win |
| P0 | Phase deadlines | Abandoned game can be resolved without an operator |
| P0 | Solo browser bot | Uses actual program instructions; no fake battle results |
| P0 | Basic spectator evidence | Confirmed shot, outcome, proof-verification state, Explorer link |
| P1 | Session authorization | One wallet authorization; subsequent scoped actions without popups |
| P1 | Cheat Lab | Invalid proof rejected; illegal claimant board fails audit |
| P1 | Refined visual UX | Responsive tactical interface, move feedback, recovery |
| P2 | Optional test-token stakes | Equal SPL stakes escrowed and paid only to audited winner |
| Stretch | Victory NFT | Mint only after a verified final result |
| Cut | ZK, chat, XP, medals, audio, always-on bot VM, mainnet, real-money wagering |

**Critical scope rule:** No-stake gameplay must work independently of escrow. Session authorization is a central pitch feature; build it early enough to demonstrate, but do not falsely claim popup-free play if fallback wallet signing is active.

## 7. Spectator evidence and cheat demonstration
For every confirmed shot show match ID, shooter, defender, coordinate, claimed hit/miss, confirmation status, Merkle root, verified path where retrievable, transaction signature, and Solana Explorer Devnet link. “Verified on-chain” applies only to a successfully executed `respond` instruction. Failed transactions are labeled **Rejected attempt** and linked with their execution error; they are not fabricated as game-state events.

Cheat Lab includes: (1) submit a deliberately tampered response and show a rejected transaction or preflight simulation with explicit labeling; (2) create a controlled illegal-board claimant, attempt its audit, and demonstrate that no verified victory or payout occurs. An invalid audit should be recorded through a successful `audit_board` instruction that returns a disqualification outcome rather than reverting and leaving state unchanged.

## 8. Wallet and secret management
- Connect via Phantom/Solflare-compatible wallet adapter.
- A session key is an ephemeral keypair authorized by the wallet for **one game**, restricted instruction set, and expiry; it cannot withdraw stake or change opponent/game configuration.
- Fund session signer only with limited Devnet SOL for transaction fees. Provide revoke/expiry and clear warning that browser compromise can submit scoped game moves.
- Generate a cryptographically random 32-byte board seed; store locally with a downloadable recovery package. Do not assume wallet `signMessage` is deterministic or supported.
- Never transmit hidden board seed or full placement to an API before claimant audit; at audit the claimant intentionally reveals them publicly.

## 9. Optional stakes
Use only a configured Devnet SPL test mint in the hackathon demo. Both players must fund equal amounts into a program-owned token vault. No withdrawals before valid resolution except explicit cancel/refund paths. `claim_payout` requires a finalized audited winner; `refund_stakes` handles cancelled/no-verified-winner cases. No stake payouts on provisional wins, timeouts alone, or rejected proofs. Apply token account ownership/mint checks, checked arithmetic, and single-settlement guards.

## 10. Demo script (90–120 seconds)
1. Open DREADTIDE, explain tactics and the 8×8 fleet.
2. Connect wallet and authorize one-game session key.
3. Play several rapid moves against browser bot without per-shot wallet prompts; show actual transaction confirmation.
4. Open a shot on Solana Explorer; show spectator proof evidence.
5. Attempt a tampered proof; show explicit rejection.
6. Use a pre-seeded short demonstration to reach 12 hits, then audit **only the winner's board**; show verified victory.
7. Optionally show test-token escrow settlement after audit.

## 11. Success metrics and acceptance
- Two wallets or wallet + browser bot finish an actual Devnet match.
- Valid Merkle proof accepted, modified proof rejected in automated tests and demo.
- A legal claimant audit finalizes; illegal or missing claimant audit cannot yield a verified win.
- Timeout path is deterministic and does not depend on an always-on server.
- Spectator can inspect a confirmed shot with a real Explorer link.
- If session keys are claimed in the pitch, demonstrate at least three consecutive game actions without per-action wallet approvals.
- No fabricated on-chain data or unqualified “cheater caught” assertions.

## 12. Hackathon delivery and integrity
Event: MLH Solana Hackathon, Nov 6–8, 2026; Gaming track and overall consideration subject to official rules. Treat published submission deadlines as externally verified requirements before final upload; do not infer eligibility from this document. Maintain a truthful provenance/credits section for all prior inspiration, libraries, and assets **without using another project's name in this specification**. A request to omit a name from product docs does not remove any organizer-required prior-work disclosure.

## 13. Risks and mitigations
- Cross-language hash mismatch => shared golden vectors before program logic.
- Solana transaction latency => optimistic pending UI; never label pending actions confirmed.
- Invalid winner board => claimant-only audit and no payout before valid audit.
- Both players fail audit => No Verified Winner and refund.
- Session signer misuse => per-game instruction scope, expiry, limited fee balance.
- Browser bot cannot act while browser is closed => explicitly label browser-local bot; no always-on claims.
- RPC outages => retry reads, surface unknown/pending state, never fabricate verification.
- Large final audit computation => benchmark 64-leaf SHA-256 rebuild under compute budget; adjust implementation if needed.

## 14. Decisions frozen for MVP
8×8; fleet [4,3,3,2]; SHA-256 Merkle tree depth 6; public shots; claimant-only audit; session authorization scoped to match; Devnet only; optional stakes; no ZK or always-on services.
