import type { ConsentRequest } from "@consent-receipts/receipt";

/**
 * Published operator signing key (README.md, "Public identifiers"). No org co-signature or
 * anchor happens in step 1 — this key only appears inside the consent text the user signs.
 */
export const ORG_PUBKEY = "37WXBkSPhJx9B4bkzpjEbmyTQkLQK3F1Ytw3AEZmmr6G";

/** Terms lines, verbatim from docs/RECEIPT-FORMAT.md — not to be edited here. */
const TERMS = [
  "used only to answer this conversation",
  "sent once to the provider named above, not kept on our side",
  "we do not permit training on it; the provider's policy of <YYYY-MM-DD>: <url>",
  "the provider has its own retention window; see that policy",
];

const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** A hardcoded request, timestamped fresh on every call (step 1: no vault, no model). */
export function makeConsentRequest(): ConsentRequest {
  const issued = new Date();
  const expires = new Date(issued.getTime() + 5 * 60 * 1000);
  return {
    id: crypto.randomUUID(),
    item: "Documents/lab-report.md",
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    size: 1847,
    purpose: "compare values to reference ranges",
    provider: "OpenAI",
    model: "gpt-mini-placeholder",
    terms: TERMS,
    issuedAt: isoSeconds(issued),
    expiresAt: isoSeconds(expires),
  };
}
