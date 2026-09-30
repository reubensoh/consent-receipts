import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Connection, Keypair } from "@solana/web3.js";
import { anchorDigest, AlreadyAnchoredError, type AnchorResult } from "@consent-receipts/anchor-client";
import { createChallenge, verifySignIn, issueToken, verifyToken } from "./session.js";
import { RateLimiter } from "./ratelimit.js";

export interface Deps {
  secret: string;
  domain: string;
  perMinute: number;
  /** Injected so tests never touch devnet. */
  anchor: (hex: string) => Promise<AnchorResult>;
}

export function makeDeps(secret: string, domain: string, perMinute: number, connection: Connection, org: Keypair): Deps {
  return { secret, domain, perMinute, anchor: (hex) => anchorDigest(connection, org, hex) };
}

export function createApp(d: Deps) {
  const app = new Hono<{ Variables: { pubkey: string } }>();
  const limiter = new RateLimiter(d.perMinute);

  // apps/web (Vite dev server) is a different origin; nothing else is allowed (brief 002).
  app.use("*", cors({ origin: "http://localhost:5173", allowMethods: ["GET", "POST"] }));

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
