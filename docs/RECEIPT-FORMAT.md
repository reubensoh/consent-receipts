# Receipt format v0 (PO and philosopher rulings applied 2026-09-29; lawyer approves final terms wording)

## The consent message the wallet displays and signs

Plain UTF-8 text. Line-oriented so every wallet renders it readably. This exact byte string is
what the user signs and what the receipt stores; the relay verifies against it byte for byte.

```
Consent receipt request
Version: consent-receipt/0

Service: Flair Health consent receipts (prototype)
Operator: Regal Pines Pte. Ltd.
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
  "org": { "service": "Flair Health consent receipts (prototype)", "operator": "Regal Pines Pte. Ltd.",
           "pubkey": "<base58>", "signature": "<base58 over receipt_hash>" },
  "time": { "issued_at": "...", "relay_signed_at": "..." },
  "receipt_hash": "<sha256 hex of canonical JSON of everything above except org.signature and anchor>",
  "anchor": { "cluster": "devnet", "program": "<id>", "pda": "<base58>", "tx": "<sig>", "slot": 0,
              "block_time": 0, "solscan": "https://solscan.io/tx/<sig>?cluster=devnet" }
}
```

Canonical JSON: RFC 8785 (JCS) via a small shared function in `packages/receipt`. Both sides
must produce identical bytes; the vitest suite pins a golden vector.

## Exported receipts from the shipped app

The app's receipts have their own canonical form and their own SHA-256 digest. This prototype
does not re-canonicalise them. It accepts the digest as 32 bytes, anchors it, and verifies the
anchor. Full signature verification of an exported receipt needs its schema, which the PO will
send as one example JSON when the export exists. Until then the verifier has two modes:
`verify --receipt <prototype.json>` (all checks) and `verify --digest <64 hex>` (anchor only).

## What is on chain

Only `receipt_hash` (32 bytes), the org pubkey as the signer/payer, the slot, the unix time,
and the PDA bump. Never the user's pubkey, never the item name, never a hash of the file itself.
The account address is the PDA of `["receipt", org, receipt_hash]`, so the org key is in the
address as well as in the data.

This is the fact the privacy line rests on, so here is the evidence. The test digest's anchor
account on devnet under the org-scoped seeds, dumped with
`solana account FfdETrPzRFvoUe7xz9wAJWViTr4LFwLSU3oYjajiEy1n -u devnet` on 2026-09-29:

```
Owner: 72NKbS2kpoxzwAyznfzmq6GuKqS1yQtdnBLzWxhfbbCh
Length: 89 (0x59) bytes
0000:   15 73 bb 26  52 4c 58 ab  | ba 78 16 bf  8f 01 cf ea   discriminator (8) | digest starts
0010:   41 41 40 de  5d ae 22 23  b0 03 61 a3  96 17 7a 9c   digest (32) ...
0020:   b4 10 ff 61  f2 00 15 ad  | 1f 62 3c d1  79 08 68 f5   ... digest ends | org pubkey starts
0030:   06 22 6f ed  4b a4 36 cc  fe 53 4a 87  f2 6f be 02   org pubkey (32) ...
0040:   74 2f eb ef  97 8b a8 75  | 54 84 22 1e  00 00 00 00   ... ends | slot (8, little-endian)
0050:   e2 da bb 6a  00 00 00 00  | fc                       unix time (8, LE) | bump (1)
```

Bytes 8..40 are sha256("abc") = `ba7816bf…15ad`, the test digest. Bytes 40..72 are the org key
`37WXBk…mr6G`. Slot 505578580 = `0x1E228454` and unix time 1790696163 = `0x6ABBDAE3`, both
little-endian. The address itself is derived from `["receipt", org, digest]`. Anyone can repeat
this dump; the layout is fixed by `ReceiptAnchor` in `programs/consent_anchor/src/lib.rs`.
(An earlier account, `6niv3F…t7tC`, was created under the pre-scoping seeds and is superseded.)
