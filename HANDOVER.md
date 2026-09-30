# Handover scroll

Read this first in a fresh session. Newest entry at the bottom. Facts only; opinions go in docs/.

## Standing facts

- PO: Reuben. Reads everything, decides everything, relays to the philosopher and the lawyer.
  This project knows nothing about his other company or codebases, on purpose. Do not ask.
- Working title: "Consent receipts for sharing data with AI". No brand until the PO clears one.
- Bindings: no token, devnet only, no real funds, hash only on chain, Apache-2.0, PO is sole
  submitter. Claims discipline in docs/CLAIMS.md.
- Coursework repos for pattern study only: /Volumes/T7/solana/ (Anchor 1.1.2, Rust 1.98,
  ts-mocha, codama in the fundraiser repo).
- Machine: macOS, 16 GB. Ask whether another build is running before any `anchor build`.
- Devnet CLI wallet exists with ~8.4 SOL (Sep 28). A fresh org key is proposed instead (C2).
- Deadlines: Demo Day Oct 19 and 21, 2026. Colosseum in November.

## Log

### 2026-09-28
- Session 1. Empty directory. Wrote README, ROADMAP, HANDOVER, docs/ARCHITECTURE,
  RECEIPT-FORMAT, PLAN, QUESTIONS, CLAIMS. No code, no git init, nothing pushed.
- Waiting on the PO: docs/QUESTIONS.md, especially A1-A4 (repo), B1 (provider), C1 (PDA vs
  memo), F1 (org display name), F4 (decline signed?).
- Next: on A1-A4, `git init`, add LICENSE, bootstrap workspaces (step 0), then brief the first
  engineer on step 1.

### 2026-09-29
- PO answered the five gating questions (see docs/QUESTIONS.md header). Rulings applied to
  CLAIMS, RECEIPT-FORMAT, ARCHITECTURE. Decline is NOT wallet-signed; org signs both outcomes.
- `git init` done, LICENSE + NOTICE added. PO created github.com/reubensoh/consent-receipts;
  pushed `main` over HTTPS (keychain credential). `gh` is not installed; use the REST API with
  curl to read CI status. First CI run: actions/runs/36523728700.
