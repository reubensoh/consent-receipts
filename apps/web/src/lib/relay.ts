/**
 * Relay client. Every call is a fetch with the pubkey in the body only, never a URL — the
 * relay's own routes never accept it any other way (docs/ARCHITECTURE.md, "Sign-in").
 */
const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? "http://localhost:8787";

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${RELAY_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
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
