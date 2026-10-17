/**
 * Relay client. Every call is a fetch with the pubkey in the body only, never a URL — the
 * relay's own routes never accept it any other way (docs/ARCHITECTURE.md, "Sign-in").
 * The session token goes in an Authorization header and is held in memory by the caller.
 */
import type { Receipt } from "@consent-receipts/receipt";

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? "http://localhost:8787";

async function postJson<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${RELAY_URL}${path}`, {
    method: "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `relay error: ${res.status}`);
  return json;
}

export interface Challenge {
  message: string;
}

export function challenge(pubkey: string): Promise<Challenge> {
  return postJson<Challenge>("/session/challenge", { pubkey });
}

export interface VerifyResult {
  token: string;
}

export function verify(pubkey: string, message: string, signature: string): Promise<VerifyResult> {
  return postJson<VerifyResult>("/session/verify", { pubkey, message, signature });
}

/** What the mocked model asked for. The mac lets the stateless relay recognise it again. */
export interface Pending {
  id: string; item: string; purpose: string; provider: string; model: string;
  terms: string[]; issuedAt: string; expiresAt: string;
}

export interface Asked {
  pending: Pending;
  mac: string;
}

export function requestMock(token: string): Promise<Asked> {
  return postJson<Asked>("/request/mock", undefined, token);
}

/** The relay's answer to a consent: the final receipt, the mocked model's answer, and whether anchoring failed. */
export interface ConsentResponse {
  receipt: Receipt;
  answer: string;
  anchor_error?: boolean;
}

export function approve(
  token: string,
  a: Asked & { sha256: string; size: number; consentText: string; signature: string; fileB64: string },
): Promise<ConsentResponse> {
  return postJson<ConsentResponse>("/consent", {
    pending: a.pending, mac: a.mac, decision: "APPROVE", sha256: a.sha256, size: a.size,
    consent_text: a.consentText, signature: a.signature, file_b64: a.fileB64,
  }, token);
}

/** A decline carries the request and its mac and nothing else: not the file's hash, size, or bytes. */
export function decline(token: string, a: Asked): Promise<ConsentResponse> {
  return postJson<ConsentResponse>("/consent", { pending: a.pending, mac: a.mac, decision: "DECLINE" }, token);
}

export interface AnchorResponse {
  digest: string; org: string; pda: string; tx: string; slot: number | null; block_time: number | null;
  solscan: string; solscan_account: string;
}

/** Retry anchoring a receipt hash the relay already signed. */
export function anchorDigest(token: string, digest: string): Promise<AnchorResponse> {
  return postJson<AnchorResponse>("/anchor", { digest }, token);
}
