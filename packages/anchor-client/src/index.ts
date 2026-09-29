import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { fromHex } from "@consent-receipts/receipt";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
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

/** The operator's published organisation key (README, "Public identifiers"). */
export const DEFAULT_ORG_PUBKEY = new PublicKey("37WXBkSPhJx9B4bkzpjEbmyTQkLQK3F1Ytw3AEZmmr6G");

/** PDA seeds are ["receipt", org, digest]: one slot per organisation per digest. */
export function receiptPda(org: PublicKey, digest: Uint8Array): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), org.toBuffer(), Buffer.from(digest)], PROGRAM_ID)[0];
}

export interface OnChainAnchor { pda: string; org: string; slot: number; unix_time: number; receipt_hash: string }

/** Read the anchor for (org, digest). Returns null if that organisation never anchored it. */
export async function fetchAnchor(connection: Connection, org: PublicKey, hex: string): Promise<OnChainAnchor | null> {
  const digest = parseDigest(hex);
  const pda = receiptPda(org, digest);
  const program = readonlyProgram(connection);
  try {
    const a = await (program.account as any).receiptAnchor.fetch(pda) as
      { receiptHash: number[]; org: PublicKey; slot: { toString(): string }; unixTime: { toString(): string } };
    return { pda: pda.toBase58(), org: a.org.toBase58(), slot: Number(a.slot.toString()),
      unix_time: Number(a.unixTime.toString()), receipt_hash: Buffer.from(a.receiptHash).toString("hex") };
  } catch { return null; }
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

export interface AnchorResult {
  digest: string; org: string; pda: string; tx: string; slot: number | null; block_time: number | null;
  solscan: string; solscan_account: string;
}

export class AlreadyAnchoredError extends Error {
  constructor(public pda: string) { super(`already anchored at ${pda}`); }
}

/** Anchor a 32-byte digest with the org key paying. Throws AlreadyAnchoredError on a repeat. */
export async function anchorDigest(connection: Connection, org: Keypair, hex: string): Promise<AnchorResult> {
  const digest = parseDigest(hex);
  const pda = receiptPda(org.publicKey, digest);
  const program = signingProgram(connection, org);
  try {
    const sig = await program.methods.anchorReceipt(Array.from(digest)).accounts({ org: org.publicKey }).rpc();
    const tx = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    return {
      digest: hex.toLowerCase(), org: org.publicKey.toBase58(), pda: pda.toBase58(), tx: sig,
      slot: tx?.slot ?? null, block_time: tx?.blockTime ?? null,
      solscan: solscanTx(sig), solscan_account: solscanAccount(pda),
    };
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (/already in use|custom program error: 0x0\b/.test(msg)) throw new AlreadyAnchoredError(pda.toBase58());
    throw e;
  }
}
