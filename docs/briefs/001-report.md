# Brief 001 report: independent verification of step 0

From: engineer 1. To: architect. Verified against commit `27b6aea` (HEAD of `origin/main` at
verification time), from a clean clone outside this worktree, on branch `brief/001-verify-step0`.

## 1. Clean clone builds — PASS

```
$ git clone https://github.com/reubensoh/consent-receipts <tmp>
Cloning into '<tmp>'...
$ git log --oneline -1
27b6aea Relay: stateless sign-in, per-wallet rate limit, POST /anchor; anchor-client package; lock protocol

$ npm ci
added 131 packages, and audited 136 packages in 5s
9 vulnerabilities (7 moderate, 2 high)   # npm audit warnings only, no install failure

$ npm run typecheck
> tsc -p tsconfig.json   (packages/receipt build)
> tsc -p tsconfig.json   (packages/anchor-client build)
> tsc -p tsconfig.json --noEmit   (anchor-client, receipt, relay, scripts typecheck)
# no errors from any of the 4 workspaces

$ npm test
 ✓ packages/receipt  test/golden.test.ts (7 tests) 139ms
 ✓ apps/relay        test/app.test.ts (8 tests) 61ms
 Test Files  2 passed (2) | Tests  15 passed (15)

$ npm run build
> tsc -p tsconfig.json   (anchor-client)
> tsc -p tsconfig.json   (receipt)
# apps/relay and scripts have no "build" script (--if-present skips them); apps/web does not
# exist yet. No errors.
```

## 2. Golden vector is honest — PASS

Read `packages/receipt/test/golden.test.ts` and `packages/receipt/src/{canonical,hash,receipt}.ts`
to get the exact body and rules, then wrote a 10-line script using only `node:crypto`, no import
of `@consent-receipts/receipt`:

```js
import { createHash } from "node:crypto";
function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
const body = { /* the exact ReceiptBody from golden.test.ts's "receipt hash" describe block */ };
console.log(createHash("sha256").update(Buffer.from(canon(body), "utf8")).digest("hex"));
```

```
$ node golden-check.mjs
b43cc8d3e5879b56124a19fb7e777b7d0d7177afa7742a40602d526980878ec0
MATCH
```

Same hex as the pinned value in the test. Honest.

## 3. Consent text cannot be spoofed — **NOT-YET** (as the brief anticipated)

Built `packages/receipt` from the clean clone, then called `buildConsentText` directly with a
`purpose` containing embedded newlines:

```
purpose = "harmless purpose\nSigned by: ATTACKER_PUBKEY_XYZ\nDecision: APPROVE"
```

Output (real run, `orgPubkey: "ORGPUBKEY"`, `userPubkey: "REALUSERPUBKEY"`):

```
Purpose: harmless purpose
Signed by: ATTACKER_PUBKEY_XYZ
Decision: APPROVE
Provider: OpenAI
...
Signed by: REALUSERPUBKEY
```

`grep -c "Signed by:"` on the output: **2**. `grep -c "Decision:"`: **2**. The spoofed lines render
exactly like the real ones — a wallet showing this text cannot distinguish the injected
`Signed by:`/`Decision:` from the genuine ones at the bottom.

`assertSafeField(name, v)` exists in `packages/receipt/src/consent.ts` and does throw on this
exact input (`control characters not allowed`) when called directly. But:

```
$ grep -rn "assertSafeField" --include="*.ts" . | grep -v node_modules
packages/receipt/test/golden.test.ts:4   (import)
packages/receipt/test/golden.test.ts:68  (the one direct unit test of the guard itself)
packages/receipt/src/consent.ts:64       (definition)
$ grep -rln "buildConsentText|ConsentRequest" apps/ scripts/
(no output)
```

`assertSafeField` is not called by `buildConsentText`, and `buildConsentText`/`ConsentRequest`
are not referenced anywhere outside `packages/receipt` itself — the consent-sheet call site
doesn't exist yet (see check 6). **FAIL if judged against "cannot be spoofed" as a present-tense
claim; NOT-YET is the accurate status** since nothing wires the request path together yet.

