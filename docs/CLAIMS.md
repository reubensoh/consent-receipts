# Claims discipline

Every sentence shown to a judge, a user, or the public must be something an outsider can inspect.
Copy questions go to the philosopher via the PO. Legal questions go to the lawyer via the PO.

## Say

- "signed" (by the user's wallet key and by the organisation key)
- "timestamped" (by a Solana devnet slot and block time, plus the ISO times inside the receipt)
- "verifiable" (anyone with the receipt can recompute its hash, check both signatures, and find
  the hash on chain)
- "Whatever is not on the sheet was not consented."
- "The organisation is bound to what it declared." (bound = it signed it; not a legal term here)
- The sheet states OUR terms and CITES the provider's policy by date and link. It never quotes
  the provider's policy as our promise. (Philosopher ruling, 2026-09-29.)
- "not kept on our side". Never "deleted": the provider has its own retention window.
- Sheet header, fixed (philosopher, 2026-09-29): "Service: Flair Health consent receipts
  (prototype). Operator: Regal Pines Pte. Ltd." The operator name matches the holder of the org
  signing key and the copyright line; all three move together. Flair Health may be named.
- "Consent Compact" is a candidate name. It may appear NOWHERE until the PO confirms the IPOS
  trademark filing (amendment ratified 2026-09-30; filing in progress). Until then, the
  descriptive service line above.
- The privacy line ("nothing identifying the user goes on chain") rests on the account dump in
  docs/RECEIPT-FORMAT.md. Keep it current if the account layout ever changes.
- "anchored" for what the program does with a digest. Never "notarised".
- The "what a court would be shown" beat shows the artifacts an outsider can inspect: the
  receipt, the two signatures, the digest, the devnet account, the slot and block time. It never
  says what a court would decide.
- A decline receipt is the service attesting "asked, refused, nothing sent". The organisation
  signs both outcomes; the user signs only consent.

## Never say

- "legally binding", "legal proof", "court-admissible", "notarised", "notary"
- "prevents hallucination", "makes AI safe", "private from the model", "zero-knowledge"
- "the file never leaves your device" (it does, once, after consent; say that)
- "on-chain receipt" (the **hash** is on chain; the receipt is not)
- "deleted", "erased", "wiped" about anything on the provider side
- "anonymous" without the qualifier: anonymity of identity, never immunity of conduct
- Any product name, until the PO clears it

## Precise statements we can make about the flow

- The file is encrypted in the browser under a key derived from a wallet signature.
- The hash the user signs is computed after any metadata strip, so it binds what actually leaves
  the device.
- The relay hashes what it forwarded; the receipt carries both hashes and they must match.
- A decline also produces a receipt.
- The relay is stateless: it keeps no files, no receipts, and no wallet addresses after the
  request completes. (Verify against code before saying it.)
