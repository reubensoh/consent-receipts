# Brief 003: the receipt lands and Solscan verifies

**Status: ISSUED 2026-09-30, after brief 002 closed (merged as reubensoh/consent-receipts#2).**

To: engineer 1. From: architect.

## Goal

The last two of the four beats: the receipt lands, Solscan verifies. A mocked model request
raises the consent sheet; on Approve the relay verifies everything, co-signs with the operator
key, anchors the receipt hash on devnet, and returns the final receipt with a Solscan link. On
Decline the relay signs and anchors a decline receipt. The browser stops building receipts;
from now on only the relay does. No vault and no real model yet.

## Relay contract (apps/relay)

All routes need the session token. Nothing here may log a wallet address, a digest, file
bytes, or an IP. The relay keeps nothing after the response.

1. `POST /request/mock` with empty body. The mocked model "asks" for one file. Returns
   `{ pending, mac }`:
   - `pending = { id (uuid v4), item: "Documents/lab-report.md", purpose (<=140 chars),
     provider: "OpenAI", model (from OPENAI_MODEL or "gpt-mini-placeholder"), terms (the four
     lines in docs/RECEIPT-FORMAT.md, held in ONE constant in the relay), issuedAt, expiresAt
     (issuedAt + 5 min) }`
   - `mac = HMAC-SHA256(SESSION_SECRET, "pending|" + canonicalize(pending) + "|" + sessionPubkey)`,
     hex. It lets the stateless relay recognise its own request later and binds it to the wallet
     that was asked.
2. `POST /consent`, approve: `{ pending, mac, decision: "APPROVE", sha256, size, consent_text,
   signature, file_b64 }`. The relay checks, in this order, and answers 4xx with a short fixed
   error string on the first failure:
   - mac matches for (pending, session pubkey), constant-time compare
   - now < pending.expiresAt
   - `consent_text === buildConsentText({ request: { ...pending, sha256, size }, decision:
     "APPROVE", orgPubkey: <org key>, userPubkey: <session pubkey> })`, byte for byte
   - signature verifies over consent_text with the session pubkey
   - file bytes decode, length === size, size <= 1 MiB, sha256(bytes) === sha256
   Then: the mocked model "answers" with a fixed string (no real forwarding yet); the relay
   builds the `ReceiptBody` (it alone fills `file.sha256_relay` from its own hash and
   `time.relay_signed_at`), computes `receipt_hash`, signs `utf8(receipt_hash)` with the org
   key, anchors the hash with `deps.anchor`, and returns `{ receipt, answer }` with
   `receipt.anchor` filled. If anchoring fails, return 200 with `receipt.anchor: null` and
   `anchor_error: true`; the client may retry through the existing `POST /anchor {digest}`.
3. `POST /consent`, decline: `{ pending, mac, decision: "DECLINE" }` and nothing else. No hash,
   no size, no bytes: nothing about the file leaves the device. Checks: mac. (A decline after
   expiry is still recorded.) The relay builds a DECLINE body with every `file` field null and
   `user.consent_text`/`user.signature` null, signs, anchors, returns `{ receipt, answer }`
   where the mocked model answers without the file.
4. Inject the org signer and the anchor function through `Deps` (as `anchor` is today) so the
   tests never touch devnet or a real key file.
5. Tests (vitest, in `apps/relay/test/`): approve happy path verifies with
   `verifyReceiptOffline` and `receiptStatus === "verified"`; then one test each for wrong mac,
   a mac issued to another wallet, expired pending, consent text altered by one character,
   signature by another key, hash mismatch, size mismatch, oversize file, decline happy path,
   decline that smuggles a sha256 (must be ignored or rejected, never echoed into the receipt),
   anchor failure path. Rate limit still applies.

## Web (apps/web)

6. After sign-in the app calls `/request/mock`, reads a bundled synthetic fixture
   (`apps/web/src/fixtures/lab-report.md`, invent a plausible lab report for a fictional
   person, clearly marked SYNTHETIC in the file), computes its SHA-256 and size in the browser,
   and raises the sheet from `pending` + that hash and size. Delete `makeConsentRequest` and the
   browser-side receipt builders; the sheet's terms now come from the relay.
7. Approve: wallet signs, then POST /consent with the bytes. Show the relay's receipt through
   the existing `ReceiptView`. Headline comes from `receiptStatus`, as it does now.
8. New on the receipt view, the fourth beat: an "Anchored on Solana devnet" block with the
   Solscan transaction link, slot, and block time from `receipt.anchor`, plus an in-browser
   check that reads the anchor account with `@solana/web3.js` `getAccountInfo` and compares
   bytes 8..40 to `receipt_hash` and bytes 40..72 to the org key (layout in
   docs/RECEIPT-FORMAT.md, "What is on chain"). Show it as one more PASS/FAIL line. Do not
   import `@consent-receipts/anchor-client` in the browser; it is Node-only.
9. Decline: one tap, POST /consent decline, show the relay's signed and anchored decline
   receipt. The wallet is never called.
10. The downloaded receipt must pass the CLI: `npm run verify-receipt -w scripts -- --receipt
    <file>` prints all PASS for both an approve and a decline receipt. Put both outputs in the
    report.

## Already done for you on main (pull first)

- `packages/receipt`: `file` fields and `time.relay_signed_at` are nullable; `Check.pending`,
  `receiptStatus()`; decline rule requires every file field null. Do not change the package;
  report if it lacks something.
- `apps/web`: a fresh request per sheet, expiry check before signing, reset when the wallet
  changes, and a headline that follows the checks (my review fixes to brief 002; read the
  diff of commit "Review fixes for step 1" before you start).
- `apps/relay`: `npm run dev -w apps/relay` now loads `apps/relay/.env` itself.

## Known limit, do not solve

A stateless relay cannot remember a used request id, so one pending request approved twice
inside its five minutes yields two receipts. Note it in the report if you see a cheap fix;
do not build one.

## Do not

- Run `anchor build` or deploy. Do not touch `programs/`, `packages/anchor-client`,
  `packages/receipt`, `scripts/`.
- Use the PO's org keypair in tests; inject a generated one. For your own manual run against
  devnet, generate a throwaway org key and fund it with `solana airdrop 1 <pubkey>`; if the
  faucet refuses, say so and I will run the devnet pass.
- Log anything per request. Store anything in localStorage. Put an address in a URL.
- Invent or edit terms wording. The `<YYYY-MM-DD>` and `<url>` placeholders stay until the
  lawyer's wording arrives; they are one constant, so it is a one-line change later.
- `git add -A`. Stage explicit paths.

## Done means

PR against main with: the relay routes and tests; the web flow; a report at
`docs/briefs/003-report.md` listing per item what you ran and saw; the two CLI verifier
outputs; and screenshots of the sheet, the approved receipt with the anchored block, and the
declined receipt. I will run it with a wallet and against devnet before merging.

## Delivery (paste block)

~~~
Brief 003 from the architect: the receipt lands and Solscan verifies.

Brief 002 is closed: PR #2 is merged. Your build was sound and I ran it live with a
Wallet Standard stand-in wallet. I then fixed four things on main that my review found, in
the commit "Review fixes for step 1": the headline claimed "signed, verifiable" even when the
user-signature check failed; "Start over" reused the same request id and expiry; the draft
receipt filled fields only the relay can know (relay hash, relay time); and the session
survived a wallet switch. Pull main and read that commit first. The full brief is in
docs/briefs/003-receipt-lands.md on main; this block is the same content.

Goal: the last two beats. A mocked model request raises the sheet; on Approve the relay
verifies everything, co-signs with the operator key, anchors the receipt hash on devnet, and
returns the final receipt with a Solscan link. On Decline the relay signs and anchors a decline
receipt. The browser stops building receipts; only the relay does. No vault, no real model.

Relay (apps/relay). All routes need the session token. Log nothing per request. Keep nothing.
1. POST /request/mock, empty body. Returns { pending, mac }. pending = { id (uuid v4), item
   "Documents/lab-report.md", purpose (<=140), provider "OpenAI", model (OPENAI_MODEL or
   "gpt-mini-placeholder"), terms (the four lines in docs/RECEIPT-FORMAT.md, ONE constant in
   the relay), issuedAt, expiresAt (+5 min) }. mac = hex HMAC-SHA256(SESSION_SECRET,
   "pending|" + canonicalize(pending) + "|" + sessionPubkey).
2. POST /consent approve: { pending, mac, decision "APPROVE", sha256, size, consent_text,
   signature, file_b64 }. Check in order, 4xx with a short fixed string on first failure:
   mac (constant-time) for (pending, session pubkey); not expired; consent_text ===
   buildConsentText({ request: {...pending, sha256, size}, decision "APPROVE", orgPubkey,
   userPubkey: session pubkey }) byte for byte; signature over consent_text by the session
   pubkey; bytes decode, length === size, size <= 1 MiB, sha256(bytes) === sha256. Then a
   fixed mocked answer; build the ReceiptBody (relay alone fills file.sha256_relay and
   time.relay_signed_at); receipt_hash; org signature over utf8(receipt_hash); anchor via
   deps.anchor; return { receipt, answer } with receipt.anchor filled. If anchoring fails:
   200, receipt.anchor null, anchor_error true (client may retry via POST /anchor).
3. POST /consent decline: { pending, mac, decision "DECLINE" } and nothing else: no hash, no
   size, no bytes. Check mac only (a decline after expiry is still recorded). DECLINE body has
   every file field null and user.consent_text / user.signature null. Sign, anchor, return
   { receipt, answer }.
4. Inject the org signer and anchor function through Deps so tests never touch devnet or a
   key file.
5. Tests: approve happy path (verifyReceiptOffline, receiptStatus "verified"); one each for
   wrong mac, mac issued to another wallet, expired, consent text altered by one character,
   signature by another key, hash mismatch, size mismatch, oversize, decline happy path,
   decline that smuggles a sha256 (ignored or rejected, never echoed), anchor failure.

Web (apps/web).
6. After sign-in call /request/mock; read a bundled fixture apps/web/src/fixtures/lab-report.md
   (invent a lab report for a fictional person, marked SYNTHETIC in the file); compute SHA-256
   and size in the browser; raise the sheet from pending + hash + size. Delete
   makeConsentRequest and the browser-side receipt builders.
7. Approve: wallet signs, POST /consent with the bytes, show the relay's receipt in
   ReceiptView. Headline from receiptStatus, as now.
8. New block "Anchored on Solana devnet": Solscan tx link, slot, block time from
   receipt.anchor, plus an in-browser check using @solana/web3.js getAccountInfo comparing
   account bytes 8..40 to receipt_hash and 40..72 to the org key (docs/RECEIPT-FORMAT.md,
   "What is on chain"), shown as one more PASS/FAIL line. Do not import
   @consent-receipts/anchor-client in the browser; it is Node-only.
9. Decline: one tap, POST /consent decline, show the signed and anchored decline receipt. The
   wallet is never called.
10. The downloaded receipt must pass the CLI for both outcomes:
    npm run verify-receipt -w scripts -- --receipt <file>. Put both outputs in the report.

Already on main: packages/receipt has nullable file fields and relay_signed_at, Check.pending,
receiptStatus(), and a decline rule requiring every file field null. Do not change the package;
report if it lacks something. npm run dev -w apps/relay now loads apps/relay/.env itself.

Known limit, do not solve: a stateless relay cannot remember a used request id, so one pending
request approved twice inside five minutes yields two receipts. Note a cheap fix if you see one.

Do not: run anchor build or deploy; touch programs/, packages/anchor-client, packages/receipt,
scripts/; use the PO's org keypair in tests (inject a generated one; for a manual devnet run,
generate a throwaway org key and try solana airdrop 1 <pubkey>; if the faucet refuses, say so
and I will run the devnet pass); log per request; use localStorage; put an address in a URL;
edit terms wording (the <YYYY-MM-DD> and <url> placeholders stay until the lawyer's wording
arrives); git add -A.

Done means: a PR against main with the relay routes and tests, the web flow,
docs/briefs/003-report.md listing per item what you ran and saw, the two CLI verifier outputs,
and screenshots of the sheet, the approved receipt with the anchored block, and the declined
receipt. I run it with a wallet and against devnet before merging.
~~~
