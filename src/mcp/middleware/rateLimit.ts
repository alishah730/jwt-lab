/**
 * MCP sliding window rate limiter middleware.
 * Limits requests per client IP within a configurable time window.
 */
import type { Context, Next } from "hono";

interface RateLimitOptions {
  /** Time window in seconds (default: 60). */
  windowSeconds: number;
  /** Maximum requests per window (default: 100). */
  maxRequests: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowSeconds: 60,
  maxRequests: 100,
};

/**
 * Creates a Hono middleware that applies sliding window rate limiting.
 */
export function rateLimitMiddleware(opts?: Partial<RateLimitOptions>) {
  const { windowSeconds, maxRequests } = { ...DEFAULT_OPTIONS, ...opts };
  const store = new Map<string, number[]>();

  // Periodically clean up expired entries (every 60s)
  setInterval(() => {
    const cutoff = Date.now() - windowSeconds * 1000;
    for (const [key, timestamps] of store.entries()) {
      const filtered = timestamps.filter((t) => t > cutoff);
      if (filtered.length === 0) {
        store.delete(key);
      } else {
        store.set(key, filtered);
      }
    }
  }, 60_000).unref();

  return async (c: Context, next: Next) => {
    const clientIp =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";

    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;

    const timestamps = store.get(clientIp) ?? [];
    const recent = timestamps.filter((t) => t > cutoff);

    if (recent.length >= maxRequests) {
      return c.json({ error: "Too Many Requests" }, 429);
    }

    recent.push(now);
    store.set(clientIp, recent);

    return next();
  };
}
