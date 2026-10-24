/**
 * The operator's published signing key (README.md, "Public identifiers"). The consent text the
 * wallet signs names it, and the relay refuses text that names a different one, so a relay running
 * another key fails loudly instead of having users sign for an operator they did not expect.
 * VITE_ORG_PUBKEY overrides it for a local run against a throwaway key; the relay must sign with
 * the same key.
 */
export const ORG_PUBKEY: string = import.meta.env.VITE_ORG_PUBKEY || "37WXBkSPhJx9B4bkzpjEbmyTQkLQK3F1Ytw3AEZmmr6G";

/** The consent_anchor program (README.md, "Public identifiers"). Used to re-derive the anchor account. */
export const PROGRAM_ID = "72NKbS2kpoxzwAyznfzmq6GuKqS1yQtdnBLzWxhfbbCh";
