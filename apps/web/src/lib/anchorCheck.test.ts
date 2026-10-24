import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import { fromHex } from "@consent-receipts/receipt";
import { judgeAnchorAccount } from "./anchorCheck.js";

// The first anchored account under the org-scoped seeds, as dumped from devnet and published in
// docs/RECEIPT-FORMAT.md ("What is on chain"): 89 bytes. This pins the offsets and the seeds to a real account.
const DUMP = [
  "15 73 bb 26 52 4c 58 ab ba 78 16 bf 8f 01 cf ea",
  "41 41 40 de 5d ae 22 23 b0 03 61 a3 96 17 7a 9c",
  "b4 10 ff 61 f2 00 15 ad 1f 62 3c d1 79 08 68 f5",
  "06 22 6f ed 4b a4 36 cc fe 53 4a 87 f2 6f be 02",
  "74 2f eb ef 97 8b a8 75 54 84 22 1e 00 00 00 00",
  "e2 da bb 6a 00 00 00 00 fc",
].join(" ").split(" ").map((h) => parseInt(h, 16));
const DATA = Uint8Array.from(DUMP);
const PROGRAM = "72NKbS2kpoxzwAyznfzmq6GuKqS1yQtdnBLzWxhfbbCh";
const ORG = "37WXBkSPhJx9B4bkzpjEbmyTQkLQK3F1Ytw3AEZmmr6G";
const PDA = "FfdETrPzRFvoUe7xz9wAJWViTr4LFwLSU3oYjajiEy1n";
const HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";   // sha256("abc")

const receipt = (over: { receipt_hash?: string; org?: string; pda?: string } = {}) => ({
  receipt_hash: over.receipt_hash ?? HASH, org: { pubkey: over.org ?? ORG }, anchor: { pda: over.pda ?? PDA },
});
const account = (data: Uint8Array = DATA, owner = PROGRAM) => ({ owner, data });
const flip = (data: Uint8Array, at: number) => { const d = Uint8Array.from(data); d[at] ^= 1; return d; };

describe("judgeAnchorAccount", () => {
  it("the dump is 89 bytes and its bytes 8..40 are the digest (guards the transcription above)", () => {
    expect(DATA.length).toBe(89);
    expect(Array.from(DATA.subarray(8, 40))).toEqual(Array.from(fromHex(HASH)));
  });

  it("passes the real devnet account: address, owner, bytes 8..40, bytes 40..72", () => {
    const c = judgeAnchorAccount(receipt(), PROGRAM, account());
    expect(c).toMatchObject({ ok: true });
  });

  it("fails when the receipt hash is not the one in the account bytes", () => {
    // address still right for the claimed hash would be impossible, so alter the account instead
    expect(judgeAnchorAccount(receipt(), PROGRAM, account(flip(DATA, 8)))).toMatchObject({ ok: false, detail: expect.stringContaining("8..40") });
    expect(judgeAnchorAccount(receipt(), PROGRAM, account(flip(DATA, 39)))).toMatchObject({ ok: false, detail: expect.stringContaining("8..40") });
  });

  it("fails when the operator key in the account is not the receipt's", () => {
    expect(judgeAnchorAccount(receipt(), PROGRAM, account(flip(DATA, 40)))).toMatchObject({ ok: false, detail: expect.stringContaining("40..72") });
    expect(judgeAnchorAccount(receipt(), PROGRAM, account(flip(DATA, 71)))).toMatchObject({ ok: false, detail: expect.stringContaining("40..72") });
  });

  it("fails when the receipt points at an account that is not the PDA of its hash and operator", () => {
    const other = Keypair.generate().publicKey.toBase58();
    expect(judgeAnchorAccount(receipt({ pda: other }), PROGRAM, account())).toMatchObject({ ok: false, detail: expect.stringContaining(PDA) });
    expect(judgeAnchorAccount(receipt({ receipt_hash: "00".repeat(32) }), PROGRAM, account())).toMatchObject({ ok: false });
    expect(judgeAnchorAccount(receipt({ org: Keypair.generate().publicKey.toBase58() }), PROGRAM, account())).toMatchObject({ ok: false });
  });

  it("fails when there is no account, when another program owns it, and when it is too short", () => {
    expect(judgeAnchorAccount(receipt(), PROGRAM, null)).toMatchObject({ ok: false, detail: expect.stringContaining("no account") });
    expect(judgeAnchorAccount(receipt(), PROGRAM, account(DATA, Keypair.generate().publicKey.toBase58()))).toMatchObject({ ok: false, detail: expect.stringContaining("owned by") });
    expect(judgeAnchorAccount(receipt(), PROGRAM, account(DATA.subarray(0, 71)))).toMatchObject({ ok: false, detail: expect.stringContaining("71 bytes") });
  });

  it("fails, without throwing, on a receipt with malformed keys or hash", () => {
    expect(judgeAnchorAccount(receipt({ org: "not a key" }), PROGRAM, account())).toMatchObject({ ok: false });
    expect(judgeAnchorAccount(receipt({ receipt_hash: "zz" }), PROGRAM, account())).toMatchObject({ ok: false });
  });
});
