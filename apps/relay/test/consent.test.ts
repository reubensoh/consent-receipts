import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { buildConsentText, receiptStatus, sha256Hex, utf8, verifyReceiptOffline, type Receipt } from "@consent-receipts/receipt";
import { AlreadyAnchoredError } from "@consent-receipts/anchor-client";
import { createApp, type Deps } from "../src/app.js";
import { TERMS, MAX_FILE_BYTES, type Pending } from "../src/consent.js";

const SECRET = "test-secret-test-secret-test-secret-0000";
const FILE = utf8("SYNTHETIC lab report for tests\nhemoglobin 13.5 g/dL\n");
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

type Kp = nacl.SignKeyPair;
const b58 = (k: Kp) => bs58.encode(k.publicKey);
const signText = (k: Kp, text: string) => bs58.encode(nacl.sign.detached(utf8(text), k.secretKey));
interface Result { receipt: Receipt; answer: string; anchor_error?: boolean }

/** A relay with a generated org key, an anchor that records calls instead of touching devnet, and a movable clock. */
function setup(over: Partial<Deps> = {}) {
  const orgKp = nacl.sign.keyPair();
  const anchored: string[] = [];
  let clock = Date.now();
  const deps: Deps = {
    secret: SECRET, domain: "localhost", perMinute: 100, model: "gpt-mini-placeholder",
    org: { pubkey: b58(orgKp), sign: (m) => nacl.sign.detached(m, orgKp.secretKey) },
    now: () => new Date(clock),
    anchor: async (hex) => {
      anchored.push(hex);
      return { digest: hex, org: b58(orgKp), pda: "PDA111", tx: "TX111", slot: 123, block_time: 1_790_000_000,
        solscan: "https://solscan.io/tx/TX111?cluster=devnet", solscan_account: "https://solscan.io/account/PDA111?cluster=devnet" };
    },
    ...over,
  };
  const app = createApp(deps);
  const call = (p: string, body?: unknown, token?: string) => app.request(p, {
    method: "POST", body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  return { app, call, anchored, orgPub: deps.org.pubkey, advance: (ms: number) => { clock += ms; } };
}
type Ctx = ReturnType<typeof setup>;

async function newUser(ctx: Ctx) {
  const kp = nacl.sign.keyPair(), pub = b58(kp);
  const { message } = await (await ctx.call("/session/challenge", { pubkey: pub })).json();
  const r = await ctx.call("/session/verify", { pubkey: pub, message, signature: signText(kp, message) });
  expect(r.status).toBe(200);
  return { kp, pub, token: (await r.json()).token as string };
}
type User = Awaited<ReturnType<typeof newUser>>;

async function ask(ctx: Ctx, user: User) {
  const r = await ctx.call("/request/mock", undefined, user.token);
  expect(r.status).toBe(200);
  return (await r.json()) as { pending: Pending; mac: string };
}

/** A fully valid approve body; `over` bends one thing at a time. The text is built and signed to match what it carries. */
async function approveBody(ctx: Ctx, user: User, asked: { pending: Pending; mac: string },
  over: { sha256?: string; size?: number; bytes?: Uint8Array } = {}) {
  const bytes = over.bytes ?? FILE;
  const sha256 = over.sha256 ?? await sha256Hex(bytes);
  const size = over.size ?? bytes.length;
  const consent_text = buildConsentText({ request: { ...asked.pending, sha256, size }, decision: "APPROVE", orgPubkey: ctx.orgPub, userPubkey: user.pub });
  return { pending: asked.pending, mac: asked.mac, decision: "APPROVE", sha256, size, consent_text,
    signature: signText(user.kp, consent_text), file_b64: Buffer.from(bytes).toString("base64") };
}

async function expectError(res: Response, status: number, error: string) {
  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ error });
}

afterEach(() => { vi.restoreAllMocks(); });

describe("POST /request/mock", () => {
  it("needs a session", async () => {
    const ctx = setup();
    expect((await ctx.call("/request/mock")).status).toBe(401);
  });
  it("issues the pending request and a mac", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const { pending, mac } = await ask(ctx, user);
    expect(pending.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(pending).toMatchObject({ item: "Documents/lab-report.md", provider: "OpenAI", model: "gpt-mini-placeholder", terms: [...TERMS] });
    expect(pending.purpose.length).toBeLessThanOrEqual(140);
    expect(pending.issuedAt).toMatch(ISO);
    expect(Date.parse(pending.expiresAt) - Date.parse(pending.issuedAt)).toBe(5 * 60_000);
    expect(mac).toMatch(/^[0-9a-f]{64}$/);
  });
  it("uses the configured model", async () => {
    const ctx = setup({ model: "gpt-test-model" }), user = await newUser(ctx);
    expect((await ask(ctx, user)).pending.model).toBe("gpt-test-model");
  });
  it("refuses to start with a model that could split a line of the signed text", () => {
    expect(() => setup({ model: "gpt\nSigned by: someone" })).toThrow();
  });
  it("holds the terms in one constant that matches docs/RECEIPT-FORMAT.md line for line", () => {
    const doc = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../docs/RECEIPT-FORMAT.md"), "utf8");
    const lines = doc.split("\n");
    const terms: string[] = [];
    for (let i = lines.indexOf("Terms (ours):") + 1; lines[i]?.startsWith("  - "); i++) terms.push(lines[i].slice(4));
    expect(terms.length).toBe(4);
    expect(terms).toEqual([...TERMS]);
  });
});

