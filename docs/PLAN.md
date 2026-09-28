# Walking skeleton plan

Today: 2026-09-28. Demo Day: Oct 19 and 21. Three weeks. Every step ends with me running the
result and checking each claim against the running code before it is called done. Engineers get
one brief at a time; the brief is the step below plus the current QUESTIONS answers.

Dates are targets, not promises. Slack is in step 7.

| Step | Target | What | Done means |
|---|---|---|---|
| 0 | Sep 30 | Bootstrap (in progress 09-29: receipt pkg done, program unbuilt, push blocked on remote) | Repo pushed (after A1-A4). Workspaces build empty. `packages/receipt` has canonical JSON + SHA-256 + consent text builder with a golden vector test. Org keypair created and funded (C2). CI runs vitest and `cargo test`. |
| 1 | Oct 3 | Wallet sign-in + signed consent + local receipt | In the browser: connect Phantom, SIWS sign-in, no address in any URL (checked in devtools). Click Approve on a hardcoded sheet, wallet shows the human-readable text, signature verifies in the browser, a receipt JSON renders with user sig and null org/anchor. Decline does the same with `DECLINE`. |
| 2 | Oct 6 | Devnet anchor + Solscan link | Program deployed to devnet. Relay endpoint takes a receipt body, signs its hash with the org key, creates the PDA, returns tx + slot. Receipt view shows a Solscan link that opens and shows the tx. `scripts/verify-receipt` passes all five checks on a receipt from the running app. Creating the same PDA twice fails. |
| 3 | Oct 8 | Vault | Three files seeded, encrypted under a signature-derived key, listed with sizes and hashes. Reload the page, sign again, files decrypt. Change one byte of a file, hash changes. JPEG EXIF is stripped before hashing (shown by a before/after size). Key never appears in IndexedDB (inspected). |
| 4a | Oct 10 | Tool-call path, mocked model | Relay runs a tool loop against a mock provider that always asks for one file. The real sheet renders with the real item and hash. Approve → wallet signs → relay checks sig, text, and byte hash → mock "answers" → receipt with both sigs and anchor lands. Relay logs contain no bytes, hashes, or addresses (grep the log). |
| 4b | Oct 12 | Real model | Swap mock for the provider (B1) with the PO's key. The model asks for the file unprompted given the vault index. Answer references the file's content. Rate limit trips on the 11th request in a minute and returns a clear error. |
| 5 | Oct 13 | Decline path | Decline signs and anchors a `DECLINE` receipt. Model answers without the file and says so. Verifier passes on the decline receipt. |
| 6 | Oct 14 | Org co-signature hardening | Org signature covers the full canonical body; tamper any field and the verifier fails at the right check. Org pubkey published in README. Web "Verify" panel accepts a pasted receipt. |
| 7 | Oct 17 | Script and video | DEMO-SCRIPT.md: 5 minutes, four beats timed. Screen recording with the PO's voice. Dress rehearsal on Oct 18 on the venue-like setup (laptop, Wi-Fi, devnet). Backup: the video and a pre-anchored receipt. |

## Per-step ritual (maker-checker)

1. I write the brief: goal, done-criteria from the table, files to touch, what not to touch.
2. Engineer builds on a branch, opens a PR with a screen recording or terminal transcript.
3. I run it myself from a clean checkout and tick each done-criterion against the running code.
4. Bugs found are fixed before merge, by whoever is closest, immediately.
5. HANDOVER.md gets a dated entry; memory gets anything non-obvious.

## Risks I am watching

- Wallet `signMessage` determinism for vault keys (step 3). Mitigation: test on Phantom and
  Solflare on day one of step 3; fallback is a per-session random key wrapped by the signature.
- Provider tool-loop pause across a stateless relay (step 4a). Mitigation: transcript lives in
  the browser and is posted back with the consent; design is in ARCHITECTURE.md.
- Devnet RPC flakiness at the venue. Mitigation: retry with backoff, a paid devnet RPC URL in
  `.env` if the PO has one, and the recorded video.
- 16 GB RAM. `anchor build` and Vite dev at once is fine; two Anchor builds is not. Ask first.
