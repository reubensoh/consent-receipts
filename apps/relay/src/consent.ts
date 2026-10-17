/**
 * Mocked model request and the consent route (brief 003). The relay stays stateless: it
 * recognises a request it issued by an HMAC over the request's canonical form and the wallet
 * it was issued to, not by a store. Nothing in this file logs.
 */
import bs58 from "bs58";
import nacl from "tweetnacl";
import {
  RECEIPT_VERSION, buildConsentText, canonicalize, emptyOrg, receiptHash, sha256Hex, utf8,
  type Json, type Receipt, type ReceiptBody,
} from "@consent-receipts/receipt";
import { PROGRAM_ID, type AnchorResult } from "@consent-receipts/anchor-client";
import { hmac, safeEq } from "./session.js";

/**
 * The four terms lines, verbatim from docs/RECEIPT-FORMAT.md, and the only copy in the relay.
 * The <YYYY-MM-DD> and <url> placeholders stay until the lawyer's wording arrives (QUESTIONS P2):
 * that is a one-line change here.
 */
export const TERMS: readonly string[] = [
  "used only to answer this conversation",
  "sent once to the provider named above, not kept on our side",
  "we do not permit training on it; the provider's policy of <YYYY-MM-DD>: <url>",
  "the provider has its own retention window; see that policy",
];

export const DEFAULT_MODEL = "gpt-mini-placeholder";
export const MAX_FILE_BYTES = 1024 * 1024;
export const PENDING_TTL_MS = 5 * 60 * 1000;

const MOCK_ITEM = "Documents/lab-report.md";
const MOCK_PURPOSE = "compare values to reference ranges";
const MOCK_PROVIDER = "OpenAI";
const ANSWER_APPROVED =
  "Mock answer. No model was called and nothing was sent to a provider. The relay checked your " +
  "signature and the file's hash against the sheet you approved.";
const ANSWER_DECLINED =
  "Mock answer. No model was called. The file was declined, so this answer is given without it.";

export interface OrgSigner { pubkey: string; sign(message: Uint8Array): Uint8Array }
export type AnchorFn = (hex: string) => Promise<AnchorResult>;
export interface ConsentDeps {
  secret: string;
  org: OrgSigner;
  anchor: AnchorFn;
  now: () => Date;
}

export interface Pending {
  id: string; item: string; purpose: string; provider: string; model: string;
  terms: string[]; issuedAt: string; expiresAt: string;
}

export interface ConsentResult { receipt: Receipt; answer: string; anchor_error?: true }

export const ERR = {
  bad: "bad request",
  mac: "request not issued to this session",
  expired: "request expired",
  text: "consent text does not match the request",
  signature: "signature invalid",
  tooLarge: "file too large",
  bytes: "file bytes invalid",
  size: "file size mismatch",
  hash: "file hash mismatch",
  declineExtra: "a decline carries nothing else",
} as const;

export class ConsentError extends Error {
  constructor(public status: 400 | 403 | 410 | 413, message: string) { super(message); }
}

const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function issuePending(model: string, now: Date): Pending {
  return {
    id: crypto.randomUUID(),
    item: MOCK_ITEM,
    purpose: MOCK_PURPOSE,
    provider: MOCK_PROVIDER,
    model,
    terms: [...TERMS],
    issuedAt: isoSeconds(now),
    expiresAt: isoSeconds(new Date(now.getTime() + PENDING_TTL_MS)),
  };
}

/** Binds a pending request to the wallet that was asked, so the relay can recognise it later. */
export function pendingMac(secret: string, pending: Pending, sessionPubkey: string): string {
  return hmac(secret, `pending|${canonicalize(pending as unknown as Json)}|${sessionPubkey}`);
}

function macValid(secret: string, pending: unknown, mac: unknown, sessionPubkey: string): pending is Pending {
  if (!isRecord(pending) || typeof mac !== "string") return false;
  try { return safeEq(mac, pendingMac(secret, pending as unknown as Pending, sessionPubkey)); }
  catch { return false; }          // canonicalize throws on anything we would never have issued
}

function decodeBase64(s: string): Uint8Array | null {
  if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
  return new Uint8Array(Buffer.from(s, "base64"));
}

function userSigned(text: string, signatureB58: string, pubkeyB58: string): boolean {
  try { return nacl.sign.detached.verify(utf8(text), bs58.decode(signatureB58), bs58.decode(pubkeyB58)); }
  catch { return false; }
}