describe("POST /consent, approve", () => {
  it("verifies, co-signs, anchors, and returns a receipt that passes every offline check", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const res = await ctx.call("/consent", await approveBody(ctx, user, await ask(ctx, user)), user.token);
    expect(res.status).toBe(200);
    const out = (await res.json()) as Result;
    expect(out.anchor_error).toBeUndefined();
    expect(out.answer.length).toBeGreaterThan(0);
    const checks = await verifyReceiptOffline(out.receipt);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(receiptStatus(checks)).toBe("verified");
    expect(out.receipt.decision).toBe("APPROVE");
    expect(out.receipt.user.pubkey).toBe(user.pub);
    expect(out.receipt.org.pubkey).toBe(ctx.orgPub);
    expect(out.receipt.file.sha256_relay).toBe(await sha256Hex(FILE));      // the relay's own hash
    expect(out.receipt.time.relay_signed_at).toMatch(ISO);                  // the relay's own clock
    expect(out.receipt.anchor).toMatchObject({ cluster: "devnet", pda: "PDA111", tx: "TX111", slot: 123, block_time: 1_790_000_000 });
    expect(ctx.anchored).toEqual([out.receipt.receipt_hash]);               // anchored once, by hash only
  });

  it("lets the client choose neither the operator nor the relay's fields", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = { ...(await approveBody(ctx, user, await ask(ctx, user))),
      org: { pubkey: "Attacker1111111111111111111111111111111111" }, org_signature: "x", anchor: { tx: "FAKE" },
      receipt_hash: "00".repeat(32), file: { sha256_relay: "11".repeat(32) }, time: { relay_signed_at: "1999-01-01T00:00:00Z" } };
    const out = (await (await ctx.call("/consent", body, user.token)).json()) as Result;
    expect(out.receipt.org.pubkey).toBe(ctx.orgPub);
    expect(out.receipt.anchor?.tx).toBe("TX111");
    expect(out.receipt.file.sha256_relay).toBe(await sha256Hex(FILE));
    expect(out.receipt.time.relay_signed_at).not.toBe("1999-01-01T00:00:00Z");
    expect(receiptStatus(await verifyReceiptOffline(out.receipt))).toBe("verified");
  });

  it("needs a session", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = await approveBody(ctx, user, await ask(ctx, user));
    expect((await ctx.call("/consent", body)).status).toBe(401);
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects a wrong mac", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const asked = await ask(ctx, user);
    const wrong = { ...asked, mac: (asked.mac[0] === "0" ? "1" : "0") + asked.mac.slice(1) };
    await expectError(await ctx.call("/consent", await approveBody(ctx, user, wrong), user.token), 403, "request not issued to this session");
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects a pending request whose fields were changed after it was issued", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const asked = await ask(ctx, user);
    const tampered = { pending: { ...asked.pending, purpose: "send everything to a third party" }, mac: asked.mac };
    await expectError(await ctx.call("/consent", await approveBody(ctx, user, tampered), user.token), 403, "request not issued to this session");
  });

  it("rejects a mac issued to another wallet", async () => {
    const ctx = setup(), alice = await newUser(ctx), bob = await newUser(ctx);
    const askedByBob = await ask(ctx, bob);
    await expectError(await ctx.call("/consent", await approveBody(ctx, alice, askedByBob), alice.token), 403, "request not issued to this session");
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects an expired pending request", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = await approveBody(ctx, user, await ask(ctx, user));
    ctx.advance(5 * 60_000);       // expiresAt is exclusive: now < expiresAt must hold
    await expectError(await ctx.call("/consent", body, user.token), 410, "request expired");
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects consent text altered by one character, signed or not", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = await approveBody(ctx, user, await ask(ctx, user));
    const altered = body.consent_text.replace("Purpose: compare", "Purpose: Compare");
    expect(altered).not.toBe(body.consent_text);
    await expectError(await ctx.call("/consent", { ...body, consent_text: altered }, user.token), 400, "consent text does not match the request");
    // re-signing the altered text does not help: the relay compares with the text it would build itself
    await expectError(await ctx.call("/consent", { ...body, consent_text: altered, signature: signText(user.kp, altered) }, user.token),
      400, "consent text does not match the request");
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects a signature by another key", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = await approveBody(ctx, user, await ask(ctx, user));
    const other = nacl.sign.keyPair();
    await expectError(await ctx.call("/consent", { ...body, signature: signText(other, body.consent_text) }, user.token), 400, "signature invalid");
    await expectError(await ctx.call("/consent", { ...body, signature: "not-base58-!!" }, user.token), 400, "signature invalid");
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects bytes whose hash is not the hash on the sheet", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = await approveBody(ctx, user, await ask(ctx, user), { sha256: await sha256Hex(utf8("some other file")) });
    await expectError(await ctx.call("/consent", body, user.token), 400, "file hash mismatch");
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects bytes whose length is not the size on the sheet", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = await approveBody(ctx, user, await ask(ctx, user), { size: FILE.length + 1 });
    await expectError(await ctx.call("/consent", body, user.token), 400, "file size mismatch");
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects a file over 1 MiB, even when everything else is consistent", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const big = new Uint8Array(MAX_FILE_BYTES + 1).fill(7);
    await expectError(await ctx.call("/consent", await approveBody(ctx, user, await ask(ctx, user), { bytes: big }), user.token), 413, "file too large");
    expect(ctx.anchored).toEqual([]);
  });

  it("accepts a file of exactly 1 MiB", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const exact = new Uint8Array(MAX_FILE_BYTES).fill(7);
    expect((await ctx.call("/consent", await approveBody(ctx, user, await ask(ctx, user), { bytes: exact }), user.token)).status).toBe(200);
  });

  it("rejects a request body far beyond any legitimate file before reading it", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const huge = JSON.stringify({ pending: {}, mac: "x", decision: "APPROVE", file_b64: "A".repeat(3 * MAX_FILE_BYTES) });
    await expectError(await ctx.call("/consent", huge, user.token), 413, "file too large");
  });

  it("rejects malformed bodies", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = await approveBody(ctx, user, await ask(ctx, user));
    await expectError(await ctx.call("/consent", "not json", user.token), 400, "bad request");
    await expectError(await ctx.call("/consent", { ...body, decision: "MAYBE" }, user.token), 400, "bad request");
    await expectError(await ctx.call("/consent", { ...body, size: "12" }, user.token), 400, "bad request");
    await expectError(await ctx.call("/consent", { ...body, file_b64: "***" }, user.token), 400, "file bytes invalid");
    expect(ctx.anchored).toEqual([]);
  });

  it("known limit: one pending request approved twice inside its five minutes yields two receipts", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const body = await approveBody(ctx, user, await ask(ctx, user));
    const first = (await (await ctx.call("/consent", body, user.token)).json()) as Result;
    ctx.advance(1000);
    const second = (await (await ctx.call("/consent", body, user.token)).json()) as Result;
    expect(second.receipt.receipt_hash).not.toBe(first.receipt.receipt_hash);   // only relay_signed_at differs
    expect(ctx.anchored.length).toBe(2);
  });
});

