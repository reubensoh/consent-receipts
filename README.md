# Consent receipts for sharing data with AI

**Working title. Not a brand.** Any product name goes to the PO for a trademark check first.

This repository is Flair Health's proof of concept. The Colosseum entrant is Regal Pines Pte. Ltd.
Nothing from the shipped Flair Health app enters this repository; the only bridge is a receipt's
canonical SHA-256 digest, which this prototype can anchor and verify (see "The bridge" below).

A more private, more transparent way of sharing sensitive content (health records, code, art)
with an AI online, with no accounts. Files stay in a client-side vault. When the model wants one,
it has to ask. A consent sheet shows what the model needs and on what terms. The user approves or
declines by signing a human-readable message with their Solana wallet before anything moves.
Whatever is not on the sheet was not consented. The receipt is signed by the user and the
organisation, and its hash is anchored on Solana devnet so the time and the terms can be proven
later without the contents ever being public.

What an outsider can check: the receipt is **signed, timestamped, verifiable**, and its digest is
**anchored** on devnet. What we never claim: that it is legally binding or notarised, that it
prevents hallucination, or that it makes AI safe. See [docs/CLAIMS.md](docs/CLAIMS.md).

## The bridge

The shipped app mints consent receipts with a canonical SHA-256 digest and an Ed25519 user
signature. The anchor program and the verifier take **any 32-byte digest** as input, not only
receipts minted by this prototype. Demo Day shows the real app's consent sheet and receipt in a
recording, then this prototype anchoring that receipt's digest on devnet with the organisation
key paying the fee, the Solscan verification, and finally what a court would be shown.

## Threat model, in one line

The first bad actor is the organisation running the service, not the model. The receipt binds
that organisation to what it declared. It does not protect content that is already public
elsewhere.

## Repository map (proposed)

```
consent-receipts/
  README.md                 this file
  LICENSE, NOTICE           Apache-2.0, Copyright 2026 Regal Pines Pte. Ltd.
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
Regal Pines Pte. Ltd. is the entrant and copyright holder; the PO is the sole submitter.
Apache-2.0. The repo moves to the `flairhealth-oss` GitHub organisation once org access is set.

## Public identifiers (devnet)

| What | Value |
|---|---|
| Organisation signing key (operator: Regal Pines Pte. Ltd.) | `37WXBkSPhJx9B4bkzpjEbmyTQkLQK3F1Ytw3AEZmmr6G` |
| consent_anchor program id (deployed 2026-09-29) | `72NKbS2kpoxzwAyznfzmq6GuKqS1yQtdnBLzWxhfbbCh` |
| First anchored digest (sha256 of "abc", a test) | [tx on Solscan](https://solscan.io/tx/3v9np6vNam5n3tedeTKgZ8Y9L8cae5oVRk4RM4Lei6owzrgqRGUviVc9yubrFBukNJJ317rGDeemngArHP6uJGe7?cluster=devnet), PDA `6niv3FxgfdbiSqiVwUfpYbKwGNdJr93orqnE6og9t7tC` |

## Try it (devnet)

```bash
npm ci && npm run build
npm run verify-receipt -w scripts -- --digest ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
```

Anchoring a new digest needs the organisation keypair, which only the operator holds:
`npm run anchor-digest -w scripts -- <64 hex>`.

## Status

Step 0 done. Step 2 partly done: program deployed to devnet, digest anchoring and digest-only
verification work from the command line, duplicate anchoring is refused on chain. Not yet:
relay endpoint, web verify panel, full-receipt verification (needs step 1 signatures).
Read [HANDOVER.md](HANDOVER.md).
