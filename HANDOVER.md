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
- `git init` done, LICENSE + NOTICE added. **Push blocked:** `gh` is not installed and there is
  no remote. PO must create the empty public repo `consent-receipts` or install and sign in `gh`.
- Step 0: root npm workspaces; `packages/receipt` (canonical JSON, sha256, consent text builder,
  receipt hash) with 7 passing vitest tests and a pinned golden hash; `programs/consent_anchor`
  source written, NOT built (waiting on PO's answer about other builds on the machine);
  program keypair generated in target/deploy (gitignored), id 72NKbS…bbCh; org keypair at
  apps/relay/.keys/org.json (gitignored), pubkey 37WXBk…mr6G, funded with 1 devnet SOL from the
  CLI wallet; CI workflow written but unverified until the first push.
- Next: PO answers H3 → `anchor build` → `cargo test` → deploy to devnet → brief engineer on
  step 1.
