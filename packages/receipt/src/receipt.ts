import { canonicalize, type Json } from "./canonical.js";
import { sha256Hex, utf8 } from "./hash.js";
import { RECEIPT_VERSION, SERVICE_NAME, OPERATOR_NAME, type Decision } from "./consent.js";

export interface ReceiptBody {
  version: typeof RECEIPT_VERSION;
  request: {
    id: string; item: string; purpose: string; provider: string; model: string; terms: string[];
  };
  decision: Decision;
  file: { sha256_client: string; sha256_relay: string | null; size: number };
  user: { pubkey: string; consent_text: string | null; signature: string | null };
  org: { service: string; operator: string; pubkey: string };
  time: { issued_at: string; relay_signed_at: string };
}

export interface Receipt extends ReceiptBody {
  receipt_hash: string;
  org_signature: string | null;         // base58 ed25519 over utf8(receipt_hash hex); null before the relay co-signs (step 1)
  anchor: {
    cluster: "devnet"; program: string; pda: string; tx: string; slot: number;
    block_time: number; solscan: string;
  } | null;
}

/** receipt_hash = sha256(canonical(body)). org_signature and anchor are outside the hash. */
export async function receiptHash(body: ReceiptBody): Promise<string> {
  return sha256Hex(utf8(canonicalize(body as unknown as Json)));
}

export function emptyOrg(pubkey: string) {
  return { service: SERVICE_NAME, operator: OPERATOR_NAME, pubkey };
}

export function solscanTx(sig: string): string {
  return `https://solscan.io/tx/${sig}?cluster=devnet`;
}