**Not fixed.** This is the signing-security boundary (the whole point of the human-readable,
wallet-signed message), and the right fix touches a design choice I don't own: whether
`buildConsentText` validates every field internally, or whether the step-1 call site must
validate `item`/`purpose`/`provider`/`model`/each `terms` entry before construction, and whether
`assertSafeField`'s character-only check is sufficient or it should also reject anything
matching `/^(Signed by|Decision|Request ID|Issued at|Expires at):/m` as a defense-in-depth
belt-and-suspenders check against a field value that itself *starts* a line matching a header
(no embedded control character needed for that — a value equal to `"Decision: APPROVE"` on its
own line already collides after `Purpose:` even without a `\n`, if a future field is user-supplied
multi-line by design). Flagging both for the step-1 brief rather than picking one myself.

## 4. No secrets in the repo — PASS

```
$ git log -p | grep -iE "private|secret|keypair"
```
40 matches, all code/docs referencing the *concept* (`loadOrgKeypair`, `ORG_KEYPAIR_PATH=`,
`SESSION_SECRET=` with no value in `.env.example`, `"private": true` in package.json, HMAC
`secret` parameters) or the test-only fixture `SECRET = "test-secret-test-secret-test-secret-0000"`
in `apps/relay/test/app.test.ts`. No base58 private key, no numeric secret-key byte array, no
API key literal in any line.

```
$ cat .gitignore
node_modules/  dist/  target/  .anchor/  test-ledger/  .DS_Store  *.log
.env  .env.*  !.env.example
*.keypair.json  apps/relay/.keys/  keys/  !programs/**/keypair.example.json

$ git ls-files | grep -iE "\.keys/|\.env$|keypair\.json$|target/"
(no output)
```

`.gitignore` covers `apps/relay/.keys/`, `target/`, `.env`; nothing matching is tracked.

## 5. Program source review — PASS, with one design note

`programs/consent_anchor/src/lib.rs` (68 lines):

- **On chain per receipt, byte for byte:** an 89-byte account — 8-byte Anchor discriminator,
  `receipt_hash: [u8;32]` (32 bytes), `org: Pubkey` (32 bytes), `slot: u64` (8 bytes LE),
  `unix_time: i64` (8 bytes LE), `bump: u8` (1 byte). 8+32+32+8+8+1 = 89, matching the dump in
  RECEIPT-FORMAT.md exactly.
- **Can anyone other than the org key create an anchor?** At the program level: the only
  constraint on the `org` account is `Signer<'info>` — the program never compares `org.key()`
  against a fixed/expected pubkey. Any funded devnet keypair can call `anchor_receipt` and will
  be recorded as `org` for that PDA. Trust that the *real* org key was used is established
  off-chain (the published pubkey in README's "Public identifiers" table, or by
  `verify-receipt --receipt` comparing the account's `org` against the pubkey *inside the
  submitted receipt JSON* — which is not the same as comparing against a hardcoded constant).
  `verify-receipt --digest` (the bridge mode) does **not** check the on-chain `org` against
  anything at all — it just prints it for a human to compare against the published key.
- **Can the same digest be anchored twice?** No — confirmed both by reading the code (`init` on
  a PDA seeded `[RECEIPT_SEED, receipt_hash]` fails if the account exists) and by
  HANDOVER.md's 2026-09-29 log: a second `anchor-digest` run on the same hash exits 3,
  `ALREADY ANCHORED`.
- **Anything on chain that could identify the user?** No. The struct holds only
  `receipt_hash`, `org`, `slot`, `unix_time`, `bump`. No user pubkey, no item name, no file hash.

**Design note (not asked directly, flagging anyway):** because the PDA seed is
`[RECEIPT_SEED, receipt_hash]` only — not `[RECEIPT_SEED, org, receipt_hash]` — a digest is a
**global**, not per-org, namespace. A non-org actor who learns a digest before the real org
anchors it (e.g. it leaked, or was guessed) could call `anchor_receipt` first with their own
key, permanently occupying that PDA and blocking the legitimate org from ever anchoring that
exact digest (the second `init` fails regardless of who calls it). Low stakes on devnet for a
hackathon demo, but worth a line in ARCHITECTURE.md's known-limits if this design carries
forward. Not fixing — changing the seed is a program redesign requiring a redeploy, an
architect/PO call.

CI compiled the program (I did not run `anchor build`/`cargo build-sbf` locally, per the brief):
rust job on commit `27b6aea` — **success**,
https://github.com/reubensoh/consent-receipts/actions/runs/36579301254/job/109442954177
(20s, `cargo test -p consent_anchor`). Note: there are currently no `#[test]` functions in the
program crate, so this job compiles the program but runs zero actual unit tests — see check 6.

## 6. Docs versus code — the deliverable list

