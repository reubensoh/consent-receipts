# Consent receipts for sharing data with AI

**Working title. Not a brand.** Any product name goes to the PO for a trademark check first.

A more private, more transparent way of sharing sensitive content (health records, code, art)
with an AI online, with no accounts. Files stay in a client-side vault. When the model wants one,
it has to ask. A consent sheet shows what the model needs and on what terms. The user approves or
declines by signing a human-readable message with their Solana wallet before anything moves.
Whatever is not on the sheet was not consented. The receipt is signed by the user and the
organisation, and its hash is anchored on Solana devnet so the time and the terms can be proven
later without the contents ever being public.

What an outsider can check: the receipt is **signed, timestamped, verifiable**.
What we never claim: that it is legally binding, that it prevents hallucination, or that it makes
AI safe. See [docs/CLAIMS.md](docs/CLAIMS.md).

## Threat model, in one line

The first bad actor is the organisation running the service, not the model. The receipt binds
that organisation to what it declared. It does not protect content that is already public
elsewhere.

## Repository map (proposed)

```
consent-receipts/
  README.md                 this file
  LICENSE, NOTICE           Apache-2.0, Copyright 2026 Reuben Soh
  ROADMAP.md                out of Demo Day scope, deliberately
  HANDOVER.md               the scroll a fresh session reads first
  docs/
    ARCHITECTURE.md         components, flows, key decisions, known limits
    RECEIPT-FORMAT.md       the receipt and the consent message, byte for byte
    PLAN.md                 walking skeleton, "done" per step, dates
    QUESTIONS.md            what the PO must answer before an engineer starts
    CLAIMS.md               allowed and forbidden wording
    DEMO-SCRIPT.md          the 5-minute talk (step 7)
  packages/receipt/         shared TS: canonical JSON, hashing, message text, verify()
  apps/web/                 Vite + React + TS: sign-in, terminal, vault, consent sheet, receipt view
  apps/relay/               Node 24 + TS (Hono): tool loop, provider key, co-sign, anchor, rate limit
  programs/consent_anchor/  Anchor 1.1.2 program: one PDA per receipt hash (or memo, TA decides)
  scripts/                  verify-receipt CLI, devnet deploy, org keypair bootstrap
  Anchor.toml  Cargo.toml  package.json (npm workspaces)  rust-toolchain.toml
```

## Bindings

No token. Devnet only. No real funds, no escrow of user money. Receipt content never on chain,
hash only. The user's wallet address never appears on chain per receipt and never in a URL.
The PO is the sole, individual submitter and owns the code. Apache-2.0.

## Public identifiers (devnet)

| What | Value |
|---|---|
| Organisation signing key (operator: Reuben Soh) | `37WXBkSPhJx9B4bkzpjEbmyTQkLQK3F1Ytw3AEZmmr6G` |
| consent_anchor program id | `72NKbS2kpoxzwAyznfzmq6GuKqS1yQtdnBLzWxhfbbCh` (not yet deployed) |

## Status

Step 0 (bootstrap) in progress. `packages/receipt` builds and its golden tests pass. The Anchor
program source exists but has not been built or deployed. Read [HANDOVER.md](HANDOVER.md).
