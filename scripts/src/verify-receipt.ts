/**
 * verify-receipt --digest <64 hex> [--org <pubkey>]   anchor check only (exported receipts from the shipped app)
 * verify-receipt --receipt <file.json>                 all checks on a prototype receipt (docs/RECEIPT-FORMAT.md)
 * --org defaults to ORG_PUBKEY in the env, then the operator's published key.
 * Prints PASS/FAIL per check. Never says "legally binding".
 */
import fs from "node:fs";
import { Connection, PublicKey } from "@solana/web3.js";
import { verifyReceiptOffline, type Check, type Receipt } from "@consent-receipts/receipt";
import { RPC, DEFAULT_ORG_PUBKEY, fetchAnchor, receiptPda, parseDigest, solscanAccount } from "@consent-receipts/anchor-client";

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const orgArg = opt("--org") ?? process.env.ORG_PUBKEY;
const org = orgArg ? new PublicKey(orgArg) : DEFAULT_ORG_PUBKEY;
const connection = new Connection(RPC, "confirmed");

async function anchorChecks(hex: string, expectOrg: PublicKey): Promise<Check[]> {
  const a = await fetchAnchor(connection, expectOrg, hex);
  if (!a) return [{ name: "anchor: PDA exists for (org, digest)", ok: false,
    detail: `none at ${receiptPda(expectOrg, parseDigest(hex)).toBase58()} for org ${expectOrg.toBase58()}` }];
  return [
    { name: "anchor: PDA exists for (org, digest)", ok: true, detail: solscanAccount(new PublicKey(a.pda)) },
    { name: "anchor: stored hash equals digest", ok: a.receipt_hash === hex.toLowerCase(), detail: a.receipt_hash },
    { name: "anchor: stored org equals expected org", ok: a.org === expectOrg.toBase58(), detail: a.org },
    { name: "anchor: slot and block time", ok: true, detail: `slot ${a.slot}, ${new Date(a.unix_time * 1000).toISOString()}` },
  ];
}

let checks: Check[];
if (opt("--digest")) {
  checks = await anchorChecks(opt("--digest")!, org);
} else if (opt("--receipt")) {
  const r = JSON.parse(fs.readFileSync(opt("--receipt")!, "utf8")) as Receipt;
  checks = await verifyReceiptOffline(r);
  // the org that must have anchored it is the org named inside the receipt, which the org signature binds
  checks.push(...await anchorChecks(r.receipt_hash, new PublicKey(r.org.pubkey)));
} else {
  console.error("usage: verify-receipt --digest <hex> [--org <pubkey>] | --receipt <file.json>");
  process.exit(2);
}

for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}  ${c.detail}`);
const failed = checks.filter((c) => !c.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed: signed, timestamped, verifiable, anchored.");
process.exit(failed ? 1 : 0);
