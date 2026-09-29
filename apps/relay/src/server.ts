import { serve } from "@hono/node-server";
import { Connection } from "@solana/web3.js";
import { RPC, loadOrgKeypair } from "@consent-receipts/anchor-client";
import { createApp, makeDeps } from "./app.js";

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) { console.error("SESSION_SECRET (>=32 chars) is required"); process.exit(1); }
const domain = process.env.RELAY_DOMAIN ?? "localhost";
const perMinute = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 10);
const port = Number(process.env.PORT ?? 8787);

const deps = makeDeps(secret, domain, perMinute, new Connection(RPC, "confirmed"), loadOrgKeypair());
serve({ fetch: createApp(deps).fetch, port }, () => {
  // Startup is the only log line. Requests are never logged: no IPs, no wallets, no digests.
  console.log(`relay listening on :${port} (rpc ${RPC})`);
});
