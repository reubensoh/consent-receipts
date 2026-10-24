# Brief 003 report: the receipt lands and Solscan verifies

From: engineer 1. To: architect. Built on `main` at `02b7db9`, branch `brief/003-receipt-lands`,
worktree `.claude/worktrees/brief+003-receipt-lands`. Stand-in wallet, throwaway operator key.

## Read this first: what is and is not verified

- **Not done: anything that needs funds on devnet.** `solana airdrop` was refused by the faucet at
  every amount I tried (1, 0.5, 0.2, 0.1 SOL: "rate limit is reached"), so my throwaway operator key
  has 0 SOL and **no receipt from my run is anchored.** I did not fund it from the PO's wallet.
  As the brief says: **I need you to run the devnet pass.** That covers the anchored receipt on
  screen, the Solscan link opening, and both CLI verifiers printing all PASS (steps below).
- **Not done: a local validator as a substitute.** `/tmp/flair_health_gate.lock` was held (and
  re-taken in short bursts, 10 s to 11 min runs of `tool/gate.sh`) while I worked. I tried once to
  start `solana-test-validator` through `scripts/build-lock.sh`; it refused with exit 75, so I
  stopped. Nothing of mine was started or left running, and I did not touch the lock. I did not hold
  the PO's machine for an optional extra when you had already planned the devnet pass.
- **Done and observed live:** everything up to and including the relay's co-signature, with the real
  app in a real browser against the real relay, using a Wallet Standard stand-in wallet (not
  Phantom: the real Phantom dialogs remain unverified, your P1). Details per item below.

## Per item: what I ran and saw

**1. `POST /request/mock`.** `apps/relay/src/consent.ts`, wired in `app.ts`. Tests: needs a session;
pending shape (uuid v4, fixed item/provider, `terms` equal to the constant, purpose <= 140,
`expiresAt - issuedAt` = 5 min, 64-hex mac); configured model is used; a model that could split a
line of the signed text stops the relay at startup. Live: the sheet appeared after sign-in, built
from the relay's pending request. `OPENAI_MODEL=` empty in `.env` counts as unset (the example file
ships it empty).

**2. `POST /consent` approve.** Checks in the brief's order: mac (constant-time), expiry, text
byte for byte, signature, then size cap, base64, length, hash. Short fixed 4xx strings. Tests, one
each: wrong mac, mac issued to another wallet, a pending request edited after issue, expired (410),
text altered by one character (signed and re-signed), signature by another key, hash mismatch,
size mismatch, 1 MiB + 1 (413), exactly 1 MiB (accepted), a 3 MiB body (413, cut off by a 2 MiB
body limit), malformed bodies. Happy path: `verifyReceiptOffline` all PASS,
`receiptStatus` "verified", relay fills `sha256_relay` from its own hash and `relay_signed_at` from
its own clock, the client cannot set `org`, `anchor`, `receipt_hash`, `file` or `time`, and the
body's fields agree with the signed text line by line. Live: approve returned a receipt with all 9
offline checks PASS (screenshot 2b).

**3. Decline.** Mac only; decline after expiry still recorded (tested, 1 h later). Every file field
null, `consent_text`/`signature` null. Any extra field (`sha256`, `size`, `file_b64`, `consent_text`,
`signature`) is **rejected** with 400, never echoed (the test greps the response for the smuggled
hash), and nothing is signed or anchored. Live: the stand-in wallet had been asked to sign 3
messages before I clicked Decline and 3 after: the wallet was never called.

**4. Injection.** `Deps` now carries `org: { pubkey, sign }`, `model`, optional `now`, and `anchor`.
`makeDeps` builds them from the real keypair. The tests generate their own org key, never read a key
file (the only file the tests read is `docs/RECEIPT-FORMAT.md`), and never touch devnet.

**5. Tests.** relay 41 (8 existing + 33 new), receipt 13, web 7: 61 pass, typecheck exit 0, build
ok. Also: rate limit on the new routes; **nothing is logged** on success, on every rejection, or on
an internal error (console spied). I then **mutation-checked the suite**: 13 deliberate breaks
(skip the mac, expiry, text, signature, size cap, length, hash, decline-extras checks; take the
relay hash from the client; omit the org signature; remove the silent error handler; drop the
wallet from the mac; remove the body limit): 12 killed. The survivor (relay hash taken from the
client) is an equivalent mutant: the hash check just before it makes the two values identical.

**6. Web sheet.** After sign-in the app calls `/request/mock`, hashes the bundled
`apps/web/src/fixtures/lab-report.md` (marked SYNTHETIC, 1,288 bytes) in the browser, and raises the
sheet from both (screenshots 1a, 1b). `makeConsentRequest`, `buildApproveReceipt`,
`buildDeclineReceipt` and their files are deleted; `grep` finds no reference left.

