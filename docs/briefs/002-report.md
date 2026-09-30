# Brief 002 report: step 1, wallet sign-in, signed consent, local receipt

From: engineer 1. To: architect. Built against `main` at `0095fad`, on branch
`brief/002-step1-wallet-consent`, worktree `.claude/worktrees/brief+002-step1-wallet-consent`.

## What I built

`apps/web/`: Vite + React + TS app (`@solana/wallet-adapter-react` with Phantom and Solflare
adapters, per the brief). Flow: connect wallet → sign in against the live relay (`signMessage`
over the relay's own challenge text, never the wallet-adapter `signIn` feature) → hardcoded
consent sheet built with `buildConsentText` → Approve (wallet `signMessage` over the exact
consent text, receipt rendered and offline-verified) or Decline (one tap, no wallet dialog,
`DECLINE` receipt). Token kept in a React `useState`, never localStorage.

One relay change, in its own commit: added `hono/cors` scoped to exactly
`http://localhost:5173` (`apps/relay/src/app.ts`) — without it the browser blocks every relay
call. Nothing else in `apps/relay`, `packages/anchor-client`, `programs/`, or `scripts/` was
touched. `packages/receipt` was not changed; step 1 needed nothing from it that wasn't already
there.

## How I verified

```
$ npm run typecheck   # all 5 workspaces, 0 errors
$ npm test            # 12 receipt + 8 relay tests, all pass (apps/web has no tests: not asked for)
$ npm run build       # apps/web builds to dist/ (644 KB main chunk — the wallet-adapter-wallets
                       # bundle the brief itself specifies; not addressed, out of this brief's scope)
```

Ran both servers locally: `apps/relay` on :8787 (throwaway org keypair generated with
`solana-keygen new -o apps/relay/.keys/org.json`, never the PO's; `SESSION_SECRET` random
64 hex; `OPENAI_*` left empty per the brief — unused in step 1), `apps/web` on :5173.

**CORS, against the live relay:**
```
$ curl -s -X POST http://localhost:8787/session/challenge -H 'origin: http://localhost:5173' ...
access-control-allow-origin: http://localhost:5173
```

**Sign-in and receipt logic, against the live relay, with a synthetic ed25519 keypair standing
in for a wallet's `signMessage`** (same technique `apps/relay`'s own test suite uses) — this
exercises the exact code paths `App.tsx` calls, just without a browser wallet popup:
```
synthetic wallet pubkey: 31bRxHFALsd1bStGrsdnmQm6KMLYJgq2dqU7RUqXdLWF
POST /session/challenge → the SIWS-formatted message
signMessage(message) → POST /session/verify → {token}
buildConsentText(...) → the exact sheet text
signMessage(consentText) → buildApproveReceipt(...) → verifyReceiptOffline(...):
PASS  receipt_hash matches canonical body
PASS  consent text present
PASS  consent text names this user
PASS  consent text carries this request id
PASS  consent text carries the file hash
PASS  consent text says APPROVE
PASS  user signature over consent text
PASS  client and relay file hashes match
FAIL  org signature over receipt_hash          ← the one expected failure (brief §4)
buildDeclineReceipt(...) → verifyReceiptOffline(...):
PASS  receipt_hash matches canonical body
PASS  decline: no user signature, nothing sent
FAIL  org signature over receipt_hash          ← same expected failure
```
Exactly one check fails on APPROVE and DECLINE both, and it's the one the brief names. The
script that produced this was temporary and not committed (`apps/web/.verify-check.mts`,
deleted after the run).

