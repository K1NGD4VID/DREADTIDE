# Decisions

## 2026-11-07

- The PRD/SRD/technical plan are product specifications; the attached coding-agent prompt is treated as source material, while the user's request to build is the operative instruction.
- Keep the exact 64-leaf SHA-256 scheme and claimant-only audit described in the specs. An invalid response rejects the transaction; an invalid authorized audit must record a successful disqualification state change.
- Use the current official Solana frontend guidance when the wallet layer is implemented. The spec names a wallet adapter, but current Solana Next.js documentation uses Wallet Standard via `@solana/kit` and `@solana/react`. Verify compatibility with Anchor client calls before choosing the final integration.
- Build and test on localnet before any Devnet deployment. No program ID, transaction, or live evidence will be claimed until observed.
- A valid arbitrary public key is used as the compile-time `declare_id!` placeholder. Replace it with a real deployment address through an approved signing setup before deployment; the placeholder must never be presented as a deployed ID.
- Anchor 1.2.2 documentation uses `@anchor-lang/core` for its TypeScript client, superseding the attached plan's `@coral-xyz/anchor` package. The future client must pin versions compatible with Anchor 1.2.2 and the selected wallet stack.
- Anchor CLI is being installed directly in WSL at version 1.2.2. `Anchor.toml` omits `toolchain.anchor_version` because that setting requires AVM.
