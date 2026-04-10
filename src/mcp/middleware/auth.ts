/**
 * MCP API key authentication middleware.
 * Checks Authorization: Bearer <key> against MCP_API_KEY env var.
 * Skipped when MCP_API_KEY is not set.
 */
import type { Context, Next } from "hono";

/**
 * Creates a Hono middleware that enforces API key authentication.
 * If `apiKey` is undefined, the middleware is a passthrough.
 */
export function authMiddleware(apiKey: string | undefined) {
  return async (c: Context, next: Next) => {
    if (apiKey === undefined) {
      return next();
    }

    const authHeader = c.req.header("authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || parts[1] !== apiKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return next();
  };
}