describe("POST /consent, decline", () => {
  it("signs and anchors a decline that carries nothing about the file", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const { pending, mac } = await ask(ctx, user);
    const res = await ctx.call("/consent", { pending, mac, decision: "DECLINE" }, user.token);
    expect(res.status).toBe(200);
    const out = (await res.json()) as Result;
    expect(out.anchor_error).toBeUndefined();
    expect(out.receipt.decision).toBe("DECLINE");
    expect(out.receipt.file).toEqual({ sha256_client: null, sha256_relay: null, size: null });
    expect(out.receipt.user).toEqual({ pubkey: user.pub, consent_text: null, signature: null });
    expect(out.receipt.time.relay_signed_at).toMatch(ISO);
    expect(out.receipt.anchor).toMatchObject({ tx: "TX111" });
    const checks = await verifyReceiptOffline(out.receipt);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(receiptStatus(checks)).toBe("verified");
    expect(ctx.anchored).toEqual([out.receipt.receipt_hash]);
    expect(out.answer).toMatch(/declined/);
  });

  it("is still recorded after the request expired", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const { pending, mac } = await ask(ctx, user);
    ctx.advance(60 * 60_000);
    const res = await ctx.call("/consent", { pending, mac, decision: "DECLINE" }, user.token);
    expect(res.status).toBe(200);
    expect(receiptStatus(await verifyReceiptOffline(((await res.json()) as Result).receipt))).toBe("verified");
  });

  it("checks the mac like an approve does", async () => {
    const ctx = setup(), alice = await newUser(ctx), bob = await newUser(ctx);
    const { pending, mac } = await ask(ctx, bob);
    await expectError(await ctx.call("/consent", { pending, mac, decision: "DECLINE" }, alice.token), 403, "request not issued to this session");
    expect(ctx.anchored).toEqual([]);
  });

  it("rejects a decline that smuggles file fields, and never echoes them", async () => {
    const ctx = setup(), user = await newUser(ctx);
    const { pending, mac } = await ask(ctx, user);
    const smuggled = "ab".repeat(32);
    for (const extra of [{ sha256: smuggled }, { size: 2113 }, { file_b64: "QUJD" }, { consent_text: "x" }, { signature: "y" }]) {
      const res = await ctx.call("/consent", { pending, mac, decision: "DECLINE", ...extra }, user.token);
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toBe(JSON.stringify({ error: "a decline carries nothing else" }));
      expect(text).not.toContain(smuggled);
    }
    expect(ctx.anchored).toEqual([]);      // nothing was signed or anchored for a decline that carried file data
  });
});