- Step 0: root npm workspaces; `packages/receipt` (canonical JSON, sha256, consent text builder,
  receipt hash) with 7 passing vitest tests and a pinned golden hash; `programs/consent_anchor`
  source written, NOT built (waiting on PO's answer about other builds on the machine);
  program keypair generated in target/deploy (gitignored), id 72NKbS…bbCh; org keypair at
  apps/relay/.keys/org.json (gitignored), pubkey 37WXBk…mr6G, funded with 1 devnet SOL from the
  CLI wallet; CI run 36523728700 green on both jobs (ts: typecheck, vitest, build; rust:
  `cargo test -p consent_anchor` compiles the program on the runner). SBF build and devnet
  deploy still pending build clearance on this machine.
- Next: PO answers H3 → `anchor build` → `cargo test` → deploy to devnet → brief engineer on
  step 1.

### 2026-09-29 (evening)
- Alignment from the PO and philosopher applied: copyright Regal Pines Pte. Ltd.; operator line
  follows it (flagged N1); OpenAI mini-class provider, one-file adapter; three synthetic health
  files; "anchored" never "notarised"; anchor and verifier accept any 32-byte digest (bridge to
  the shipped app's exported receipts). New open questions N1-N6 in docs/QUESTIONS.md, chiefly
  N2 (does the prototype journey still ship?) and N3 (what is the lock protocol?).
- Build cleared by the PO (Flair side idle). `anchor build` ok (130 KB .so). Deployed to devnet:
  program 72NKbS2kpoxzwAyznfzmq6GuKqS1yQtdnBLzWxhfbbCh, IDL initialised on chain, cost ~0.67 SOL
  from the CLI wallet (now ~6.7 SOL). IDL copy committed at programs/consent_anchor/idl/.
- Verified on running code: `scripts/anchor-digest` anchors a digest with the org key paying
  (tx 3v9np6…uJGe7, slot 505542093); second run on the same digest exits 3 ALREADY ANCHORED;
  `verify-receipt --digest` passes 3/3 and prints slot, block time, org; an unknown digest
  fails 1/1. Solscan page shows SUCCESS, signer = org key, program = ours. Account is 89 bytes:
  discriminator, digest, org key, slot, unix time, bump. Nothing identifying the user.
- NOT verified: `verify-receipt --receipt` (needs a receipt with real signatures, step 1);
  the relay `POST /anchor` endpoint and web verify panel do not exist yet.
- CI on the deploy commit: rust green, ts red (scripts typecheck ran before the receipt
  package was built). Fixed: root `typecheck` builds packages/receipt first. Run 36574179259 green on both jobs.
- Engineer 1's first brief written: docs/briefs/001-verify-step0.md.
- Next: PO answers N2/N3; step 1 brief after brief 001 closes; relay skeleton with POST /anchor.

### 2026-09-29 (night)
- Rulings applied: operator line confirmed; service line "Flair Health consent receipts
  (prototype)" (golden hash re-pinned); "Consent Compact" banned until the trademark filing is
  confirmed; full journey ships with the PO's priority order in PLAN.md; account dump with byte
  annotations kept in docs/RECEIPT-FORMAT.md as the privacy evidence.
- Lock protocol implemented: scripts/build-lock.sh (refuses on /tmp/flair_health_gate.lock,
  holds /tmp/consent_receipts_build.lock, removes it on any exit). Self-tested all four cases.
  ALWAYS run anchor build/deploy through it from now on.
- New: packages/anchor-client (IDL, PDA, anchorDigest); apps/relay (Hono; /health,
  /session/challenge, /session/verify, /anchor; stateless HMAC sessions; per-wallet token
  bucket; injected anchor fn so tests never touch devnet). 8 relay tests green.
- Verified end to end on devnet with a throwaway ed25519 key through the running relay:
  challenge → sign → token → POST /anchor 200 (tx 4kNgQD…nVMF, PDA 4ZThL1…EawD, slot
  505553299) → repeat 409 → no session 401. Relay stdout contained one startup line and no
  wallet, digest, or IP. CLI verifier passes 3/3 on that digest.
- Flair bridge: item 774 on their side, ~1 day; example receipt JSON to arrive as data.
- Next: brief 001 closes → step 1 brief (web app: wallet sign-in against these relay routes,
  consent text signing, local receipt). Web verify panel and court view later (6b).

### 2026-09-30
- Process rule from the PO: the engineer sees nothing unless relayed. Every brief file ends
  with one fenced paste block per recipient, self-contained, in my voice; the PO copies it
  verbatim. Added to PLAN.md ritual and memory. Brief 001 relayed by the PO; its paste block
  appended to the file as the record.
- Amendment to the ruling ratified: Flair Health's proof of concept under Regal Pines; code
  separation stands; "Consent Compact" allowed only once the PO confirms the IPOS filing.
- Brief 002 (step 1: wallet sign-in against the live relay routes, signed consent text, local
  receipt, one-tap decline) drafted at docs/briefs/002-step1-wallet-consent.md with its paste
  block. NOT issued; issue when 001 closes. Step 1 done-criteria in PLAN.md updated for the
  unsigned decline.
- Waiting on: brief 001 report PR; Phantom in the separate profile; Flair item 774 example JSON.
- Slip and fix: `git add -A` swept the engineer's session worktree (.claude/worktrees/brief+001-verify-step0, branch brief/001-verify-step0) into commit 0cf462f as a gitlink and it was pushed. Removed from the index in 3a0ccf2 and `.claude/worktrees/` is now ignored. The worktree itself was not touched. Rule from now on: stage explicit paths, never `-A`. Engineer sessions run as worktrees on this same machine, so the "no anchor build" rule in briefs is literal.

### 2026-09-30 (brief 001 closed)
- Engineer 1's report merged as PR #1 (a6101ff). I reproduced check 3 (spoof) myself; agreed
  with check 5 (unscoped PDA) and check 6 (`receipt.verify()` did not exist). All three fixed:
  - `buildConsentText` now validates every field itself (control and invisible chars, line
    separators, lengths, hex, uuid, ISO time, base58) and throws; tests cover the spoof.
  - Program PDA seeds are `["receipt", org, receipt_hash]`. Rust unit tests (size, seed
    scoping) run in CI; LiteSVM tests behind `--features svm-tests` (anchor once per org,
    stranger cannot squat, unsigned org rejected, 89-byte layout) run locally after the build.
    Dev-deps pinned to LiteSVM 0.16's ranges (keypair/signer major 3). The `emit!` event was
    removed to keep the binary ≤ 130672 bytes: devnet rejected every program-extend attempt
    (CLI auto-extend, `solana program extend`, and a raw legacy ExtendProgram instruction all
    return "invalid program argument"; the ExtendProgramChecked feature is inactive there).
    Upgraded in place at the same program id, slot 505578496.
  - `verifyReceiptOffline()` in packages/receipt (hash, both signatures, text-binding checks,
    decline rules; browser-safe), `fetchAnchor()` and `DEFAULT_ORG_PUBKEY` in
    packages/anchor-client; `verify-receipt` rewritten on top of them with `--org`.
  - `org_signature` is nullable for step-1 receipts.
- Verified on devnet after the upgrade: anchor-digest under new seeds (tx xj4r3H…i7fH, PDA
  FfdETr…Ey1n, slot 505578580); repeat exits 3; verify --digest 4/4 incl. org match; wrong
  --org fails; relay e2e (sign-in, POST /anchor 200, 409, 401, one log line) on PDA 6uJ49P…1jGz.
  New account dump in RECEIPT-FORMAT.md; old account 6niv3F…t7tC superseded.
- Known: on-chain IDL upgrade fails ("Failed to upgrade IDL", both via deploy and
  `anchor idl upgrade`); the on-chain IDL is the pre-scoping one. Clients use the committed
  IDL copy, so nothing depends on it; Solscan instruction decoding may lag. Low priority.
- `gh` is installed and authenticated (engineer's note); memory updated.
- Brief 002 revised for these fixes and ISSUED (paste block in the file).
- Wallet: ~6.72 devnet SOL after buffer recovery.

### 2026-09-30 (brief 002 closed, brief 003 issued)
- PO asked about a GitHub email "Run failed: ci - main (85849b0)". That is the old ts failure
  (typecheck ran before the receipt package was built), fixed in 596bf89 the same day; every
  run on main since is green.
- Reviewed PR #2 (apps/web, step 1): read every file, ran typecheck/test/build from a clean
  install, then drove the real app against the real relay in the browser pane with a Wallet
  Standard stand-in wallet injected through the console (WebCrypto Ed25519). Sign-in, sheet,
  approve, decline all work; the wallet is asked to sign exactly the sheet text; only POSTs to
  /session/challenge and /session/verify, no address in any URL; localStorage holds only the
  wallet adapter's `walletName`. Merged as b030d8c.
- Review findings, all confirmed live, fixed on main in "Review fixes for step 1":
  1. headline said "Signed, timestamped, verifiable" even when the user-signature check failed
     → headline now follows `receiptStatus()` (verified / awaiting-operator / failed);
  2. "Start over" reused the same request id and expiry → fresh request per sheet, and approve
     refuses after expiry;
  3. the browser draft filled relay-only fields (`sha256_relay`, `relay_signed_at`) → now null,
     shown as WAIT "awaiting operator";
  4. session survived a wallet switch → reset on pubkey change.
  Also: a DECLINE carries no file hash or size (all `file` fields null; verifier enforces it);
  `npm run dev -w apps/relay` loads `.env` (the README instruction did not work before);
  `.claude/` is fully gitignored; local `apps/relay/.env` created with a random SESSION_SECRET.
- NOT verified: the real Phantom dialogs (how Phantom renders the sign-in text and the
  22-line consent text). Needs the PO.
- Brief 003 issued (docs/briefs/003-receipt-lands.md): relay /request/mock + /consent
  (verify, co-sign, anchor), web wiring, anchored block with Solscan link, decline signed and
  anchored. Pulled ahead of the vault per the PO's priority order.
- Dev servers: `.claude/launch.json` has `relay` and `web` configs for the browser pane.

#### PO checklist: Phantom run
1. In the Chrome profile that has Phantom: Phantom → Settings → Developer Settings → turn on
   Testnet Mode and pick Solana Devnet. No funds are needed; the wallet only signs messages.
2. Terminal 1: `cd /Volumes/T7/consent-receipts-demo && npm run dev -w apps/relay`
   (expect "relay listening on :8787").
3. Terminal 2: `cd /Volumes/T7/consent-receipts-demo && npm run dev -w apps/web`, then open
   http://localhost:5173 in that Chrome profile.
4. Select Wallet → Phantom → connect. Click "Sign in with wallet". Screenshot Phantom's dialog.
   It should show readable text beginning "localhost wants you to sign in with your Solana
   account:".
5. On the sheet, open "What you will sign", then click Approve. Screenshot Phantom's dialog.
   It should show the same text as the sheet, starting "Consent receipt request". Check whether
   Phantom shows all 22 lines or truncates, and whether it shows any warning.
6. After approving, the page should say "Consent signed (draft receipt)" with seven PASS and
   two WAIT lines. Click Start over, sign in again, click Decline: Phantom must NOT open.
7. Send me the two screenshots and anything that looked off.
