# Questions the PO must answer before an engineer starts

**Answered 2026-09-29:** A1-A4 (consent-receipts, public, "Copyright 2026 Reuben Soh", go),
B1 (Claude API), B3 (our terms, cite policy by date and link, lawyer approves), C1 (PDA, memo
only as time fallback), F1 (Service: consent-receipts (demo). Operator: Reuben Soh.), F4 (no
wallet signature on decline; org signs both outcomes). Everything else below is still open;
defaults apply until you say otherwise.

Grouped. Each has my recommended default in *italics*; say "default" to accept it. Items marked
**(philosopher)** or **(lawyer)** need a relay through the PO before the answer is final.

## A. Repo and naming

- A1. Repo name: `consent-receipts` under your personal GitHub. *Default: yes.* Fallback
  `consent-receipts-demo` to match the current folder. Descriptive, not a brand, but it is public
  text, so it still goes past you.
- A2. Public from the first commit, or private until Demo Day? *Default: public from day one;
  Apache-2.0 either way.*
- A3. Exact name for the Apache-2.0 copyright line (you as an individual).
- A4. May I `git init` and push once A1-A3 are answered? Nothing is committed yet.

## B. Provider and key **(lawyer for B3)**

- B1. Which provider? *Default: Claude API (Anthropic): native tool use, API inputs not used for
  training by default.* Alternatives with the same default policy exist; say if you prefer one.
- B2. Which model, and a monthly spend cap on the key? *Default: a current Sonnet-class model,
  cap set in the provider console.*
- B3. The sheet will quote and link the provider's published policy on training and retention.
  The lawyer must approve the exact sentence before step 4b. Who drafts it, me or the philosopher?
  *Default: I draft, philosopher edits, lawyer approves.*
- B4. The key goes in `apps/relay/.env` on your machine only; engineers use a mocked provider.
  Confirm you are fine being the only person who runs the real model until Demo Day.

## C. Anchor design (TA)

- C1. PDA per receipt or memo? *Default: PDA (ARCHITECTURE.md, Anchor section).* You said the
  TA decides; what did they say, or when is office hours?
- C2. Org keypair: create a fresh one for this project, fund it with ~1 devnet SOL from your
  existing CLI wallet, and use it as both org signer and fee payer? *Default: yes.* The existing
  CLI wallet (8.4 devnet SOL) also appears in your coursework, so a fresh key keeps this project
  clean.
- C3. Program upgrade authority: your CLI wallet, or the new org key? *Default: CLI wallet.*

## D. Wallet and sign-in

- D1. Demo wallet: Phantom? *Default: Phantom on devnet, with Solflare as the tested fallback.*
  Do you have it installed with a devnet-funded account you are willing to show on screen?
- D2. Sign In With Solana via the Wallet Standard `signIn` feature, falling back to
  `signMessage` over the same text? *Default: yes.*
- D3. Session lifetime after sign-in? *Default: 1 hour, no refresh, sign in again.*

## E. Vault contents **(philosopher for E2)**

- E1. The three files, all synthetic: a markdown health summary, a TypeScript source file, and a
  JPEG with EXIF (so the strip is visible). *Default: I write all three.* Send your own if you
  want specific ones, but never real records.
- E2. Metadata strip scope for Demo Day: EXIF only for images, nothing for text. Is that honest
  enough to say "hashed after any metadata strip" on the sheet?
- E3. Does the model see the file **names** in the vault so it can ask for one? *Default: yes,
  names and sizes only, never hashes or contents, and the sheet says so.*

## F. Consent sheet and terms **(philosopher, then lawyer)**

- F1. The organisation display name on the sheet. This is a public claim. What do we call the
  org running the relay for the demo?
- F2. Terms lines (RECEIPT-FORMAT.md). Which four to six lines? Who signs off the wording?
- F3. Consent expiry: five minutes from sheet render? *Default: 5 min.*
- F4. Does **Decline** require a wallet signature (two taps, symmetric with approve) or one tap
  with an org-only receipt? *Default: wallet-signed, so a decline is as provable as an approval.*
  This is consent semantics; philosopher.
- F5. Purpose text: written by the model in its tool call, shown verbatim? *Default: yes,
  capped at 140 chars, and the sheet labels it "the model's stated purpose".*

## G. Model behaviour

- G1. One file per tool call, one sheet per call, any number of calls per conversation?
  *Default: yes.*
- G2. After approval, may the model keep using that file's content later in the same
  conversation, or is each new answer a new request? *Default: same conversation only; the terms
  line "used only to answer this request" must then say "this conversation". Philosopher.*
- G3. System prompt constraints for the model? *Default: none beyond tool instructions.*

## H. Running it

- H1. Demo Day: relay on your laptop at localhost, browser on the same laptop, devnet over Wi-Fi?
  *Default: yes, plus a recorded video as backup in case the venue network fails.*
- H2. Who records the video, and with what narration? An AI voice is not allowed; your own voice
  is. *Default: you narrate a screen recording; I write the script.*
- H3. Is anything else building on this machine right now? I will ask this before every
  `anchor build`.

## I. People and schedule

- I1. How many engineers, from when, and do they share this machine or use their own?
- I2. Do engineers get their own devnet wallets and a copy of the org keypair, or a separate
  dev org key? *Default: each engineer generates a dev org key; only your machine holds the
  demo key.*
- I3. Office hours dates before Oct 19. I want C1 and F2 settled there.
- I4. Colosseum: which track, and does the business slide need anything from the build beyond
  a screenshot?

## J. Scope guards

- J1. Payment: business slide only, no counter in the build? *Default: no counter.*
- J2. Confirm there is no other project, repo, or code I should pull from. I will not ask again
  and I will decline it if offered.
