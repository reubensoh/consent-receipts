# Consent receipts on Solana

This page explains what consent receipts put on Solana, why, and how anyone can check it. Everything
described here runs on devnet, Solana's test network.

## Why a public ledger

A receipt matters most in a dispute, and a dispute has two sides: the person and the company. The
question is always the same: did this record exist at the time, and has it changed since? If the
company keeps that record, the answer comes from one side of the dispute.

A public ledger gives a timestamp that neither side controls. Once a fingerprint is written, the
operator cannot backdate it, edit it or remove it, and anyone can read it without asking us. The
record also outlives the company that wrote it.

That is all the ledger does. It does not make the company honest, and it does not protect data on
its way to an AI provider. It shows that a receipt existed by a certain time and has not been
changed since.

## Why Solana

- **Speed.** After each anchored request, the phone reads the record back to confirm it landed.
  That only works if confirmation takes seconds, while the person still has the agreement in mind.
- **Cost.** One record per request is only practical at a fraction of a cent. A Memo transaction
  with one signature pays the base fee of 5,000 lamports.
- **Readable from a phone.** A public node answers a single `getTransaction` call, with no wallet,
  account or indexer needed.

## What goes on chain

| On chain | Never on chain |
|---|---|
| The receipt's fingerprint (a SHA-256 hash) | The receipt itself |
| The operator's key, which paid | The person's data |
| The slot and the block time | The person's key or wallet address |
| | The random value inside the receipt |

The fingerprint is salted. Each receipt contains a random value that never leaves the person's
device, so nobody can work out the fingerprint from what they know about the person. The
transaction's time and Flair's operator account are public, though: someone who knew when a person
used Flair could link that moment to a transaction, without learning anything the receipt contains.

## Two ways of anchoring

### Flair Health: a Memo transaction

Flair Health writes one Memo transaction per anchored request. The memo is 80 bytes:

```
flair-consent/1|<64 hex characters: the receipt's fingerprint>
```

1. The phone sends the operator's server the fingerprint and a version number, nothing more.
2. The server writes the memo to devnet and pays the fee from the operator's key. It keeps no copy
   of the fingerprint next to anything that identifies the person.
3. The server returns the transaction id. The phone stores it beside the receipt.
4. The phone asks a public node (`api.devnet.solana.com`) for that transaction, with `confirmed`
   commitment, and checks that its memo carries exactly that fingerprint. The phone records the
   result as verified, mismatch, pending or unreachable.

The public node sees the transaction id and the phone's network address. The agreement the person
approves names this, before they approve.

Why a memo: it costs only the transaction fee, and it leaves nothing on chain to rent or clean up.
The trade-off is that a memo cannot be looked up by its fingerprint without its transaction id, so
the phone keeps the id.

### This repository: an Anchor program

The prototype in `programs/consent_anchor` stores one account per fingerprint, at a program-derived
address:

```
seeds = ["receipt", organisation key, fingerprint]
```

The account is 89 bytes: the fingerprint, the organisation key, the slot, the unix time and a bump.
Nothing about the person is stored.

- **Found by fingerprint alone.** Anyone holding a receipt can derive the address and read the
  account. No transaction id or indexer is needed.
- **One record per organisation and fingerprint.** Creating the same address twice fails, so a
  fingerprint can be anchored once per organisation. Because the organisation key is in the seeds,
  nobody can take another organisation's place for a given fingerprint.
- **The trade-off is cost.** Each account holds 1,102,360 lamports (about 0.0011 SOL) in rent, far more than a memo's
  fee. That is fine for a prototype, and it is one reason Flair uses memos.
- **The program can be upgraded, and we hold the upgrade authority.** A future version could in
  principle change or close these accounts. The transaction that created each account stays in
  the ledger's history either way, so the original record can still be found. A memo avoids the
  question altogether: the fingerprint lives in the transaction itself, no program of ours holds
  it, and Solana's Memo program is deployed with a loader that does not allow upgrades.

Both approaches accept any 32-byte fingerprint, so this repository's tools can anchor and check
receipts from any app that produces one.

## Who pays

The operator pays every fee from its own key. In Flair Health the person needs no wallet and no
SOL. In the web demo the person signs with a Solana wallet, but the organisation key still pays,
so the person's wallet address never appears on chain.

## Checking a record

For the Anchor program, from this repository:

```bash
npm run verify-receipt -w scripts -- --digest <64 hex>
```

It prints the account's slot and block time, or reports that no account exists for that
fingerprint under the operator's key. With `--receipt path/to/receipt.json` it also recomputes the
fingerprint and checks both signatures.

For a Flair Health memo, open the transaction id in any Solana explorer set to devnet and compare
the memo with the fingerprint of the receipt. Two things come next: exporting a single receipt from
the app, and a public page that does this check in the browser.

## Devnet, and the road to mainnet

Devnet is a test network. It can be reset, and a reset would erase these records. That is one
reason anchoring is not yet in the hands of Flair Health's users. Anchoring reaches users with
mainnet, which needs funding first.

On mainnet, one transaction per receipt would cost more than it needs to. The plan is to batch:
gather many fingerprints, put a single Merkle root on chain, and give each receipt the short proof
that links it to that root. This is planned and not yet built.
