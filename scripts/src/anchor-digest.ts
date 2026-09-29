/**
 * Anchor any 32-byte digest on devnet. The org key signs and pays. Nothing else goes on chain.
 * Usage: npm run anchor-digest -w scripts -- <64 hex>
 */
import { Connection } from "@solana/web3.js";
import { RPC, loadOrgKeypair, anchorDigest, AlreadyAnchoredError } from "@consent-receipts/anchor-client";

const hex = process.argv[2];
if (!hex) { console.error("usage: anchor-digest <64 hex>"); process.exit(2); }
try {
  const r = await anchorDigest(new Connection(RPC, "confirmed"), loadOrgKeypair(), hex);
  console.log(JSON.stringify(r, null, 2));
} catch (e) {
  if (e instanceof AlreadyAnchoredError) { console.error(`ALREADY ANCHORED: PDA ${e.pda} exists for this digest.`); process.exit(3); }
  throw e;
}