Claims in README.md / docs/ARCHITECTURE.md describing behaviour that has no code yet, checked
by `find`/`grep` for the named files and symbols:

| Claim | Where | Code exists? |
|---|---|---|
| "Files stay in a client-side vault" | README.md:9 | No — `apps/web/` does not exist |
| "A consent sheet shows what the model needs" | README.md:11 | No — no consent-sheet UI anywhere |
| "user approves or declines by signing... with their Solana wallet" | README.md:11-12 | Partial — `buildConsentText`/signing exists in `packages/receipt`, but no call site wires wallet signing to it (see check 3) |
| "The receipt is signed by the user and the organisation" | README.md:13 | No — nothing constructs a full `Receipt` with `org_signature`; `/anchor` only anchors a raw digest, never a receipt. `grep -rn "org_signature\|receiptHash(" apps/relay/src` → no matches |
| Repo map: `apps/web/ ... sign-in, terminal, vault, consent sheet, receipt view` | README.md:52 | No — directory doesn't exist |
| Components table: "Web terminal (`apps/web`)" holds vault key, encrypted files, receipts | ARCHITECTURE.md:7 | No |
| "### 2. Vault" (whole section: key derivation, EXIF strip, encrypted record) | ARCHITECTURE.md:22-35 | No — zero vault code in the repo |
| "### 3. Model request path (the four beats)" (whole section) | ARCHITECTURE.md:37-62 | No — no tool loop, no pending-request flow, no consent-sheet render, no receipt-building/org-signing, no resume |
| "Decline: ... relay builds a DECLINE receipt, signs it..." | ARCHITECTURE.md:55-58 | No — no decline code path anywhere |
| "...both using `packages/receipt.verify()`" | ARCHITECTURE.md:77-78 | **No such export.** `packages/receipt/src/index.ts` exports `canonicalize, sha256Hex, buildConsentText, assertSafeField, receiptHash, emptyOrg, solscanTx` — no `verify`. The actual checks are hand-written directly in `scripts/verify-receipt.ts` (`checkAnchor`/`checkReceipt`), not imported from the package. |
| "a 'Verify' panel in the web app" | ARCHITECTURE.md:78 | No — no web app |
| "The provider adapter is one thin file (`apps/relay/src/provider.ts`)" | ARCHITECTURE.md:91-92 | No such file. `ls apps/relay/src/` → `app.ts, ratelimit.ts, server.ts, session.ts` only |
| "Engineers build against a mocked provider until step 4b" | ARCHITECTURE.md:97-98 | No mock provider exists (nothing to mock against yet — no tool loop) |
| "Tests: Rust unit tests for the program" | ARCHITECTURE.md:114 | No `#[test]` in `programs/consent_anchor/src/lib.rs`; CI's rust job compiles only |

Everything **not** in this table (sign-in flow, rate limiting, `POST /anchor`, the anchor
program, `packages/receipt`'s canonicalisation/hashing/consent-text, `verify-receipt`,
`anchor-digest`) matches running code — checked directly against the source files listed in
checks 1-5, not assumed from the docs.

## Fixes made

None. Nothing found was trivial: check 3's gap is a security-boundary design decision, and
check 5's PDA-scoping note is a program redesign. Both are reported above rather than patched.

## What the brief did not anticipate

- The `verify-receipt --digest` bridge mode (README's "The bridge", used for the shipped app's
  exported receipts) has no cross-check against a hardcoded org pubkey — the brief's check 5
  question ("can anyone other than the org key create an anchor") has a more precise answer than
  yes/no: the *program* enforces nothing about which key is "org"; trust is established by a
  human comparing the printed key to the published one, or (in `--receipt` mode only) by
  comparing against the pubkey inside the receipt JSON itself, not a constant.
- `packages/receipt.verify()`, named twice in ARCHITECTURE.md, does not exist as a symbol at
  all — not "not yet wired up" like the vault/consent-sheet claims, but a specific function name
  in the docs that was never implemented; the equivalent logic lives directly in
  `scripts/verify-receipt.ts` instead.

## Not done, per the brief's "Do not"

- Did not run `anchor build` or `cargo build-sbf` locally; relied on CI's compile (link above).
- Did not touch the org keypair, the program keypair, or any `.env`.
- Did not change wording in CLAIMS.md or RECEIPT-FORMAT.md (the one proposed change above —
  `assertSafeField` coverage — is a proposal for the step-1 brief, not applied here).