/** Org signature, then anchor. The org signs before the anchor attempt, so a failed anchor never loses it. */
async function seal(d: ConsentDeps, body: ReceiptBody, answer: string): Promise<ConsentResult> {
  const receipt_hash = await receiptHash(body);
  const org_signature = bs58.encode(d.org.sign(utf8(receipt_hash)));
  let anchor: Receipt["anchor"] = null;
  let failed = false;
  try {
    const r = await d.anchor(receipt_hash);
    // Receipt.anchor cannot carry a null slot or block time; a landed tx the RPC cannot yet read is
    // reported as an anchor error rather than a receipt with invented numbers.
    if (r.slot === null || r.block_time === null) failed = true;
    else anchor = { cluster: "devnet", program: PROGRAM_ID.toBase58(), pda: r.pda, tx: r.tx, slot: r.slot, block_time: r.block_time, solscan: r.solscan };
  } catch { failed = true; }
  return { receipt: { ...body, receipt_hash, org_signature, anchor }, answer, ...(failed ? { anchor_error: true as const } : {}) };
}

/** POST /consent, APPROVE and DECLINE. Throws ConsentError with a short fixed string on the first failed check. */
export async function handleConsent(d: ConsentDeps, sessionPubkey: string, raw: unknown): Promise<ConsentResult> {
  if (!isRecord(raw)) throw new ConsentError(400, ERR.bad);
  const { pending, mac, decision } = raw;
  if (decision !== "APPROVE" && decision !== "DECLINE") throw new ConsentError(400, ERR.bad);
  if (!macValid(d.secret, pending, mac, sessionPubkey)) throw new ConsentError(403, ERR.mac);
  // From here on `pending` is exactly what this relay issued to this wallet.

  const request = { id: pending.id, item: pending.item, purpose: pending.purpose, provider: pending.provider, model: pending.model, terms: pending.terms };
  const org = emptyOrg(d.org.pubkey);

  if (decision === "DECLINE") {
    // Nothing about the file leaves the device: reject anything beyond the three fields rather than ignore it.
    if (Object.keys(raw).some((k) => k !== "pending" && k !== "mac" && k !== "decision")) throw new ConsentError(400, ERR.declineExtra);
    return seal(d, {
      version: RECEIPT_VERSION, request, decision: "DECLINE",
      file: { sha256_client: null, sha256_relay: null, size: null },
      user: { pubkey: sessionPubkey, consent_text: null, signature: null },
      org, time: { issued_at: pending.issuedAt, relay_signed_at: isoSeconds(d.now()) },
    }, ANSWER_DECLINED);
  }

  const { sha256, size, consent_text, signature, file_b64 } = raw;
  if (typeof sha256 !== "string" || typeof size !== "number" || typeof consent_text !== "string"
    || typeof signature !== "string" || typeof file_b64 !== "string") throw new ConsentError(400, ERR.bad);

  if (d.now().getTime() >= Date.parse(pending.expiresAt)) throw new ConsentError(410, ERR.expired);

  let expected: string;
  try {
    expected = buildConsentText({ request: { ...pending, sha256, size }, decision: "APPROVE", orgPubkey: d.org.pubkey, userPubkey: sessionPubkey });
  } catch { throw new ConsentError(400, ERR.bad); }   // a malformed hash or size cannot match any text we would build
  if (consent_text !== expected) throw new ConsentError(400, ERR.text);
  if (!userSigned(consent_text, signature, sessionPubkey)) throw new ConsentError(400, ERR.signature);

  if (size > MAX_FILE_BYTES) throw new ConsentError(413, ERR.tooLarge);
  const bytes = decodeBase64(file_b64);
  if (!bytes) throw new ConsentError(400, ERR.bytes);
  if (bytes.length !== size) throw new ConsentError(400, ERR.size);
  const relayHash = await sha256Hex(bytes);
  if (relayHash !== sha256) throw new ConsentError(400, ERR.hash);

  return seal(d, {
    version: RECEIPT_VERSION, request, decision: "APPROVE",
    file: { sha256_client: sha256, sha256_relay: relayHash, size },
    user: { pubkey: sessionPubkey, consent_text, signature },
    org, time: { issued_at: pending.issuedAt, relay_signed_at: isoSeconds(d.now()) },
  }, ANSWER_APPROVED);
}
