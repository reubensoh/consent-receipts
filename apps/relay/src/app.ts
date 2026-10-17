import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import nacl from "tweetnacl";
import type { Connection, Keypair } from "@solana/web3.js";
import { assertSafeField } from "@consent-receipts/receipt";
import { anchorDigest, AlreadyAnchoredError } from "@consent-receipts/anchor-client";
import { createChallenge, verifySignIn, issueToken, verifyToken } from "./session.js";
import { RateLimiter } from "./ratelimit.js";
import {
  ConsentError, ERR, handleConsent, issuePending, pendingMac, DEFAULT_MODEL, MAX_FILE_BYTES,
  type AnchorFn, type OrgSigner,
} from "./consent.js";

export interface Deps {
  secret: string;
  domain: string;
  perMinute: number;
  /** The mocked model's id, shown on the sheet and inside the signed text. */
  model: string;
  /** Injected so tests never touch a key file. */
  org: OrgSigner;
  /** Injected so tests never touch devnet. */
  anchor: AnchorFn;
  /** Injected so tests can move the clock; defaults to the wall clock. */
  now?: () => Date;
}

export function makeDeps(secret: string, domain: string, perMinute: number, connection: Connection, org: Keypair, model = DEFAULT_MODEL): Deps {
  return {
    secret, domain, perMinute, model,
    org: { pubkey: org.publicKey.toBase58(), sign: (m) => nacl.sign.detached(m, org.secretKey) },
    anchor: (hex) => anchorDigest(connection, org, hex),
  };
}

export function createApp(d: Deps) {
  assertSafeField("model", d.model, 80);      // it lands inside the signed text; fail at startup, not per request
  const app = new Hono<{ Variables: { pubkey: string } }>();
  const limiter = new RateLimiter(d.perMinute);
  const now = d.now ?? (() => new Date());

  // apps/web (Vite dev server) is a different origin; nothing else is allowed (brief 002).
  app.use("*", cors({ origin: "http://localhost:5173", allowMethods: ["GET", "POST"] }));

  // The default handler prints the error to the console. The relay logs nothing per request.
  app.onError((_e, c) => c.json({ error: "internal error" }, 500));

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/session/challenge", async (c) => {
    const { pubkey } = await c.req.json<{ pubkey?: string }>().catch(() => ({} as { pubkey?: string }));
    if (!pubkey) return c.json({ error: "pubkey required" }, 400);
    try { return c.json({ message: createChallenge(d.secret, d.domain, pubkey).message }); }
    catch { return c.json({ error: "bad pubkey" }, 400); }
  });

  app.post("/session/verify", async (c) => {
    const body = await c.req.json<{ pubkey: string; message: string; signature: string }>().catch(() => null);
    if (!body) return c.json({ error: "bad body" }, 400);
    try {
      const pubkey = verifySignIn(d.secret, d.domain, body);
      return c.json({ token: issueToken(d.secret, pubkey) });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 401);   // messages never include inputs
    }
  });

  const requireSession = async (c: any, next: () => Promise<void>) => {
    const auth = c.req.header("authorization") ?? "";
    const pubkey = verifyToken(d.secret, auth.startsWith("Bearer ") ? auth.slice(7) : undefined);
    if (!pubkey) return c.json({ error: "sign in first" }, 401);
    if (!limiter.take(pubkey)) return c.json({ error: "rate limit: try again in a minute" }, 429);
    c.set("pubkey", pubkey);
    await next();
  };

  /** The mocked model "asks" for one file. Returns the pending request and a MAC binding it to this wallet. */
  app.post("/request/mock", requireSession, (c) => {
    const pending = issuePending(d.model, now());
    return c.json({ pending, mac: pendingMac(d.secret, pending, c.get("pubkey")) });
  });

  /** Approve or decline a pending request: verify, co-sign, anchor, return the final receipt. */
  const consentBodyLimit = bodyLimit({
    maxSize: 2 * MAX_FILE_BYTES,       // 1 MiB of file is about 1.4 MiB of base64
    onError: (c) => c.json({ error: ERR.tooLarge }, 413),
  });
  app.post("/consent", requireSession, consentBodyLimit, async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      return c.json(await handleConsent({ secret: d.secret, org: d.org, anchor: d.anchor, now }, c.get("pubkey"), body));
    } catch (e) {
      if (e instanceof ConsentError) return c.json({ error: e.message }, e.status);
      throw e;
    }
  });

  /** Anchor any 32-byte digest for a signed-in wallet. Org key pays. */
  app.post("/anchor", requireSession, async (c) => {
    const { digest } = await c.req.json<{ digest?: string }>().catch(() => ({} as { digest?: string }));
    if (!digest || !/^[0-9a-fA-F]{64}$/.test(digest)) return c.json({ error: "digest must be 64 hex chars" }, 400);
    try {
      return c.json(await d.anchor(digest));
    } catch (e) {
      if (e instanceof AlreadyAnchoredError) return c.json({ error: "already anchored", pda: e.pda }, 409);
      return c.json({ error: "anchor failed" }, 502);       // no chain error text leaks to the client
    }
  });

  return app;
}
