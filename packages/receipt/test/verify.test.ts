import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { buildConsentText, receiptHash, emptyOrg, utf8, verifyReceiptOffline, type Receipt, type ReceiptBody } from "../src/index.js";

const user = nacl.sign.keyPair(), org = nacl.sign.keyPair();
const USER = bs58.encode(user.publicKey), ORG = bs58.encode(org.publicKey);
const sign = (kp: nacl.SignKeyPair, m: string) => bs58.encode(nacl.sign.detached(utf8(m), kp.secretKey));
const request = {
  id: "8b6c7d3e-0a5f-4c1e-9c3a-2f1d0e9b8a77", item: "Documents/lab-report.md",
  sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", size: 2113,
  purpose: "compare values to reference ranges", provider: "OpenAI", model: "gpt-mini-placeholder",
  terms: ["used only to answer this conversation"], issuedAt: "2026-10-05T14:03:11Z", expiresAt: "2026-10-05T14:08:11Z",
};

async function approved(): Promise<Receipt> {
  const text = buildConsentText({ request, decision: "APPROVE", orgPubkey: ORG, userPubkey: USER });
  const body: ReceiptBody = {
    version: "consent-receipt/0",
    request: { id: request.id, item: request.item, purpose: request.purpose, provider: request.provider, model: request.model, terms: request.terms },
    decision: "APPROVE",
    file: { sha256_client: request.sha256, sha256_relay: request.sha256, size: request.size },
    user: { pubkey: USER, consent_text: text, signature: sign(user, text) },
    org: emptyOrg(ORG),
    time: { issued_at: request.issuedAt, relay_signed_at: "2026-10-05T14:03:20Z" },
  };
  const receipt_hash = await receiptHash(body);
  return { ...body, receipt_hash, org_signature: sign(org, receipt_hash), anchor: null };
}
const failed = (cs: { name: string; ok: boolean }[]) => cs.filter((c) => !c.ok).map((c) => c.name);

describe("verifyReceiptOffline", () => {
  it("passes a well-formed approved receipt", async () => {
    expect(failed(await verifyReceiptOffline(await approved()))).toEqual([]);
  });
  it("fails exactly the right check when tampered", async () => {
    const r = await approved();
    expect(failed(await verifyReceiptOffline({ ...r, request: { ...r.request, purpose: "changed" } })))
      .toEqual(["receipt_hash matches canonical body"]);
    // the user signature sits inside the hashed body, so swapping it breaks the hash as well
    expect(failed(await verifyReceiptOffline({ ...r, user: { ...r.user, signature: sign(org, r.user.consent_text!) } })))
      .toEqual(["receipt_hash matches canonical body", "user signature over consent text"]);
    expect(failed(await verifyReceiptOffline({ ...r, org_signature: sign(user, r.receipt_hash) })))
      .toEqual(["org signature over receipt_hash"]);
    expect(failed(await verifyReceiptOffline({ ...r, file: { ...r.file, sha256_relay: "00".repeat(32) } })))
      .toEqual(["receipt_hash matches canonical body", "client and relay file hashes match"]);
  });
  it("step-1 receipt (no org signature yet) fails only the org check, and hashes deterministically", async () => {
    const r = { ...(await approved()), org_signature: null };
    expect(failed(await verifyReceiptOffline(r))).toEqual(["org signature over receipt_hash"]);
    const { receipt_hash, org_signature, anchor, ...body } = r;
    expect(await receiptHash(body)).toBe(receipt_hash);
  });
  it("a decline receipt needs no user signature", async () => {
    const a = await approved();
    const body: ReceiptBody = { ...a, decision: "DECLINE", file: { ...a.file, sha256_relay: null }, user: { pubkey: USER, consent_text: null, signature: null } };
    const { receipt_hash: _h, org_signature: _o, anchor: _a, ...clean } = body as Receipt;
    const receipt_hash = await receiptHash(clean);
    const r: Receipt = { ...clean, receipt_hash, org_signature: sign(org, receipt_hash), anchor: null };
    expect(failed(await verifyReceiptOffline(r))).toEqual([]);
  });
});
