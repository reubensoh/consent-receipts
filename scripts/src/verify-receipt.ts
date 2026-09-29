/**
 * verify-receipt --digest <64 hex>        anchor check only (exported receipts from the shipped app)
 * verify-receipt --receipt <file.json>    all checks on a prototype receipt (docs/RECEIPT-FORMAT.md)
 * Prints PASS/FAIL per check. Never says "legally binding".
 */
import fs from "node:fs";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { Connection, PublicKey } from "@solana/web3.js";
import { receiptHash, utf8, type Receipt } from "@consent-receipts/receipt";
import { RPC, parseDigest, receiptPda, readonlyProgram, solscanAccount } from "./chain.js";

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const rec = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

async function checkAnchor(hex: string) {
  const digest = parseDigest(hex);
  const pda = receiptPda(digest);
  const connection = new Connection(RPC, "confirmed");
  const program = readonlyProgram(connection);
  try {
    const acct = await (program.account as any).receiptAnchor.fetch(pda) as
      { receiptHash: number[]; org: PublicKey; slot: { toString(): string }; unixTime: { toString(): string } };
    const onchain = Buffer.from(acct.receiptHash).toString("hex");
    rec("anchor: PDA exists for digest", true, solscanAccount(pda));
    rec("anchor: stored hash equals digest", onchain === hex.toLowerCase(), onchain);
    const t = new Date(Number(acct.unixTime.toString()) * 1000).toISOString();
    rec("anchor: slot and block time", true, `slot ${acct.slot.toString()}, ${t}, org ${acct.org.toBase58()}`);
    return acct.org.toBase58();
  } catch (e) {
    rec("anchor: PDA exists for digest", false, `not found at ${pda.toBase58()} (${(e as Error).message})`);
    return null;
  }
}

async function checkReceipt(file: string) {
  const r = JSON.parse(fs.readFileSync(file, "utf8")) as Receipt;
  const { receipt_hash, org_signature, anchor, ...body } = r;
  const h = await receiptHash(body);
  rec("receipt_hash matches canonical body", h === receipt_hash, h);
  if (r.decision === "APPROVE") {
    const ok = !!r.user.consent_text && !!r.user.signature && nacl.sign.detached.verify(
      utf8(r.user.consent_text), bs58.decode(r.user.signature), bs58.decode(r.user.pubkey));
    rec("user signature over consent text", ok, r.user.pubkey);
    rec("consent text names this user", !!r.user.consent_text?.includes(`Signed by: ${r.user.pubkey}`), "");
    rec("client and relay file hashes match", r.file.sha256_client === r.file.sha256_relay, r.file.sha256_client);
  } else {
    rec("decline: no user signature expected", r.user.signature === null && r.file.sha256_relay === null, "asked, refused, nothing sent");
  }
  const orgOk = nacl.sign.detached.verify(utf8(receipt_hash), bs58.decode(org_signature), bs58.decode(r.org.pubkey));
  rec("org signature over receipt_hash", orgOk, r.org.pubkey);
  const anchoredBy = await checkAnchor(receipt_hash);
  if (anchoredBy) rec("anchor paid and signed by the receipt's org key", anchoredBy === r.org.pubkey, anchoredBy);
}

const [mode, arg] = process.argv.slice(2);
if (mode === "--digest" && arg) await checkAnchor(arg);
else if (mode === "--receipt" && arg) await checkReceipt(arg);
else { console.error("usage: verify-receipt --digest <hex> | --receipt <file.json>"); process.exit(2); }

for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}  ${c.detail}`);
const failed = checks.filter((c) => !c.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed: signed, timestamped, verifiable, anchored.");
process.exit(failed ? 1 : 0);
