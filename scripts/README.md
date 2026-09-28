# scripts

- `verify-receipt` (step 2): recompute hash, check user and org signatures, fetch the PDA on devnet.
- `bootstrap-org-key.sh` (done by hand on 2026-09-29): `solana-keygen new -o apps/relay/.keys/org.json`, then fund from the CLI wallet. The key is gitignored.
