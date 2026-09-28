import { describe, it, expect } from "vitest";
import {
  canonicalize, sha256Hex, utf8, buildConsentText, receiptHash, emptyOrg,
  assertSafeField, type ReceiptBody,
} from "../src/index.js";

const ORG = "11111111111111111111111111111111";
const USER = "GgCCzohJwPke9Y4uAN3ngwDsS46UaSnjLRgx22pbeKgT";
const request = {
  id: "8b6c7d3e-0a5f-4c1e-9c3a-2f1d0e9b8a77",
  item: "Documents/bloodwork.md",
  sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  size: 2113,
  purpose: "compare values to reference ranges",
  provider: "Anthropic",
  model: "claude-sonnet-5",
  terms: [
    "used only to answer this conversation",
    "sent once to the provider named above, not kept on our side",
  ],
  issuedAt: "2026-10-05T14:03:11Z",
  expiresAt: "2026-10-05T14:08:11Z",
};

describe("canonicalize", () => {
  it("sorts keys, drops whitespace and undefined, keeps arrays ordered", () => {
    expect(canonicalize({ b: 1, a: [true, null, "x"], c: { z: "é", y: undefined as never } }))
      .toBe('{"a":[true,null,"x"],"b":1,"c":{"z":"é"}}');
  });
  it("rejects floats", () => {
    expect(() => canonicalize({ a: 1.5 })).toThrow();
  });
});

describe("sha256", () => {
  it("matches the FIPS vector for 'abc'", async () => {
    expect(await sha256Hex(utf8("abc")))
      .toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("consent text", () => {
  it("is byte-stable (golden)", () => {
    const text = buildConsentText({ request, decision: "APPROVE", orgPubkey: ORG, userPubkey: USER });
    expect(text).toBe(
`Consent receipt request
Version: consent-receipt/0

Service: consent-receipts (demo)
Operator: Reuben Soh
Operator key: 11111111111111111111111111111111
Item: Documents/bloodwork.md
SHA-256: ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
Size: 2,113 bytes
Purpose: compare values to reference ranges
Provider: Anthropic
Model: claude-sonnet-5
Terms (ours):
  - used only to answer this conversation
  - sent once to the provider named above, not kept on our side
Decision: APPROVE
Request ID: 8b6c7d3e-0a5f-4c1e-9c3a-2f1d0e9b8a77
Issued at: 2026-10-05T14:03:11Z
Expires at: 2026-10-05T14:08:11Z
Signed by: GgCCzohJwPke9Y4uAN3ngwDsS46UaSnjLRgx22pbeKgT`);
  });
  it("rejects fields with line breaks", () => {
    expect(() => assertSafeField("purpose", "a\nSigned by: attacker")).toThrow();
  });
});

describe("receipt hash", () => {
  const body: ReceiptBody = {
    version: "consent-receipt/0",
    request: { id: request.id, item: request.item, purpose: request.purpose,
      provider: request.provider, model: request.model, terms: request.terms },
    decision: "APPROVE",
    file: { sha256_client: request.sha256, sha256_relay: request.sha256, size: 2113 },
    user: { pubkey: USER, consent_text: "…", signature: "sig" },
    org: emptyOrg(ORG),
    time: { issued_at: request.issuedAt, relay_signed_at: "2026-10-05T14:03:20Z" },
  };
  it("is stable regardless of key order (golden)", async () => {
    const h1 = await receiptHash(body);
    const shuffled = JSON.parse(JSON.stringify({ time: body.time, org: body.org, user: body.user,
      file: body.file, decision: body.decision, request: body.request, version: body.version }));
    expect(await receiptHash(shuffled)).toBe(h1);
    expect(h1).toBe("3206341eccd55db0303fb5b52a6a0c6d16621576201ff02f9e284d867840c931");
  });
  it("changes when any field changes", async () => {
    const h1 = await receiptHash(body);
    const h2 = await receiptHash({ ...body, decision: "DECLINE" });
    expect(h2).not.toBe(h1);
  });
});
