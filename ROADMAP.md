# Roadmap (not in the Demo Day build)

Listed here so nobody builds them by accident before Oct 21.

1. **Payment, x402 pattern.** Pay-per-use per request, settled on Solana. Demo Day: one business
   slide only. At most a mocked devnet counter, and only if the PO asks for it.
2. **Multiple folders and topics.** Demo has one folder, "Documents", three files.
3. **Conversation compaction and handover** between sessions.
4. **Moderation per wallet.** Required the day the relay takes free text from strangers on a public
   host. Demo Day relay runs on the PO's machine for a known audience; still rate-limited per wallet.
5. **Organisation-side hash log.** Today the relay keeps nothing; a hash-only append log would let
   the org prove what it signed even if the user loses the receipt.
6. **Provider zero-data-retention tier.** The sheet states the provider's default policy; a ZDR
   agreement would let the terms say more.
7. **Hardware wallet and multisig org key.** Demo org key is a single keypair in the relay's env.
8. **Mainnet.** Never during the hackathon.
