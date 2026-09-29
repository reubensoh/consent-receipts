# Brief 002: step 1, wallet sign-in, signed consent, local receipt

**Status: DRAFT, not issued. Issue only after brief 001 is closed (one brief per engineer).**

To: engineer 1. From: architect.

## Goal

The first two of the four beats the judge must feel: the sheet pops and the wallet signs. A
browser app where a user connects Phantom, signs in against the relay, sees a hardcoded consent
sheet, approves with the wallet's own sign-message dialog over the human-readable consent text,
and gets a receipt rendered locally. Decline is one tap and also yields a receipt. No vault, no
model, no org signature, no anchor yet.

## Done means (docs/PLAN.md, step 1)

1. `npm run dev -w apps/web` serves a Vite + React + TypeScript app. Phantom (devnet) connects via
   `@solana/wallet-adapter-react`; Solflare is the tested fallback.
2. Sign-in: the app POSTs `{pubkey}` to the relay's `/session/challenge`, asks the wallet to
   `signMessage` over the returned text byte for byte, POSTs `{pubkey, message, signature}` to
   `/session/verify`, and keeps the token in memory (not localStorage). The wallet address
   appears in no URL, ever: check the network tab and the address bar and say so in the PR.
   Use `signMessage` over the relay text; do not use the wallet-adapter `signIn` feature unless
   you prove the wallet's constructed message equals the relay's text byte for byte.
3. Consent sheet: a hardcoded `ConsentRequest` (item `Documents/lab-report.md`, a fake sha256,
   a purpose, provider OpenAI, model placeholder, the terms lines from docs/RECEIPT-FORMAT.md)
   rendered as OUR sheet with the header "Service: Flair Health consent receipts (prototype).
   Operator: Regal Pines Pte. Ltd." and every field the wallet will show. Build the text with
   `buildConsentText` from `@consent-receipts/receipt`; call `assertSafeField` on every
   free-text field before building. Show the exact text that will be signed in a collapsible
   "what you will sign" block.
4. Approve: `signMessage` over that text. Verify the signature in the browser with tweetnacl
   against the connected pubkey before showing anything green. Render the receipt JSON from
   docs/RECEIPT-FORMAT.md with `decision: "APPROVE"`, `user.signature` filled, `org_signature`
   and `anchor` null, `receipt_hash` computed with `receiptHash`. Offer "Download receipt".
5. Decline: one tap, no wallet dialog. Render a `DECLINE` receipt with `user.consent_text` and
   `user.signature` null and `file.sha256_relay` null. The screen says "asked, refused, nothing
   sent". No "keep a signed copy" option yet.
6. `packages/receipt`: make `org_signature: string | null` and add a test that a step-1 receipt
   (org and anchor null) hashes deterministically. Keep the existing golden test green.
7. Copy discipline: use only wording from docs/CLAIMS.md. "signed", "anchored", "verifiable".
   Never "legally binding", "notarised", "deleted", "Consent Compact".
8. A screen recording (or 6 screenshots) in the PR: connect, sign-in dialog, sheet, wallet
   dialog showing the consent text, approve receipt, decline receipt.

## Files

- `apps/web/` new: Vite + React + TS. Dependencies: `@solana/wallet-adapter-react`,
  `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets` (Phantom, Solflare),
  `@solana/web3.js` 1.x, `tweetnacl`, `bs58`, `@consent-receipts/receipt`. Add `apps/web` to
  the root `typecheck`/`test`/`build` chain (root package.json already globs `apps/*`).
- `packages/receipt/src/receipt.ts` and its test, for item 6 only.
- Do not touch `apps/relay`, `packages/anchor-client`, `programs/`, `scripts/`. If the relay
  needs a CORS header for the Vite origin, say so in the PR and I will add it (or add
  `hono/cors` for `http://localhost:5173` only, in one commit, clearly labelled).

## How to run the relay locally

`cp apps/relay/.env.example apps/relay/.env`, set `SESSION_SECRET` to 64 hex chars, leave the
OpenAI fields empty (unused in step 1). You need an org keypair file only to start the server:
generate a throwaway with `solana-keygen new -o apps/relay/.keys/org.json` on your own machine;
never the PO's. `npm run dev -w apps/relay` listens on :8787.

