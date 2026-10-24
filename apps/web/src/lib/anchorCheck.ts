/**
 * The browser's own look at the anchor: read the account from devnet and compare its bytes with
 * the receipt. Layout (docs/RECEIPT-FORMAT.md, "What is on chain"): 8 discriminator, 32 receipt
 * hash, 32 operator key, 8 slot, 8 unix time, 1 bump. Not imported from @consent-receipts/anchor-client,
 * which is Node-only; the three facts it needs are the layout, the seeds, and the program id.
 */
import { PublicKey, type Connection } from "@solana/web3.js";
import { fromHex, type Check, type Receipt } from "@consent-receipts/receipt";
import { PROGRAM_ID } from "./config.js";

export const ANCHOR_CHECK_NAME = "anchor account on devnet holds receipt_hash and the operator key";

type Anchored = Pick<Receipt, "receipt_hash"> & { org: { pubkey: string }; anchor: { pda: string } };

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const fail = (detail: string): Check => ({ name: ANCHOR_CHECK_NAME, ok: false, detail });

/**
 * Pure: judges what getAccountInfo returned against what the receipt claims. It checks that the
 * address is the PDA of ["receipt", operator, hash] under the program, that the program owns the
 * account, and that bytes 8..40 and 40..72 are the receipt hash and the operator key.
 */
export function judgeAnchorAccount(
  receipt: Anchored, programId: string, account: { owner: string; data: Uint8Array } | null,
): Check {
  try {
    const hash = fromHex(receipt.receipt_hash);
    const org = new PublicKey(receipt.org.pubkey);
    const program = new PublicKey(programId);
    const [pda] = PublicKey.findProgramAddressSync([new TextEncoder().encode("receipt"), org.toBytes(), hash], program);
    if (pda.toBase58() !== receipt.anchor.pda) return fail(`receipt names account ${receipt.anchor.pda}, but the anchor for this hash and operator lives at ${pda.toBase58()}`);
    if (!account) return fail(`no account at ${receipt.anchor.pda}`);
    if (account.owner !== programId) return fail(`account is owned by ${account.owner}, not the consent_anchor program`);
    if (account.data.length < 72) return fail(`account holds ${account.data.length} bytes, expected at least 72`);
    if (!same(account.data.subarray(8, 40), hash)) return fail("account bytes 8..40 are not the receipt hash");
    if (!same(account.data.subarray(40, 72), org.toBytes())) return fail("account bytes 40..72 are not the operator key");
    return { name: ANCHOR_CHECK_NAME, ok: true, detail: `account ${receipt.anchor.pda}: bytes 8..40 = receipt_hash, bytes 40..72 = operator key` };
  } catch (e) {
    return fail(`could not judge the account: ${(e as Error).message}`);
  }
}

/** Reads the anchor account at "confirmed" (a just-anchored account is not finalized yet) and judges it. */
export async function checkAnchorOnChain(connection: Connection, receipt: Anchored): Promise<Check> {
  try {
    const info = await connection.getAccountInfo(new PublicKey(receipt.anchor.pda), "confirmed");
    return judgeAnchorAccount(receipt, PROGRAM_ID, info && { owner: info.owner.toBase58(), data: info.data });
  } catch (e) {
    return fail(`could not read devnet: ${(e as Error).message}`);
  }
}
