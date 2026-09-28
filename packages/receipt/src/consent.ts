/**
 * The human-readable consent text the wallet displays and the user signs.
 * This exact string is stored in the receipt and verified byte for byte by the relay.
 * Only APPROVE is wallet-signed by default; DECLINE text exists for the optional
 * "keep a signed copy" after a decline (off by default). See docs/RECEIPT-FORMAT.md.
 */
export const RECEIPT_VERSION = "consent-receipt/0";
export const SERVICE_NAME = "consent-receipts (demo)";
export const OPERATOR_NAME = "Reuben Soh";

export type Decision = "APPROVE" | "DECLINE";

export interface ConsentRequest {
  id: string;            // uuid v4
  item: string;          // "Documents/bloodwork.md"
  sha256: string;        // 64 hex, computed client-side after metadata strip
  size: number;          // bytes, after strip
  purpose: string;       // the model's stated purpose, <= 140 chars, shown verbatim
  provider: string;      // "Anthropic"
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

export function buildConsentText(i: ConsentTextInput): string {
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

/** Reject anything that would let a line break the layout or impersonate a field. */
export function assertSafeField(name: string, v: string, max = 200): void {
  if (v.length > max) throw new Error(`${name}: longer than ${max}`);
  if (/[\r\n\t]/.test(v)) throw new Error(`${name}: control characters not allowed`);
}
