/**
 * Sign-in without accounts. Stateless: the challenge nonce and the session token are both
 * HMACs over the secret, so the relay stores nothing. The wallet address travels only in
 * request bodies and the Authorization header, never in a URL.
 *
 * The sign-in message follows the Sign In With Solana layout so wallets that implement the
 * `signIn` feature render it natively; wallets without it sign the same text via signMessage.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { utf8 } from "@consent-receipts/receipt";

export const SESSION_TTL_S = 60 * 60;       // 1 hour (QUESTIONS D3 default)
export const CHALLENGE_TTL_S = 5 * 60;

const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export interface Challenge { message: string; issuedAt: string; nonce: string }

export function buildSignInMessage(domain: string, pubkey: string, nonce: string, issuedAt: string): string {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    pubkey,
    "",
    "Consent receipts prototype. No account is created. Signing proves you hold this key.",
    "",
    `URI: https://${domain}`,
    "Version: 1",
    "Chain ID: devnet",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export function createChallenge(secret: string, domain: string, pubkey: string, now = new Date()): Challenge {
  assertPubkey(pubkey);
  const issuedAt = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = hmac(secret, `challenge|${pubkey}|${issuedAt}`).slice(0, 16);
  return { message: buildSignInMessage(domain, pubkey, nonce, issuedAt), issuedAt, nonce };
}

export interface SignInProof { pubkey: string; message: string; signature: string /* base58 */ }

/** Returns the pubkey on success, throws on any failure. Never logs inputs. */
export function verifySignIn(secret: string, domain: string, p: SignInProof, now = new Date()): string {
  assertPubkey(p.pubkey);
  const issuedAt = /^Issued At: (.+)$/m.exec(p.message)?.[1];
  const nonce = /^Nonce: (.+)$/m.exec(p.message)?.[1];
  if (!issuedAt || !nonce) throw new Error("sign-in: malformed message");
  const expected = buildSignInMessage(domain, p.pubkey, nonce, issuedAt);
  if (expected !== p.message) throw new Error("sign-in: message does not match challenge layout");
  if (!safeEq(nonce, hmac(secret, `challenge|${p.pubkey}|${issuedAt}`).slice(0, 16))) throw new Error("sign-in: bad nonce");
  const age = (now.getTime() - Date.parse(issuedAt)) / 1000;
  if (!(age >= -60 && age <= CHALLENGE_TTL_S)) throw new Error("sign-in: challenge expired");
  const ok = nacl.sign.detached.verify(utf8(p.message), bs58.decode(p.signature), bs58.decode(p.pubkey));
  if (!ok) throw new Error("sign-in: bad signature");
  return p.pubkey;
}

export function issueToken(secret: string, pubkey: string, now = new Date()): string {
  const exp = Math.floor(now.getTime() / 1000) + SESSION_TTL_S;
  const payload = `${pubkey}.${exp}`;
  return `${payload}.${hmac(secret, `token|${payload}`)}`;
}

/** Returns the pubkey or null. */
export function verifyToken(secret: string, token: string | undefined, now = new Date()): string | null {
  if (!token) return null;
  const [pubkey, expS, mac] = token.split(".");
  if (!pubkey || !expS || !mac) return null;
  if (!safeEq(mac, hmac(secret, `token|${pubkey}.${expS}`))) return null;
  if (Number(expS) < Math.floor(now.getTime() / 1000)) return null;
  return pubkey;
}

function assertPubkey(k: string) {
  let b: Uint8Array;
  try { b = bs58.decode(k); } catch { throw new Error("bad pubkey"); }
  if (b.length !== 32) throw new Error("bad pubkey");
}