## Do not

- Run `anchor build` or deploy anything. The program is already on devnet.
- Store the token, the signature, or the receipt in localStorage in this step.
- Put the wallet address in a query string, a path, or a log line.
- Invent terms wording. Use the lines in docs/RECEIPT-FORMAT.md as they are.

## Delivery (paste block; relay only after 001 closes)

~~~
Brief 002 from the architect: step 1, wallet sign-in, signed consent, local receipt.

Goal: the first two beats the judge must feel. A browser app where a user connects Phantom,
signs in against the relay, sees a hardcoded consent sheet, approves with the wallet's own
sign-message dialog over the human-readable consent text, and gets a receipt rendered locally.
Decline is one tap and also yields a receipt. No vault, no model, no org signature, no anchor.

Pull main first; the relay routes you need exist (README, "Relay").

Done means:
1. npm run dev -w apps/web serves a Vite + React + TypeScript app. Phantom on devnet connects
   via @solana/wallet-adapter-react; Solflare is the tested fallback.
2. Sign-in: POST {pubkey} to the relay's /session/challenge, ask the wallet to signMessage over
   the returned text byte for byte, POST {pubkey, message, signature} to /session/verify, keep
   the token in memory only. The wallet address appears in no URL, ever; check the network tab
   and the address bar and say so in the PR. Use signMessage over the relay text; do not use the
   wallet-adapter signIn feature unless you prove the wallet's constructed message equals the
   relay's text byte for byte.
3. Consent sheet: a hardcoded ConsentRequest (item Documents/lab-report.md, a fake sha256, a
   purpose, provider OpenAI, model placeholder, the terms lines from docs/RECEIPT-FORMAT.md)
   rendered as OUR sheet with the header "Service: Flair Health consent receipts (prototype).
   Operator: Regal Pines Pte. Ltd." and every field the wallet will show. Build the text with
   buildConsentText from @consent-receipts/receipt; call assertSafeField on every free-text
   field first. Show the exact text to be signed in a collapsible "what you will sign" block.
4. Approve: signMessage over that text. Verify the signature in the browser with tweetnacl
   against the connected pubkey before showing anything green. Render the receipt JSON from
   docs/RECEIPT-FORMAT.md with decision APPROVE, user.signature filled, org_signature and
   anchor null, receipt_hash from receiptHash. Offer "Download receipt".
5. Decline: one tap, no wallet dialog. Render a DECLINE receipt with user.consent_text,
   user.signature and file.sha256_relay all null. The screen says "asked, refused, nothing
   sent". No "keep a signed copy" option yet.
6. packages/receipt: make org_signature nullable (string | null) and add a test that a step-1
   receipt with org and anchor null hashes deterministically. Keep the golden test green.
7. Copy: only wording from docs/CLAIMS.md. Never "legally binding", "notarised", "deleted",
   "Consent Compact".
8. A screen recording or six screenshots in the PR: connect, sign-in dialog, sheet, wallet
   dialog showing the consent text, approve receipt, decline receipt.

Files: apps/web/ (new; wallet-adapter react, react-ui, wallets for Phantom and Solflare,
@solana/web3.js 1.x, tweetnacl, bs58, @consent-receipts/receipt); packages/receipt for item 6
only. Do not touch apps/relay, packages/anchor-client, programs/, scripts/. If the relay needs
a CORS header for the Vite origin, say so in the PR, or add hono/cors for
http://localhost:5173 only in one clearly labelled commit.

Running the relay locally: cp apps/relay/.env.example apps/relay/.env, set SESSION_SECRET to
64 hex chars, leave the OpenAI fields empty. Generate a throwaway org keypair on your own
machine with solana-keygen new -o apps/relay/.keys/org.json (never the PO's). npm run dev -w
apps/relay listens on :8787.

Do not: run anchor build or deploy anything; store the token, signature or receipt in
localStorage; put the wallet address in a query string, path or log line; invent terms
wording.

Open a PR against main with the recording. I run it myself against the relay before merge.
~~~
