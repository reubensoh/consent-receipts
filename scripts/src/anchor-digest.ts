/**
 * Anchor any 32-byte digest on devnet. The org key signs and pays. Nothing else goes on chain.
 * Usage: npm run anchor-digest -w scripts -- <64 hex>
 */
import { Connection } from "@solana/web3.js";
import { RPC, loadOrgKeypair, parseDigest, receiptPda, signingProgram, solscanTx, solscanAccount } from "./chain.js";

const hex = process.argv[2];
if (!hex) { console.error("usage: anchor-digest <64 hex>"); process.exit(2); }
const digest = parseDigest(hex);
const connection = new Connection(RPC, "confirmed");
const org = loadOrgKeypair();
const program = signingProgram(connection, org);
const pda = receiptPda(digest);

try {
  const sig = await program.methods
    .anchorReceipt(Array.from(digest))
    .accounts({ org: org.publicKey })
    .rpc();
  const tx = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  console.log(JSON.stringify({
    digest: hex, org: org.publicKey.toBase58(), pda: pda.toBase58(), tx: sig,
    slot: tx?.slot ?? null, block_time: tx?.blockTime ?? null,
    solscan: solscanTx(sig), solscan_account: solscanAccount(pda),
  }, null, 2));
} catch (e) {
  const msg = String((e as Error).message ?? e);
  if (/already in use|custom program error: 0x0\b/.test(msg)) {
    console.error(`ALREADY ANCHORED: PDA ${pda.toBase58()} exists for this digest.`);
    process.exit(3);
  }
  throw e;
}
