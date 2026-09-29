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
- Engineer 1's first brief written: docs/briefs/001-verify-step0.md.
- Next: PO answers N2/N3; step 1 brief after brief 001 closes; relay skeleton with POST /anchor.
