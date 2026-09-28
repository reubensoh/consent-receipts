/**
 * Canonical JSON, RFC 8785 (JCS) subset sufficient for receipts.
 * Rules: object keys sorted by UTF-16 code units, no whitespace, strings escaped per JSON,
 * numbers must be safe integers (receipts carry no floats), null/booleans as-is.
 * Both the browser and the relay must produce identical bytes; the golden test pins them.
 */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function canonicalize(value: Json): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("canonicalize: only safe integers allowed");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
  }
  throw new Error("canonicalize: unsupported value " + typeof value);
}
