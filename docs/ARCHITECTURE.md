# Architecture

## Components

| Component | Runs | Holds | Never holds |
|---|---|---|---|
| Web terminal (`apps/web`) | browser | vault key (memory only), encrypted files (IndexedDB), receipts (IndexedDB + download) | provider key, org key |
| Relay (`apps/relay`) | PO's machine for Demo Day | provider API key, org keypair (env), in-memory per-wallet rate counters | files after the request, receipts, IPs, wallet addresses after the request |
| Anchor program (`programs/consent_anchor`) | devnet | receipt hash, slot, org key | receipt content, user address |
| Receipt package (`packages/receipt`) | both | canonicalisation, hashing, message text, `verify()` | state |

## Flows

### 1. Sign-in (no account)

1. User connects a wallet (Wallet Standard). Preferred: the `signIn` feature (Sign In With Solana).
   Fallback: `signMessage` over the same SIWS-formatted text.
2. Browser posts the signed sign-in to the relay in the **request body**, never the URL.
3. Relay verifies, then returns a short-lived session token (HMAC over pubkey + expiry, no store).
   The token travels in an `Authorization` header. No cookies, no email, no address in any URL.

### 2. Vault

- One folder, "Documents", three synthetic health files seeded on first sign-in (never a real
  person's data): a lab report (markdown), a scan image (JPEG with EXIF, so the strip shows),
  and a clinic letter (text).
- Key: `signMessage` over a fixed domain message ("Unlock vault ... v1") → HKDF-SHA256 →
  AES-256-GCM key, kept in memory only. Ed25519 signatures are deterministic per RFC 8032; verify
  this holds for the chosen wallet on step 3 before relying on it.
- Each file is metadata-stripped (EXIF for images; nothing else for Demo Day), then hashed
  SHA-256, then encrypted. The stored record is `{name, size, mime, sha256, ciphertext, iv}`.
  The hash binds what actually leaves the device.
- Known limit, stated openly: a signature-derived key can be re-derived by anyone who gets the
  user to sign the same message elsewhere. The key never leaves the browser; that is the whole
  protection for a demo.

### 3. Model request path (the four beats)

```
user: "Is my bloodwork normal?"
  → relay → provider (tool: request_file{path, purpose})
  ← model calls request_file("Documents/bloodwork.md", "compare values to reference ranges")
relay pauses the tool loop, returns a PENDING request {request_id, item, purpose, terms} to browser
BEAT 1  browser renders OUR consent sheet: exact item, hash, purpose, provider, model, terms
BEAT 2  Approve → wallet signMessage over the human-readable consent text (RECEIPT-FORMAT.md)
        browser decrypts the file, posts {consent text, user sig, bytes} to relay
        relay: sig valid? text matches request? sha256(bytes) == hash in text? rate limit ok?
        relay resumes the tool loop with the bytes as the tool result
        relay builds the receipt, signs its canonical hash with the org key
BEAT 3  relay anchors receipt hash on devnet (org key pays), returns receipt + model answer
        browser shows the receipt, stores it, offers download
BEAT 4  receipt shows a Solscan link to the anchor tx / PDA; verifier confirms hash + both sigs
```

Decline: one tap, no wallet signature (philosopher ruling). The browser posts the decline; the
relay builds a DECLINE receipt, signs it with the org key, anchors it, and resumes the tool loop
with the tool result `declined`. The model answers without the file. The user may optionally
sign a copy afterwards (off by default).

The relay pauses the provider tool loop while waiting for consent. Implementation: the relay
returns the pending tool call to the browser and keeps the conversation transcript client-side;
the browser posts the transcript back with the consent. This keeps the relay stateless.

### 4. Anchor

- Decided (PO, 2026-09-29): PDA per receipt. Memo only as a time fallback.
- Option A (built): PDA with seeds `["receipt", org, receipt_hash]`, storing
  `{receipt_hash, org: Pubkey, slot: u64, unix_time: i64, bump}`. The org key is in the seed
  (brief 001, check 5): a digest gets one slot per organisation, so a stranger who learns a
  digest cannot occupy the operator's slot for it. Creating the same PDA twice fails, which
  proves uniqueness per organisation. Solscan shows an account plus the creating tx.
- The program does not pin a single org key. Any funded key can anchor under its own slot.
  Trust in *which* org anchored is established by the verifier comparing the account's org
  against the org named in the receipt (bound by the org signature) or, in digest-only mode,
  against the operator's published key.
- Option B: SPL Memo instruction carrying the hex hash. Cheaper to build, nothing to query by
  hash without an indexer. Solscan shows the tx only.
- The org key pays. Rent for ~60 bytes is ~0.0013 SOL. The existing CLI wallet holds ~8.4 devnet
  SOL, enough for thousands of receipts; prefer a fresh org keypair funded from it (QUESTIONS C2).

### 5. Verification (what an outsider inspects)

`scripts/verify-receipt --receipt <receipt.json>` and, later, a "Verify" panel in the web app,
both using `verifyReceiptOffline()` from `packages/receipt` (hash, both signatures, internal
consistency; runs in Node and the browser) plus `fetchAnchor()` from `packages/anchor-client`
(the on-chain read). `--digest <64 hex> [--org <pubkey>]` runs the on-chain read alone for an
exported receipt from the shipped app (README, "The bridge"); `--org` defaults to the
operator's published key. Relay endpoint `POST /anchor {digest}` anchors any 32-byte digest
for a signed-in wallet, org key paying, rate-limited per wallet.
1. canonicalise the receipt body, recompute `receipt_hash` (prototype receipts only)
2. verify the user signature over the consent text with the user pubkey in the receipt, and
   that the text names that user, this request id, the file hash, and `Decision: APPROVE`
3. verify the org signature over `receipt_hash` with the org pubkey
4. fetch the PDA for (org, hash) on devnet; compare hash and org; read slot and block time
5. print PASS/FAIL per check. Never prints "legally binding".

Consent text safety: `buildConsentText` validates every field before building (no control or
invisible characters, no line separators, length caps, hex, uuid, ISO time, base58) and throws
otherwise, so no call site can produce a text with a second `Signed by:` or `Decision:` line
(brief 001, check 3).

## Provider

Must honor "not used for training" by default under its published API terms, or the sheet lies.
Decided (PO, 2026-09-29): OpenAI, a mini-class model, key on the PO's personal account with a
spend cap, placed in the relay's env file by the PO. The provider adapter is one thin file
(`apps/relay/src/provider.ts`) exposing `chat(messages, tools) -> {text | toolCall}` so the
provider can be swapped without touching the tool loop. The sheet states our terms and cites the
provider's policy by date and link; it never quotes the policy as our promise. Retention is the
provider's own window; we say "not kept on our side", never "deleted". The lawyer approves the
final wording before step 4b (QUESTIONS B3). The API key lives in
the relay's `.env` on the PO's machine only. Engineers build against a mocked provider until
step 4b.

## Stateless relay, concretely

- No database. No file system writes except logs that contain no bytes, no hashes, no addresses.
- Per-wallet rate limit: in-memory token bucket keyed by pubkey, reset on restart.
- IP is never logged or forwarded. Run behind nothing for Demo Day (localhost); if hosted later,
  put a reverse proxy in front and drop `X-Forwarded-For` before the app sees it.

## Stack

- Web: Vite, React, TypeScript, `@solana/wallet-adapter` (Wallet Standard), WebCrypto, IndexedDB.
- Relay: Node 24, TypeScript, Hono, `@solana/web3.js` 1.x + Anchor TS client 0.32 (matches
  coursework), chain access through `packages/anchor-client`. Sign-in: stateless HMAC challenge
  and token (`apps/relay/src/session.ts`), one-hour sessions, nothing stored.
- Program: Anchor 1.1.2, Rust 1.98 (matches `/Volumes/T7/solana/solana-fall-vault`).
- Tests: Rust unit tests for the program (`cargo test`, run by CI) plus LiteSVM integration
  tests behind `--features svm-tests` (need the built `.so`; run locally after
  `scripts/build-lock.sh anchor build`), vitest for `packages/receipt` and `apps/relay`, a
  scripted end-to-end run against devnet before every "done".