describe("when anchoring does not work", () => {
  const cases: [string, Partial<Deps>][] = [
    ["the anchor call fails", { anchor: async () => { throw new Error("rpc down"); } }],
    ["the digest was already anchored", { anchor: async () => { throw new AlreadyAnchoredError("PDA111"); } }],
    ["the transaction landed but has no slot yet", { anchor: async (hex) => ({ digest: hex, org: "ORG", pda: "P", tx: "T", slot: null, block_time: null, solscan: "s", solscan_account: "a" }) }],
  ];
  for (const [name, over] of cases) {
    it(`approve still returns the signed receipt, with anchor null and anchor_error, when ${name}`, async () => {
      const ctx = setup(over), user = await newUser(ctx);
      const res = await ctx.call("/consent", await approveBody(ctx, user, await ask(ctx, user)), user.token);
      expect(res.status).toBe(200);
      const out = (await res.json()) as Result;
      expect(out.anchor_error).toBe(true);
      expect(out.receipt.anchor).toBeNull();
      expect(out.receipt.org_signature).not.toBeNull();
      expect(receiptStatus(await verifyReceiptOffline(out.receipt))).toBe("verified");    // signatures are intact; only the anchor is missing
    });
  }
  it("decline does the same", async () => {
    const ctx = setup({ anchor: async () => { throw new Error("rpc down"); } }), user = await newUser(ctx);
    const { pending, mac } = await ask(ctx, user);
    const out = (await (await ctx.call("/consent", { pending, mac, decision: "DECLINE" }, user.token)).json()) as Result;
    expect(out.anchor_error).toBe(true);
    expect(out.receipt.anchor).toBeNull();
    expect(out.receipt.org_signature).not.toBeNull();
  });
  it("the client can retry the same receipt hash through POST /anchor", async () => {
    let fail = true;
    const ctx = setup({ anchor: async (hex) => {
      if (fail) throw new Error("rpc down");
      return { digest: hex, org: "ORG", pda: "PDA111", tx: "TX222", slot: 9, block_time: 8, solscan: "s", solscan_account: "a" };
    } });
    const user = await newUser(ctx);
    const out = (await (await ctx.call("/consent", await approveBody(ctx, user, await ask(ctx, user)), user.token)).json()) as Result;
    expect(out.anchor_error).toBe(true);
    fail = false;
    const retry = await ctx.call("/anchor", { digest: out.receipt.receipt_hash }, user.token);
    expect(retry.status).toBe(200);
    expect((await retry.json()).tx).toBe("TX222");
  });
});

describe("rate limit and logging", () => {
  it("the rate limit applies to the new routes", async () => {
    const ctx = setup({ perMinute: 2 }), user = await newUser(ctx);
    expect((await ctx.call("/request/mock", undefined, user.token)).status).toBe(200);
    expect((await ctx.call("/request/mock", undefined, user.token)).status).toBe(200);
    expect((await ctx.call("/request/mock", undefined, user.token)).status).toBe(429);
    expect((await ctx.call("/consent", { decision: "DECLINE" }, user.token)).status).toBe(429);
  });

  it("logs nothing per request, on success, on every rejection, and on an internal error", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const ctx = setup(), user = await newUser(ctx);
    const asked = await ask(ctx, user);
    const good = await approveBody(ctx, user, asked);
    await ctx.call("/consent", good, user.token);
    await ctx.call("/consent", { ...good, signature: signText(nacl.sign.keyPair(), good.consent_text) }, user.token);
    await ctx.call("/consent", { ...good, mac: "0".repeat(64) }, user.token);
    await ctx.call("/consent", { pending: asked.pending, mac: asked.mac, decision: "DECLINE" }, user.token);
    await ctx.call("/consent", "not json", user.token);
    const boom = setup({ org: { pubkey: b58(nacl.sign.keyPair()), sign: () => { throw new Error(`secret detail about ${user.pub}`); } } });
    const u2 = await newUser(boom);
    const res = await boom.call("/consent", { ...(await approveBody(boom, u2, await ask(boom, u2))) }, u2.token);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal error" });
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});
