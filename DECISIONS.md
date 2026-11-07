# Decisions

## 2026-11-07

- The PRD/SRD/technical plan are product specifications; the attached coding-agent prompt is treated as source material, while the user's request to build is the operative instruction.
- Keep the exact 64-leaf SHA-256 scheme and claimant-only audit described in the specs. An invalid response rejects the transaction; an invalid authorized audit must record a successful disqualification state change.
- Use the current official Solana frontend guidance when the wallet layer is implemented. The spec names a wallet adapter, but current Solana Next.js documentation uses Wallet Standard via `@solana/kit` and `@solana/react`. Verify compatibility with Anchor client calls before choosing the final integration.
- Build and test on localnet before any Devnet deployment. No program ID, transaction, or live evidence will be claimed until observed.
- The initial `declare_id!` placeholder was replaced with the public key of the locally generated program keypair using `anchor keys sync`. This is a candidate program address, not a deployed ID until a Devnet transaction confirms it.
- Anchor 1.2.2 documentation uses `@anchor-lang/core` for its TypeScript client, superseding the attached plan's `@coral-xyz/anchor` package. The future client must pin versions compatible with Anchor 1.2.2 and the selected wallet stack.
- Anchor CLI is being installed directly in WSL at version 1.2.2. `Anchor.toml` omits `toolchain.anchor_version` because that setting requires AVM.
- The local platform-tools v1.57 download timed out. GitHub Actions will build the same source with the official Solana CLI and upload the small SBF binary for local validator testing. This does not deploy or sign any transaction.
- The complete-match validator test reached claimant audit but pure Rust SHA-256 exceeded the 1,400,000 CU transaction ceiling. Use `solana-sha256-hasher` for the same byte-compatible hashes; its Solana target calls the runtime SHA-256 syscall. Shared golden vectors continue to guard parity.
