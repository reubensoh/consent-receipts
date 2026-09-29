/**
 * The human-readable consent text the wallet displays and the user signs.
 * This exact string is stored in the receipt and verified byte for byte by the relay.
 * Only APPROVE is wallet-signed by default; DECLINE text exists for the optional
 * "keep a signed copy" after a decline (off by default). See docs/RECEIPT-FORMAT.md.
 */
export const RECEIPT_VERSION = "consent-receipt/0";
export const SERVICE_NAME = "Flair Health consent receipts (prototype)";
export const OPERATOR_NAME = "Regal Pines Pte. Ltd.";

export type Decision = "APPROVE" | "DECLINE";

export interface ConsentRequest {
  id: string;            // uuid v4
  item: string;          // "Documents/bloodwork.md"
  sha256: string;        // 64 hex, computed client-side after metadata strip
  size: number;          // bytes, after strip
  purpose: string;       // the model's stated purpose, <= 140 chars, shown verbatim
  provider: string;      // "OpenAI"
  model: string;         // model id
  terms: string[];       // our terms, one line each, lawyer-approved
  issuedAt: string;      // ISO 8601 UTC, seconds precision
  expiresAt: string;     // ISO 8601 UTC
}

export interface ConsentTextInput {
  request: ConsentRequest;
  decision: Decision;
  orgPubkey: string;     // base58
  userPubkey: string;    // base58
}

export function formatSize(n: number): string {
  return n.toLocaleString("en-US") + " bytes";
}

/**
 * Validates every field, then builds the text. Throws on anything that could add, split, or
 * impersonate a line. Callers cannot skip this: the text is only produced by this function.
 */
export function buildConsentText(i: ConsentTextInput): string {
  validateConsentInput(i);
  const r = i.request;
  const lines = [
    "Consent receipt request",
    `Version: ${RECEIPT_VERSION}`,
    "",
    `Service: ${SERVICE_NAME}`,
    `Operator: ${OPERATOR_NAME}`,
    `Operator key: ${i.orgPubkey}`,
    `Item: ${r.item}`,
    `SHA-256: ${r.sha256}`,
    `Size: ${formatSize(r.size)}`,
    `Purpose: ${r.purpose}`,
    `Provider: ${r.provider}`,
    `Model: ${r.model}`,
    "Terms (ours):",
    ...r.terms.map((t) => `  - ${t}`),
    `Decision: ${i.decision}`,
    `Request ID: ${r.id}`,
    `Issued at: ${r.issuedAt}`,
    `Expires at: ${r.expiresAt}`,
    `Signed by: ${i.userPubkey}`,
  ];
  return lines.join("\n");
}

export const PURPOSE_MAX = 140;
export const TERMS_MAX_LINES = 8;

/** Reject anything that would let a line break the layout or impersonate a field. */
export function assertSafeField(name: string, v: string, max = 200): void {
  if (typeof v !== "string") throw new Error(`${name}: must be a string`);
  if (v.length === 0) throw new Error(`${name}: empty`);
  if (v.length > max) throw new Error(`${name}: longer than ${max}`);
  // C0/C1 controls, Unicode line and paragraph separators, zero-width and bidi controls
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(v))
    throw new Error(`${name}: control or invisible characters not allowed`);
  if (v !== v.trim()) throw new Error(`${name}: leading or trailing whitespace`);
}

const BASE58_32 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validateConsentInput(i: ConsentTextInput): void {
  const r = i.request;
  if (!UUID.test(r.id)) throw new Error("request.id: not a lowercase uuid");
  assertSafeField("item", r.item, 120);
  if (!/^[0-9a-f]{64}$/.test(r.sha256)) throw new Error("sha256: not 64 lowercase hex");
  if (!Number.isSafeInteger(r.size) || r.size < 0) throw new Error("size: not a non-negative integer");
  assertSafeField("purpose", r.purpose, PURPOSE_MAX);
  assertSafeField("provider", r.provider, 40);
  assertSafeField("model", r.model, 80);
  if (!Array.isArray(r.terms) || r.terms.length === 0 || r.terms.length > TERMS_MAX_LINES)
    throw new Error(`terms: need 1 to ${TERMS_MAX_LINES} lines`);
  r.terms.forEach((t, n) => assertSafeField(`terms[${n}]`, t, 160));
  if (!ISO_UTC.test(r.issuedAt)) throw new Error("issuedAt: not ISO 8601 UTC seconds");
  if (!ISO_UTC.test(r.expiresAt)) throw new Error("expiresAt: not ISO 8601 UTC seconds");
  if (Date.parse(r.expiresAt) <= Date.parse(r.issuedAt)) throw new Error("expiresAt: not after issuedAt");
  if (i.decision !== "APPROVE" && i.decision !== "DECLINE") throw new Error("decision: not APPROVE or DECLINE");
  if (!BASE58_32.test(i.orgPubkey)) throw new Error("orgPubkey: not base58");
  if (!BASE58_32.test(i.userPubkey)) throw new Error("userPubkey: not base58");
}