**7. Approve.** Wallet signs the sheet text, POST `/consent` with the bytes, relay's receipt shown in
`ReceiptView`. Live: the stand-in wallet's log of what it was asked to sign shows exactly two
messages, the sign-in text and the sheet text carrying that request's id. Headline now also follows
the anchor check (below): a receipt the relay could not anchor reads "Receipt: approved (not
anchored)", never a bare "approved".

**8. Anchored block.** `AnchoredBlock.tsx` shows the Solscan transaction and account links (built from
the signature, not from the relay's `solscan` string, and only if it looks like base58), slot, block
time, and one PASS/FAIL line from the browser's own read of the account (`lib/anchorCheck.ts`).
It checks more than bytes 8..40 and 40..72: that the address is the PDA of `["receipt", operator,
hash]` under the program, and that the program owns the account (a stranger's program can create an
account with any bytes). Read at `confirmed`, because a just-anchored account is not finalized.
*Verified without funds:*
- 7 unit tests against the **real devnet account dump published in `docs/RECEIPT-FORMAT.md`**
  (89 bytes): the derived address equals the real `FfdETr…Ey1n`; flipping any byte at 8, 39, 40, 71
  fails; wrong address, wrong owner, short data, malformed keys all fail without throwing.
- Live, in the browser, the app's own `checkAnchorOnChain` with a real `Connection` against devnet
  and the already-published "abc" anchor: real account **PASS**; same account with a wrong hash
  **FAIL**; wrong address **FAIL**.
- Screenshot 4 is a throwaway preview (deleted, not committed) rendering the block from that
  published test anchor with the slot and block time read from devnet at the time. It is **not** a
  receipt from this run.

**9. Decline in the UI.** One tap, relay builds, signs, tries to anchor; wallet never called (above).
Screenshot 3 shows it in the not-anchored state.

**10. CLI on the downloaded receipts.** Both files were produced by the real **Download receipt**
button (I captured its blob; 2,374 and 1,287 bytes) and are committed in `docs/briefs/003-evidence/`.
Run against devnet, **throwaway operator key, never anchored**:

```
$ npm run verify-receipt -w scripts -- --receipt docs/briefs/003-evidence/approve-notanchored.json
PASS  receipt_hash matches canonical body  27769ffee60908cb067b61f03a3ce43788897690915e739daf867373a16d8fc7
PASS  consent text present
PASS  consent text names this user
PASS  consent text carries this request id
PASS  consent text carries the file hash
PASS  consent text says APPROVE
PASS  user signature over consent text  2z1FuQ2cQAJULvc35SBdHvZwAyCLgSpRA6RJkhxvvcS1
PASS  client and relay file hashes match  8addd65f74331a6ab3a6759b4db4adff9695c65c80a4adc8a6da8b965297231d
PASS  org signature over receipt_hash  C2DvMQHkaNruwpxwtLLhtJtFyP1W4bc1VcjEgQNYksUS
FAIL  anchor: PDA exists for (org, digest)  none at 2UqwPtkumzzeWnF4UARQNgopqC9ENuRjjsWZWAXRBT9p for org C2Dv…YksUS
1 check(s) failed

$ npm run verify-receipt -w scripts -- --receipt docs/briefs/003-evidence/decline-notanchored.json
PASS  receipt_hash matches canonical body  bae4c8baec49cfc030b8508b2dbc3bee59d558b8cadb1ea64c3525e047969c7c
PASS  decline: no user signature, nothing sent  asked, refused, nothing sent
PASS  org signature over receipt_hash  C2DvMQHkaNruwpxwtLLhtJtFyP1W4bc1VcjEgQNYksUS
FAIL  anchor: PDA exists for (org, digest)  none at FgtcMJn4Ce2ahsxFUcqxi7ehFKvLcRX48aZidUNnm6ve for org C2Dv…YksUS
1 check(s) failed
```
So for both outcomes every offline check passes through the CLI's independent load path, and the
only failure is the on-chain lookup: there is no anchor to find. **The "all PASS" outputs the brief
asks for need the anchor; they are yours to produce.**

## Other things I checked live

- Network, from the browser pane's full log for the run (2 sign-ins, 2 requests, 2 consents, 1 anchor
  retry): only `POST`s plus their `OPTIONS` preflights to `/session/challenge`, `/session/verify`,
  `/request/mock`, `/consent`, `/anchor`; no GETs, no query strings. **No address in any URL**
  (`location.href` was `http://localhost:5173/` when I checked). `localStorage` held only the wallet
  adapter's `walletName` (checked twice); `sessionStorage` was empty.
- The relay printed **one line** (its startup banner) across two sign-ins, two requests, an approve,
  a decline, and two failed anchor attempts. The wallet address, file hash, receipt hashes and
  request ids appear nowhere in its output.
