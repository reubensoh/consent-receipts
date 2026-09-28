# Receipt format v0 (PO and philosopher rulings applied 2026-09-29; lawyer approves final terms wording)

## The consent message the wallet displays and signs

Plain UTF-8 text. Line-oriented so every wallet renders it readably. This exact byte string is
what the user signs and what the receipt stores; the relay verifies against it byte for byte.

```
Consent receipt request
Version: consent-receipt/0

Service: consent-receipts (demo)
Operator: Reuben Soh
Operator key: <org pubkey base58>
Item: Documents/bloodwork.md
SHA-256: <64 hex>
Size: 2,113 bytes
Purpose: compare values to reference ranges
Provider: <provider name>
Model: <model id>
Terms (ours):
  - used only to answer this conversation
  - sent once to the provider named above, not kept on our side
  - we do not permit training on it; the provider's policy of <YYYY-MM-DD>: <url>
  - the provider has its own retention window; see that policy
Decision: APPROVE
Request ID: <uuid v4>
Issued at: 2026-10-05T14:03:11Z
Expires at: 2026-10-05T14:08:11Z
Signed by: <user pubkey base58>
```

`Signed by` is inside the text so a signature cannot be replayed for another wallet.
`Request ID` and `Expires at` stop replay across time.

**Decline is not wallet-signed.** Refusing is one tap. The organisation signs a decline receipt
with `decision: "DECLINE"`, `file.sha256_relay: null`, `user.signature: null`, and the same
request block, attesting "asked, refused, nothing sent". It is anchored like an approval.
Optional, off by default: after a decline the user may sign a copy ("keep a signed copy"),
which fills `user.consent_text` and `user.signature` with a `Decision: DECLINE` text.

## The receipt (JSON)

```json
{
  "version": "consent-receipt/0",
  "request": {
    "id": "<uuid>", "item": "Documents/bloodwork.md", "purpose": "...",
    "provider": "...", "model": "...", "terms": ["...", "..."]
  },
  "decision": "APPROVE",
  "file": { "sha256_client": "<hex>", "sha256_relay": "<hex or null on decline>", "size": 2113 },
  "user": { "pubkey": "<base58>", "consent_text": "<the exact text above, or null on decline>", "signature": "<base58 or null on decline>" },
  "org": { "service": "consent-receipts (demo)", "operator": "Reuben Soh",
           "pubkey": "<base58>", "signature": "<base58 over receipt_hash>" },
  "time": { "issued_at": "...", "relay_signed_at": "..." },
  "receipt_hash": "<sha256 hex of canonical JSON of everything above except org.signature and anchor>",
  "anchor": { "cluster": "devnet", "program": "<id>", "pda": "<base58>", "tx": "<sig>", "slot": 0,
              "block_time": 0, "solscan": "https://solscan.io/tx/<sig>?cluster=devnet" }
}
```

Canonical JSON: RFC 8785 (JCS) via a small shared function in `packages/receipt`. Both sides
must produce identical bytes; the vitest suite pins a golden vector.

## What is on chain

Only `receipt_hash` (32 bytes), the org pubkey as the signer/payer, and the slot. Never the
user's pubkey, never the item name, never a hash of the file itself.