**Wallet address never in a URL:** by code — `relay.ts` puts `pubkey` only in POST bodies and
the token only in an `Authorization` header (`apps/web/src/lib/relay.ts`); confirmed the same
structurally in `session.ts`/`app.ts`, which I didn't modify. I could not additionally confirm
this by eye in a live network tab, because sign-in never completed in a real browser (see "What
I could not do").

## Screenshots (`docs/briefs/002-screenshots/`)

1. `1-landing.jpg` — initial page, live app, real browser.
2. `2-select-wallet.jpg` — wallet-adapter's connect modal listing Phantom and Solflare, live app,
   real browser.
3. `3-sheet-what-you-will-sign.jpg` — the consent sheet with the collapsible block expanded,
   real component, real `buildConsentText` output.
4. `4-approve-receipt.jpg` — the approve receipt view: real `receiptHash`, a real ed25519
   signature (fixed-seed keypair, not a placeholder) verified by the real `verifyReceiptOffline`,
   showing exactly the one expected failure.
5. `5-decline-receipt.jpg` — the decline receipt view, same real functions.

Screenshots 3-5 are from a temporary second Vite entry (`apps/web/preview.html` +
`src/dev-preview.tsx`, deleted before this commit — never part of `apps/web`'s shipped code)
that renders `ConsentSheet`/`ReceiptView` directly with the request and receipts from the
synthetic-keypair run above, labeled "DEV PREVIEW — not the live app, no wallet involved" on
screen. I built this because I could not reach these screens through the real app (see below);
I did not want to claim a live wallet session that didn't happen. Every value on screen —
consent text, hash, signature, PASS/FAIL — is real output from the actual package functions and
was independently recomputed, not hand-typed.

## What I could not do

**No wallet extension was reachable, in either browser available to me,** so I could not
complete a real sign-in or produce the two wallet-native screenshots (the sign-in dialog, the
consent-text signing dialog) or a screen recording of the full flow:
- Built-in browser pane: Phantom and Solflare both show as options in the connect modal (they're
  registered by `@solana/wallet-adapter-wallets` regardless of whether the extension exists),
  but clicking either tries to redirect to `phantom.app`'s install page and throws
  `WalletNotReadyError` (visible in the console) — no extension is installed there.
  `WalletMultiButton`/adapter behavior, not a bug in this app.
- Claude in Chrome (the user's real Chrome): not connected this session
  (`tabs_context_mcp` → "Claude in Chrome is not connected").

This matches HANDOVER.md's own 2026-09-30 entry listing "Phantom in the separate profile" as
already waiting on the PO. I did not install a wallet extension anywhere myself — that changes
a real browser's configuration and felt like a call for you or the PO, not one to make alone in
an engineer session. Structurally, sign-in and approve both call `wallet.signMessage` on the
adapter's `useWallet()` result (`App.tsx`), never the `signIn` feature, exactly as required —
that much is confirmed by reading the code, not by clicking through it live.

## What the brief did not anticipate

- `tsc --noEmit` on `vite.config.ts` fails with a duplicate-`vite`-types error when two
  different `vite` copies get hoisted differently between the root and `apps/web`
  `node_modules` (an npm workspaces quirk, not particular to this repo). Fixed by not including
  `vite.config.ts` in `apps/web/tsconfig.json`'s `include` — Vite transpiles its own config file
  directly and never needed it type-checked by us.
- Node's `import.meta.env` (Vite-only) meant I couldn't literally import `src/lib/relay.ts` from
  a plain `tsx` verification script; I inlined the same two `fetch` calls instead and checked by
  eye that the request shapes match. Noting this in case a future step wants relay calls
  testable outside Vite.
- `docs/RECEIPT-FORMAT.md`'s terms line 3 contains literal placeholders (`<YYYY-MM-DD>`,
  `<url>`) that were never filled in (B3, the lawyer's policy-citation wording, is still open in
  QUESTIONS.md). The brief says "use the lines... as they are," so the sheet shows them
  literally, brackets and all — flagging in case that's not what "as they are" meant once a
  judge is looking at the screen.

## What I did not do (per the brief's "Do not")

- Did not touch `apps/relay` beyond the one labelled CORS commit, nor `packages/anchor-client`,
  `programs/`, or `scripts/`.
- Did not store the token, signature, or receipt in `localStorage` — React state only.
- Did not put the wallet address in a query string, path, or log line.
- Did not invent terms wording — the four lines are copied from `docs/RECEIPT-FORMAT.md`
  verbatim, placeholders included (see above).
- Did not modify `packages/receipt`; it already had everything step 1 needed.
