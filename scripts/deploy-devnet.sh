#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$root/.env"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

program_key="${DREADTIDE_PROGRAM_KEYPAIR_WSL:-$HOME/.config/solana/dreadtide-program.json}"
fee_payer="${DREADTIDE_FEE_PAYER_KEYPAIR_WSL:-$HOME/.config/solana/dreadtide-devnet.json}"
binary="$root/target/deploy/dreadtide.so"
expected_program="BNFQudgxvwLNZNhj1aSTVXqzXpBn68jifArJ5xRCGUE4"

test -f "$binary"
test -f "$program_key"
test -f "$fee_payer"
test "$(solana-keygen pubkey "$program_key")" = "$expected_program"
test "$(solana-keygen pubkey "$fee_payer")" = "3kAKFhyHgRgyjU5cBcM4r2sLxqgq2uM67X11ykjU6tJ2"

solana program deploy "$binary" \
  --program-id "$program_key" \
  --keypair "$fee_payer" \
  --url "$HELIUS_DEVNET_RPC_URL"

bash "$root/scripts/verify-devnet.sh"
