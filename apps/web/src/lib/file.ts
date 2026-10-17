import { sha256Hex } from "@consent-receipts/receipt";
import labReport from "../fixtures/lab-report.md?raw";

/** The bundled synthetic file, with the hash and size the sheet will show and the relay will re-check. */
export interface FixtureFile {
  bytes: Uint8Array;
  sha256: string;
  size: number;
}

export async function loadFixture(): Promise<FixtureFile> {
  const bytes = new TextEncoder().encode(labReport);
  return { bytes, sha256: await sha256Hex(bytes), size: bytes.length };
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
