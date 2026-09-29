# Brief 001: independent verification of step 0

To: engineer 1. From: architect. One brief at a time; this is yours until it is closed.

## Goal

Confirm, from a clean clone and without trusting anything I wrote, that step 0 in
docs/PLAN.md is done. You are the checker. Report what you ran and what you saw. Do not fix
things silently; report them, then fix if trivial and say you did.

## Read first

README.md, docs/CLAIMS.md, docs/RECEIPT-FORMAT.md, HANDOVER.md. Do not read or bring anything
from any other repository; this project is deliberately sealed.

## Checks

1. **Clean clone builds.** `git clone https://github.com/reubensoh/consent-receipts` into a new
   directory, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Paste the tail of each.
2. **Golden vector is honest.** In `packages/receipt/test/golden.test.ts`, the receipt hash is
   pinned. Recompute it independently: write a 10-line Node script that JSON-canonicalises the
   same body (sorted keys, no whitespace) and SHA-256s it with `node:crypto`, without importing
   the package. Same hex or not?
3. **Consent text cannot be spoofed.** Try to construct a `ConsentRequest` whose `purpose` or
   `item` makes the wallet text show a second `Signed by:` or `Decision:` line. Does
   `assertSafeField` stop it? Is `assertSafeField` actually called anywhere yet? (I expect: not
   yet. Say so.)
4. **No secrets in the repo.** `git log -p | grep -iE "private|secret|keypair"` and confirm no
   keypair bytes or API keys appear in any commit. Confirm `.gitignore` covers
   `apps/relay/.keys/`, `target/`, `.env`.
5. **Program source review** (`programs/consent_anchor/src/lib.rs`). Answer in writing:
   what is on chain per receipt, byte by byte? Can anyone other than the org key create an
   anchor? Can the same digest be anchored twice? Is there anything on chain that could
   identify the user? Do not build it on the PO's machine; CI compiles it, link the run.
6. **Docs versus code.** Find every sentence in README.md and docs/ARCHITECTURE.md that
   claims behaviour of code that does not exist yet, and list them. (Most of it, today. The
   list is the deliverable; it becomes the checklist for later steps.)

## Done means

A short report in `docs/briefs/001-report.md` with, per check: command, observed result,
PASS/FAIL/NOT-YET, and any fix you made. Open a PR; I review and run the same commands myself.

## Do not

- Run `anchor build` or `cargo build-sbf` on the PO's machine (16 GB, lock protocol).
- Touch the org keypair, the program keypair, or any `.env`.
- Change wording in CLAIMS.md or RECEIPT-FORMAT.md; propose changes in the report instead.

## Delivery (relayed by the PO on 2026-09-30)

~~~
Brief 001 from the architect: independent verification of step 0.

You are the checker. Nothing I wrote is to be trusted until you have run it. Clone
https://github.com/reubensoh/consent-receipts into a fresh directory. Read README.md,
docs/CLAIMS.md, docs/RECEIPT-FORMAT.md, HANDOVER.md, and docs/PLAN.md. Do not read or bring
anything from any other repository; this project is deliberately sealed.

Checks:
1. Clean clone builds: npm ci, npm run typecheck, npm test, npm run build. Paste the tail of each.
2. Golden vector is honest: packages/receipt/test/golden.test.ts pins a receipt hash. Recompute it
   independently with a 10-line Node script (sorted keys, no whitespace, sha256 via node:crypto),
   without importing the package. Same hex or not?
3. Consent text cannot be spoofed: try to build a ConsentRequest whose purpose or item makes the
   wallet text show a second "Signed by:" or "Decision:" line. Does assertSafeField stop it? Is
   assertSafeField actually called anywhere yet? (I expect: not yet. Say so.)
4. No secrets in the repo: git log -p | grep -iE "private|secret|keypair"; confirm no keypair bytes
   or API keys in any commit, and that .gitignore covers apps/relay/.keys/, target/, .env.
5. Program source review, programs/consent_anchor/src/lib.rs, answered in writing: what is on
   chain per receipt, byte by byte? Can anyone other than the org key create an anchor? Can the
   same digest be anchored twice? Is there anything on chain that could identify the user?
   Do not build it; CI compiles it, link the run.
6. Docs versus code: list every sentence in README.md and docs/ARCHITECTURE.md that claims
   behaviour of code that does not exist yet. The list is the deliverable.

Done means: docs/briefs/001-report.md with, per check, the command, the observed result,
PASS / FAIL / NOT-YET, and any fix you made (report first, fix only if trivial, say you did).
Open a PR against main. I will run the same commands myself before merging.

Do not: run anchor build or cargo build-sbf on the PO's machine; touch the org keypair, the
program keypair, or any .env; change wording in CLAIMS.md or RECEIPT-FORMAT.md (propose
changes in the report instead).
~~~
