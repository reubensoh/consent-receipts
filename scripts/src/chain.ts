import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { fromHex } from "@consent-receipts/receipt";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../..");
export const IDL = JSON.parse(
  fs.readFileSync(path.join(ROOT, "programs/consent_anchor/idl/consent_anchor.json"), "utf8"),
) as anchor.Idl;
export const PROGRAM_ID = new PublicKey((IDL as { address: string }).address);
export const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export function loadOrgKeypair(): Keypair {
  const p = process.env.ORG_KEYPAIR_PATH ?? path.join(ROOT, "apps/relay/.keys/org.json");
  const secret = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export function parseDigest(hex: string): Uint8Array {
  const d = fromHex(hex.toLowerCase());
  if (d.length !== 32) throw new Error("digest must be 32 bytes (64 hex chars)");
  return d;
}

export function receiptPda(digest: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("receipt"), Buffer.from(digest)], PROGRAM_ID)[0];
}

/** Read-only program handle (no signer). */
export function readonlyProgram(connection: Connection) {
  const provider = new anchor.AnchorProvider(connection, {} as anchor.Wallet, {});
  return new anchor.Program(IDL, provider);
}

export function signingProgram(connection: Connection, kp: Keypair) {
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(kp), { commitment: "confirmed" });
  return new anchor.Program(IDL, provider);
}

export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}?cluster=devnet`;
export const solscanAccount = (k: PublicKey) => `https://solscan.io/account/${k.toBase58()}?cluster=devnet`;
