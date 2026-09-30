import {
  RECEIPT_VERSION, emptyOrg, receiptHash,
  type ConsentRequest, type Receipt, type ReceiptBody,
} from "@consent-receipts/receipt";
import { ORG_PUBKEY } from "./consentRequest.js";

/**
 * Step 1 has no relay round-trip for file bytes (no vault yet), so the relay-side hash is the
 * same value the client already has — that is what makes every offline check pass except
 * "org signature over receipt_hash" (step 1 never co-signs; see docs/briefs/002).
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
    file: { sha256_client: request.sha256, sha256_relay: request.sha256, size: request.size },
    user: { pubkey: userPubkey, consent_text: consentText, signature: userSignature },
    org: emptyOrg(ORG_PUBKEY),
    time: { issued_at: request.issuedAt, relay_signed_at: isoNowSeconds() },
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
    file: { sha256_client: request.sha256, sha256_relay: null, size: request.size },
    user: { pubkey: userPubkey, consent_text: null, signature: null },
    org: emptyOrg(ORG_PUBKEY),
    time: { issued_at: request.issuedAt, relay_signed_at: isoNowSeconds() },
  };
  const receipt_hash = await receiptHash(body);
  return { ...body, receipt_hash, org_signature: null, anchor: null };
}

function isoNowSeconds(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
