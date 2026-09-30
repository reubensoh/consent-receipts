/**
 * Offline verification of a prototype receipt: hash, user signature, org signature, and the
 * internal consistency rules. The on-chain check lives in @consent-receipts/anchor-client
 * because it needs an RPC; this file runs anywhere, including the browser.
 */
import bs58 from "bs58";
import nacl from "tweetnacl";
import { receiptHash, type Receipt, type ReceiptBody } from "./receipt.js";
import { utf8 } from "./hash.js";

/** `pending` means the operator has not supplied this part yet (field is null), not that it is wrong. */
export interface Check { name: string; ok: boolean; detail: string; pending?: boolean }

export type ReceiptStatus = "verified" | "awaiting-operator" | "failed";

/** failed: something present is wrong. awaiting-operator: nothing wrong, operator parts missing. */
export function receiptStatus(checks: Check[]): ReceiptStatus {
  if (checks.some((c) => !c.ok && !c.pending)) return "failed";
  if (checks.some((c) => !c.ok && c.pending)) return "awaiting-operator";
  return "verified";
}

function sigOk(message: Uint8Array, signatureB58: string, pubkeyB58: string): boolean {
  try { return nacl.sign.detached.verify(message, bs58.decode(signatureB58), bs58.decode(pubkeyB58)); }
  catch { return false; }
}

/** Every offline check. Missing signatures fail their check; they do not skip it. */
export async function verifyReceiptOffline(r: Receipt): Promise<Check[]> {
  const checks: Check[] = [];
  const rec = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail });
  const AWAIT = "awaiting operator";
  const { receipt_hash, org_signature, anchor: _anchor, ...body } = r;
  const h = await receiptHash(body as ReceiptBody);
  rec("receipt_hash matches canonical body", h === receipt_hash, h);

  if (r.decision === "APPROVE") {
    const text = r.user.consent_text ?? "";
    rec("consent text present", text.length > 0);
    rec("consent text names this user", text.includes(`Signed by: ${r.user.pubkey}`));
    rec("consent text carries this request id", text.includes(`Request ID: ${r.request.id}`));
    rec("consent text carries the file hash", r.file.sha256_client !== null && text.includes(`SHA-256: ${r.file.sha256_client}`));
    rec("consent text says APPROVE", /^Decision: APPROVE$/m.test(text));
    rec("user signature over consent text", !!r.user.signature && sigOk(utf8(text), r.user.signature, r.user.pubkey), r.user.pubkey);
    if (r.file.sha256_relay === null) checks.push({ name: "client and relay file hashes match", ok: false, detail: AWAIT, pending: true });
    else rec("client and relay file hashes match", r.file.sha256_relay === r.file.sha256_client, r.file.sha256_client ?? "");
  } else {
    rec("decline: no user signature, nothing sent",
      r.user.signature === null && r.user.consent_text === null &&
      r.file.sha256_client === null && r.file.sha256_relay === null && r.file.size === null,
      "asked, refused, nothing sent");
  }
  if (org_signature === null) checks.push({ name: "org signature over receipt_hash", ok: false, detail: AWAIT, pending: true });
  else rec("org signature over receipt_hash", sigOk(utf8(receipt_hash), org_signature, r.org.pubkey), r.org.pubkey);
  return checks;
}
