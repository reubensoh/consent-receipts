import {
  RECEIPT_VERSION, emptyOrg, receiptHash,
  type ConsentRequest, type Receipt, type ReceiptBody,
} from "@consent-receipts/receipt";
import { ORG_PUBKEY } from "./consentRequest.js";

/**
 * These are browser-side DRAFTS. The browser never fills a field only the relay can know:
 * `file.sha256_relay`, `time.relay_signed_at`, and `org_signature` stay null until the relay
 * supplies them. `verifyReceiptOffline` reports those as "awaiting operator", not as passes.
 */
export async function buildApproveReceipt(
  request: ConsentRequest, consentText: string, userPubkey: string, userSignature: string,
): Promise<Receipt> {
  const body: ReceiptBody = {
    version: RECEIPT_VERSION,
    request: {
      id: request.id, item: request.item, purpose: request.purpose,
      provider: request.provider, model: request.model, terms: request.terms,
    },
    decision: "APPROVE",
    file: { sha256_client: request.sha256, sha256_relay: null, size: request.size },
    user: { pubkey: userPubkey, consent_text: consentText, signature: userSignature },
    org: emptyOrg(ORG_PUBKEY),
    time: { issued_at: request.issuedAt, relay_signed_at: null },
  };
  const receipt_hash = await receiptHash(body);
  return { ...body, receipt_hash, org_signature: null, anchor: null };
}

export async function buildDeclineReceipt(request: ConsentRequest, userPubkey: string): Promise<Receipt> {
  const body: ReceiptBody = {
    version: RECEIPT_VERSION,
    request: {
      id: request.id, item: request.item, purpose: request.purpose,
      provider: request.provider, model: request.model, terms: request.terms,
    },
    decision: "DECLINE",
    file: { sha256_client: null, sha256_relay: null, size: null }, // a decline carries nothing about the file
    user: { pubkey: userPubkey, consent_text: null, signature: null },
    org: emptyOrg(ORG_PUBKEY),
    time: { issued_at: request.issuedAt, relay_signed_at: null },
  };
  const receipt_hash = await receiptHash(body);
  return { ...body, receipt_hash, org_signature: null, anchor: null };
}

export function isExpired(request: ConsentRequest, now = new Date()): boolean {
  return now.getTime() >= Date.parse(request.expiresAt);
}
