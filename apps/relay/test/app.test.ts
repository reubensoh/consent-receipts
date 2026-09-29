import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createApp } from "../src/app.js";
import { verifySignIn, createChallenge, issueToken, verifyToken } from "../src/session.js";
import { AlreadyAnchoredError } from "@consent-receipts/anchor-client";

const SECRET = "test-secret-test-secret-test-secret-0000";
const DOMAIN = "localhost";
const kp = nacl.sign.keyPair();
const PUB = bs58.encode(kp.publicKey);
const sign = (msg: string) => bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey));
const anchored = new Set<string>();
const mkApp = () => createApp({
  secret: SECRET, domain: DOMAIN, perMinute: 3,
  anchor: async (hex) => {
    if (anchored.has(hex)) throw new AlreadyAnchoredError("PDA111");
    anchored.add(hex);
    return { digest: hex, org: "ORG", pda: "PDA111", tx: "TX", slot: 1, block_time: 2, solscan: "s", solscan_account: "a" };
  },
});
const app = mkApp();
const post = (path: string, body: unknown, token?: string, a = app) =>
  a.request(path, { method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) } });

async function signIn(): Promise<string> {
  const { message } = await (await post("/session/challenge", { pubkey: PUB })).json();
  const r = await post("/session/verify", { pubkey: PUB, message, signature: sign(message) });
  expect(r.status).toBe(200);
  return (await r.json()).token;
}

describe("session", () => {
  it("challenge → sign → token round-trips with a real ed25519 key", async () => {
    const token = await signIn();
    expect(verifyToken(SECRET, token)).toBe(PUB);
  });
  it("rejects a signature from another key", async () => {
    const other = nacl.sign.keyPair();
    const { message } = createChallenge(SECRET, DOMAIN, PUB);
    const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), other.secretKey));
    expect(() => verifySignIn(SECRET, DOMAIN, { pubkey: PUB, message, signature: sig })).toThrow(/bad signature/);
  });
  it("rejects a tampered message and a forged nonce", async () => {
    const { message } = createChallenge(SECRET, DOMAIN, PUB);
    const tampered = message.replace("Nonce: ", "Nonce: 0");
    expect(() => verifySignIn(SECRET, DOMAIN, { pubkey: PUB, message: tampered, signature: sign(tampered) })).toThrow();
  });
  it("rejects an expired challenge and an expired token", async () => {
    const past = new Date(Date.now() - 10 * 60_000);
    const { message } = createChallenge(SECRET, DOMAIN, PUB, past);
    expect(() => verifySignIn(SECRET, DOMAIN, { pubkey: PUB, message, signature: sign(message) })).toThrow(/expired/);
    const old = issueToken(SECRET, PUB, new Date(Date.now() - 2 * 3600_000));
    expect(verifyToken(SECRET, old)).toBeNull();
  });
  it("never puts the pubkey in a URL", async () => {
    // all session routes are POST with JSON bodies; this pins that contract
    const r = await app.request(`/session/challenge?pubkey=${PUB}`, { method: "GET" });
    expect(r.status).toBe(404);
  });
});

describe("POST /anchor", () => {
  it("requires a session", async () => {
    expect((await post("/anchor", { digest: "ab".repeat(32) })).status).toBe(401);
  });
  it("anchors, then refuses the same digest with 409, then rate-limits", async () => {
    const token = await signIn();
    const d = "cd".repeat(32);
    const r1 = await post("/anchor", { digest: d }, token);
    expect(r1.status).toBe(200);
    expect((await r1.json()).pda).toBe("PDA111");
    const r2 = await post("/anchor", { digest: d }, token);
    expect(r2.status).toBe(409);
    const r3 = await post("/anchor", { digest: "ef".repeat(32) }, token);
    expect(r3.status).toBe(200);
    const r4 = await post("/anchor", { digest: "12".repeat(32) }, token);   // 4th call in the minute, limit 3
    expect(r4.status).toBe(429);
  });
  it("rejects a malformed digest (fresh app, so the rate limit from the previous test does not apply)", async () => {
    const fresh = mkApp();
    const token = await signIn();
    expect((await post("/anchor", { digest: "zz" }, token, fresh)).status).toBe(400);
  });
});
