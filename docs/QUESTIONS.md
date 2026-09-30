# Questions the PO must answer before an engineer starts

**Answered 2026-09-29 (morning):** A1-A4 (consent-receipts, public, go), B3 (our terms, cite
policy by date and link, lawyer approves), C1 (PDA, memo only as time fallback), F4 (no wallet
signature on decline; org signs both outcomes).

**Answered 2026-09-29 (philosopher alignment):** identity is Flair Health's proof of concept,
entrant Regal Pines Pte. Ltd., NOTICE "Copyright 2026 Regal Pines Pte. Ltd.", repo to move to
`flairhealth-oss`; F1 operator line therefore "Regal Pines Pte. Ltd." (per the earlier ruling
that operator, key holder, and copyright line move together; see N1); E1 three synthetic
health files (lab report, scan image, clinic letter); B1/B2 OpenAI, mini-class model, PO's
spend-capped key, thin one-file adapter; H3 build clearance via the lock protocol; D1 Phantom in
a separate profile, PO confirms when installed; I1 one engineer, first brief is an independent
verification of step 0; I3 dates to follow; J1 payment is a roadmap slide, not a beat.

## P. Open as of 2026-09-30 (these block the demo, in this order)

- P1. **Phantom run (PO).** Step 1 is verified with a stand-in wallet only. I need you to run
  it once with real Phantom and tell me what the two wallet dialogs show. Steps are in
  HANDOVER.md, "PO checklist: Phantom run".
- P2. **Terms line 3 (lawyer, B3).** The sheet currently shows the literal placeholders
  `<YYYY-MM-DD>` and `<url>`. I need the exact sentence, the policy URL, and the policy date to
  cite. A judge will read this line. It is one constant, a one-line change.
- P3. **Decline sends no file hash (philosopher).** I made a decline carry nothing about the
  file, not even its hash or size, so "asked, refused, nothing sent" is literal. The decline
  receipt names the item and purpose that were asked for, nothing else. Confirm or correct.
- P4. **Model id (PO, B2).** Which OpenAI mini-class model id goes on the sheet? It appears in
  the signed text, so it must be the real one before step 4b.

## N. New, from the alignment

**Answered 2026-09-29 (evening):** N1 operator line confirmed; N6 service line is "Flair Health
consent receipts (prototype)", "Consent Compact" only after the trademark filing is confirmed;
N2 ship the full journey with the priority order now in PLAN.md; N3 lock protocol implemented
in `scripts/build-lock.sh`; N4 the exported-receipt bridge is Flair item 774, about a day, in
the app's next build, example JSON to follow as data; brief 001 approved.

- N1. **Operator line.** I changed the sheet to "Operator: Regal Pines Pte. Ltd." because the
  ruling said it moves with the copyright line. Philosopher to confirm, or tell me it stays a
  person's name.
- N2. **Prototype scope.** The demo beats now open with a recording of the real app's sheet and
  receipt. Does the prototype still ship its own terminal, vault, and model tool-call path
  (steps 1, 3, 4, 5), or is Demo Day now: anchor program + relay anchor endpoint + verifier +
  "court view" page, fed by exported receipts? *My default until told: both. Anchor and verifier
  first (they serve both readings), prototype journey after, cut the journey if time runs out.*
- N3. **Lock protocol.** What is it, concretely: a file path, a command, a message? I need it
  before the next `anchor build`.
- N4. **Exported receipt example.** When it exists, send one JSON as data. The verifier's
  full-check mode for exported receipts waits on its schema; digest-only mode does not.
- N5. **Repo transfer.** After the move to `flairhealth-oss`, I update the remote and the README
  link. Tell me when.
- N6. **Service line.** Stays "Service: consent-receipts (demo)", or becomes something naming
  Flair Health? Public text; philosopher.


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

- B1. Which provider? **Answered: OpenAI.** The sheet cites OpenAI's API data-usage policy by date and link.
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
