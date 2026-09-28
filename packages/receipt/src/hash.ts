const subtle = globalThis.crypto.subtle;

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = new Uint8Array(bytes).buffer as ArrayBuffer;
  return new Uint8Array(await subtle.digest("SHA-256", buf));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  if (!/^[0-9a-f]*$/.test(hex) || hex.length % 2) throw new Error("fromHex: bad hex");
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(await sha256(bytes));
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