- "Retry anchoring" (the client retry you allowed): `POST /anchor` returned 502 "anchor failed", the
  page showed the error and kept the button. It fills `receipt.anchor` locally on success (outside the
  hash, so no signature changes); success was not exercised, needs funds.

## Your devnet pass

Relay: `apps/relay/.env` with `SESSION_SECRET` (64 hex) and the PO's org key at
`apps/relay/.keys/org.json` (`37WXBk…mr6G`, funded). `npm run dev -w apps/relay`, then
`npm run dev -w apps/web` (no `VITE_ORG_PUBKEY` needed: the browser's built-in operator key is the
published one). Connect, sign in, approve; expect "Receipt: approved" with the Anchored block and a
PASS line; download; run the verifier on it; then Start over, sign in, Decline, download, verify. For
a different operator key, set `VITE_ORG_PUBKEY` for the web app and use the same key in the relay (a
mismatch fails loudly with "consent text does not match the request"). `VITE_SOLANA_RPC_URL`
overrides the browser's RPC the way `SOLANA_RPC_URL` does the relay's.

## Findings the brief did not anticipate

1. **`verifyReceiptOffline` does not tie the body to the signed text.** It cross-checks the request
   id and the file hash only. A relay could sign a body whose `purpose`, `provider`, `model`,
   `terms`, `size`, `time.issued_at` or `org.pubkey` differ from the text the wallet showed, and the
   receipt would still verify. The body also lacks `expiresAt`, so the text cannot be rebuilt from
   it. Suggested: a field-by-field check of the text lines against the body, and `expires_at` in
   `request`. I pinned what **this relay** builds with a test; the package is untouched.
2. **`Receipt.anchor` cannot carry a null slot or block time, but `AnchorResult` can.** If the
   anchor tx lands but the RPC cannot yet read it, the relay reports `anchor_error` with a null
   anchor (tested), although the account exists; the retry then returns 409. Suggested: widen the
   type, or have `anchorDigest` retry `getTransaction` briefly.
3. **The signed terms say things the mock does not do.** Line 2, "sent once to the provider named
   above", is not true in mock mode: no provider is called, and the file is discarded after its hash
   is checked. I did not edit terms; the sheet now carries a note, and the mocked answer says so
   ("No model was called and nothing was sent to a provider"). It becomes true at step 4b. For the
   philosopher before the demo: a signed text that is false for the mocked demo.
4. **Hono's default error handler prints every exception to the console.** An unhandled throw would
   have broken "log nothing per request". `createApp` now installs a silent handler returning a
   fixed 500, with a test.
5. **The known limit, cheap fixes.** Two receipts differ only in `relay_signed_at`. (a) Stateful, tiny:
   an in-memory set of consumed request ids, pruned at expiry; it keeps ids for <= 5 minutes, so it
   bends "keeps nothing". (b) Stateless: make the hashed signing time deterministic per request (or
   leave it out of the hash); then a second approval of the same request is byte-identical, hence the
   same receipt hash, and the program's one-PDA-per-(org, hash) refuses it: the chain becomes the
   used-set. That changes what `relay_signed_at` means, so it is your call. A test documents today's
   behavior ("known limit: ... yields two receipts").
6. **The browser pins the operator key** (published constant, env override) rather than trusting one the
   relay hands it, so a relay with another key cannot get users to sign for an operator they did not
   expect. The alternative, `/request/mock` returning the key, is simpler to run but drops that property.
7. The 5-minute window is exclusive and truncated to whole seconds, so it is up to 1 s short. Each
   sheet costs two rate-limit tokens (`/request/mock` + `/consent`); a burst of retries can trip 10/min.
8. Equal-looking but different: `docs/RECEIPT-FORMAT.md` shows `org.signature` inside `org`; the
   code has `org_signature` beside `receipt_hash`. Not changed.

## What I did not do

- Fund the key from the PO's wallet, run a validator, or hold the lock (see the top).
- Verify with a real Phantom; the stand-in wallet signs exactly what it is given.
- Touch `programs/`, `packages/anchor-client`, `packages/receipt`, `scripts/`, README or HANDOVER
  (the README's "Routes" line now omits `/request/mock` and `/consent`; yours to update).
- Use `git add -A`; every commit stages explicit paths. `git ls-files .claude` is empty.

## Screenshots (`docs/briefs/003-screenshots/`)

`1a-sheet.jpg`, `1b-sheet-what-you-will-sign.jpg`: the sheet raised from the relay's pending request,
with the signed text expanded (the operator key shown is my throwaway key).
`2a-approved-not-anchored.jpg`, `2b-approved-offline-checks.jpg`: the approved receipt, all 9 offline
checks PASS, honestly "not anchored". `3-declined-not-anchored.jpg`: the decline receipt.
`4-anchored-block-published-test-anchor.jpg`: the Anchored block with real devnet data, **from the
published test anchor, not this run**. The approved receipt *with* the Anchored block is the one
screenshot I could not take.
