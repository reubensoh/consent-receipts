/** Per-wallet token bucket, in memory, reset on restart. Keyed by session pubkey only. */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; updated: number }>();
  constructor(private perMinute: number) {}
  /** true if allowed */
  take(key: string, now = Date.now()): boolean {
    const b = this.buckets.get(key) ?? { tokens: this.perMinute, updated: now };
    b.tokens = Math.min(this.perMinute, b.tokens + ((now - b.updated) / 60_000) * this.perMinute);
    b.updated = now;
    if (b.tokens < 1) { this.buckets.set(key, b); return false; }
    b.tokens -= 1;
    this.buckets.set(key, b);
    return true;
  }
}
