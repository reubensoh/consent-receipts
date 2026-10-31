# Consent receipts

A consent receipt is a record a person keeps of what they agreed to share, with whom, and on what
terms. The receipt is signed on the person's own device. A fingerprint of it is anchored on
Solana, so anyone holding the receipt can later check that it existed by a given time and has not
changed since.

"Consent receipts" is a descriptive name, not a brand.

## For judges

Added on 31 October 2026, after the hackathon submission, to make the project quicker to check. The code has not changed since the tag `colosseum-submission`. Later commits only change this README and add docs/SOLANA.md. To see the repository exactly as submitted, run `git checkout colosseum-submission`.

You need Node 24 or later. The first two steps need no keys, wallet or SOL.

1. Build and run the tests, which work offline:

   ```bash
   npm ci && npm run build && npm test
   ```

   21 tests should pass, covering the receipt format and the relay.

2. Check a test fingerprint that is already on Solana devnet (the SHA-256 of "abc", so it holds nothing about anyone). This only reads from the chain:

   ```bash
   npm run verify-receipt -w scripts -- --digest ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
   ```

   You should see four PASS lines: the account exists, the stored hash matches, the organisation matches, and the slot and time (slot 505578580, 29 September 2026). The closing line also says "signed", but this step reads only the anchor; signatures are checked when you pass a full receipt with `--receipt`. The same record is on [Solana Explorer](https://explorer.solana.com/address/FfdETrPzRFvoUe7xz9wAJWViTr4LFwLSU3oYjajiEy1n?cluster=devnet).

3. Optionally, run the browser demo. It shows a consent sheet, asks your wallet to sign it, and keeps the receipt in the browser. It does not anchor the receipt yet.

   In `apps/relay`, copy `.env.example` to `.env` and set `SESSION_SECRET` to the output of `openssl rand -hex 32`. Then create a throwaway organisation key and start the relay:

   ```bash
   mkdir -p .keys && node -e "const {Keypair}=require('@solana/web3.js');console.log(JSON.stringify(Array.from(Keypair.generate().secretKey)))" > .keys/org.json
   npm run dev
   ```

   In a second terminal, from the repository root, run `npm run dev -w apps/web` and open http://localhost:5173 with a Solana wallet set to devnet. Signing costs nothing, so the wallet needs no SOL.

More detail, including how to check a full receipt, is under [Try it on devnet](#try-it-on-devnet).

## Why this exists

Apps send people's data to AI services and other companies every day. The terms live in a policy
the company wrote and can change, and the person keeps no record of what left or on what terms. If
there is ever a dispute, the only record belongs to one side of it.

Consent receipts give the person their own copy. Before their data goes to an AI model or a
partner, the app shows a short agreement: who receives the data, on what terms, and what each party keeps. If the person
approves, the app writes a receipt, signs it, and puts its fingerprint on a public ledger that
neither side controls. Anything not listed on the agreement was not agreed to.

## Where it runs today: Flair Health

[Flair Health](https://flairhealth.app) is a health app by Regal Pines Pte. Ltd., in TestFlight on iOS. The person's health data is
encrypted and kept on their phone. Every AI request in Flair is checked against the agreement the
person approved, and each one leaves a receipt on the phone.

Solana anchoring runs in an internal build, on devnet, for two of Flair's AI features (Refresh
Insights and Eat Now). It is not yet in the TestFlight build. It will reach users with mainnet.

Flair Health's own code is not in this repository. [docs/SOLANA.md](docs/SOLANA.md) describes
exactly what it puts on Solana and how the phone checks it.

## How a receipt reaches Solana

1. The person reads the agreement and taps Approve.
2. The phone writes the receipt and signs it with a key that stays on the phone.
3. The phone computes the receipt's fingerprint, a SHA-256 hash. The receipt includes a random
   value that never leaves the phone, so nobody can work out the fingerprint from what they know
   about the person.
4. Only the fingerprint goes to the operator's server, which writes it to Solana and pays the
   fee. The server never sees the receipt.
5. The phone reads the transaction back from a public Solana node and confirms the fingerprint
   matches.

The chain holds the fingerprint, the operator's key that paid, and the time. It never holds the
receipt, the data, or anything that identifies the person.
The transaction itself does show that Flair recorded a receipt, and when, so someone who already
knew when a person used Flair could link that moment to a transaction. They would still
learn nothing the receipt contains.

## What a receipt proves, and what it does not

A matching fingerprint on Solana shows that the receipt existed no later than that block's time
and has not been changed since. The receipt itself shows what the person approved and what was
sent.

One caveat applies to the Anchor program in this repository: we hold its upgrade authority, so a later version could in principle change or remove a stored record. The transaction that created the record stays in the ledger either way. Flair's memos do not carry this caveat, because Solana's Memo program cannot be upgraded. [docs/SOLANA.md](docs/SOLANA.md) has the detail.

A receipt does not show that the company kept its word after the data arrived. It does not stop data leaving the phone, and it is not a legal certificate.

## What is in this repository

This repository is the open prototype of the Solana side, under Apache-2.0. It anchors and checks
any 32-byte fingerprint, so it works with Flair's receipts as well as its own.

| Path | What it does |
|---|---|
| `programs/consent_anchor` | An Anchor program on devnet. One small account per fingerprint, scoped to the organisation that anchored it. |
| `packages/anchor-client` | TypeScript client: anchor a fingerprint, find it again by fingerprint, read its slot and time. |
| `packages/receipt` | The receipt format: canonical JSON, hashing, the consent text a wallet signs, offline verification. |
| `scripts` | Two command-line tools, `anchor-digest` and `verify-receipt`. |
| `apps/relay` | A small server with no database: wallet sign-in without an account, and `POST /anchor`, rate limited per wallet. |
| `apps/web` | A browser demo: sign in with a Solana wallet, read a consent sheet, sign it, receive a receipt. |

Flair Health anchors with Solana's Memo program, and that is the path wired into its internal build.
The Anchor program here came first, as a prototype that can find a record by its fingerprint
alone. The trade-offs between the two are in [docs/SOLANA.md](docs/SOLANA.md).

## Try it on devnet

Check a fingerprint that is already anchored (the SHA-256 of "abc", used as a test):

```bash
npm ci && npm run build
npm run verify-receipt -w scripts -- --digest ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
```

This only reads from the chain, so it needs no keys and no SOL. It looks up the operator's account
for that fingerprint and prints its slot and time. If the public devnet node is busy, point
`SOLANA_RPC_URL` at another devnet RPC. To check
under another organisation's key, add `--org <pubkey>`. To check a full prototype receipt, both
signatures included:

```bash
npm run verify-receipt -w scripts -- --receipt path/to/receipt.json
```

Anchoring a new fingerprint needs the organisation's keypair, which only the operator holds:
`npm run anchor-digest -w scripts -- <64 hex>`.

The tests run offline, with no keys or network: `npm test` covers the receipt format, hashing,
tampered and mismatched receipts, and the relay's sign-in; `cargo test -p consent_anchor` covers
the program's account layout and addresses.

To run the web demo and the relay, use two terminals. The web demo stops at a signed receipt in
the browser; it does not anchor yet.

```bash
npm run dev -w apps/relay
```

```bash
npm run dev -w apps/web
```

Then open http://localhost:5173 in a browser with a Solana wallet set to devnet. The relay needs
`apps/relay/.env` (copy `apps/relay/.env.example` and set `SESSION_SECRET` to 64 hex characters)
and an organisation keypair at `apps/relay/.keys/org.json`. Its routes are `GET /health`,
`POST /session/challenge`, `POST /session/verify` and `POST /anchor`. The wallet address never
appears in a URL, and requests are not logged.

## Public identifiers (devnet)

| What | Value |
|---|---|
| Organisation key (operator: Regal Pines Pte. Ltd.) | `37WXBkSPhJx9B4bkzpjEbmyTQkLQK3F1Ytw3AEZmmr6G` |
| `consent_anchor` program id | `72NKbS2kpoxzwAyznfzmq6GuKqS1yQtdnBLzWxhfbbCh` |
| Test fingerprint anchored (SHA-256 of "abc") | transaction on [Solana Explorer](https://explorer.solana.com/tx/xj4r3H91WnP8519ETNVipQTBTdxWjum1PG43Gbg5FuMWhkme2jqSX6quCCREZe1zqG27RMmpzD7nHamncLqi7fH?cluster=devnet) or [Solscan](https://solscan.io/tx/xj4r3H91WnP8519ETNVipQTBTdxWjum1PG43Gbg5FuMWhkme2jqSX6quCCREZe1zqG27RMmpzD7nHamncLqi7fH?cluster=devnet); account `FfdETrPzRFvoUe7xz9wAJWViTr4LFwLSU3oYjajiEy1n` ([Explorer](https://explorer.solana.com/address/FfdETrPzRFvoUe7xz9wAJWViTr4LFwLSU3oYjajiEy1n?cluster=devnet)) |

These are devnet keys. Mainnet will use new ones.

## Status

Built in this repository:

- the `consent_anchor` program, deployed on devnet;
- the anchor and verify command-line tools;
- the relay, with wallet sign-in and anchoring;
- the web demo, up to a signed consent sheet and a receipt kept in the browser (decline is one
  tap and needs no signature);
- CI running the program's Rust tests and the TypeScript tests.

Not built yet:

- the web demo anchoring its own receipts end to end (today anchoring runs through the
  command-line tool and the relay);
- the encrypted file vault and the model conversation in the web demo.

Next, after the current Flair build:

- exporting a single receipt from Flair Health;
- a public web page that checks an exported receipt in the browser.

Later, after funding:

- mainnet, with many fingerprints batched into one transaction;
- organisations countersigning receipts.

Nothing here uses a token or real funds.

## Ownership

Regal Pines Pte. Ltd. owns this work and holds its copyright; it is licensed under Apache-2.0 (see
[LICENSE](LICENSE) and [NOTICE](NOTICE)). Reuben Soh, a director of the company, entered it in
Colosseum with the company's authority. The repository as it stood at the close of the
submission window is tagged `colosseum-submission`; later commits change documentation only.

The files under `docs/` other than [docs/SOLANA.md](docs/SOLANA.md), together with
[HANDOVER.md](HANDOVER.md) and [ROADMAP.md](ROADMAP.md), are the build's working notes, kept as
they were written. [docs/CLAIMS.md](docs/CLAIMS.md) lists the words we use and the ones we avoid.
