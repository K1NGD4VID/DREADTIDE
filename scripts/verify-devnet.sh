#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$root/.env"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fee_payer="${DREADTIDE_FEE_PAYER_KEYPAIR_WSL:-$HOME/.config/solana/dreadtide-devnet.json}"

solana --keypair "$fee_payer" --url "$HELIUS_DEVNET_RPC_URL" \
  program show BNFQudgxvwLNZNhj1aSTVXqzXpBn68jifArJ5xRCGUE4
solana --keypair "$fee_payer" --url "$HELIUS_DEVNET_RPC_URL" balance
