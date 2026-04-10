/**
 * MCP route handler for POST /explain.
 */
import { Hono } from "hono";
import { ExplainRequestSchema } from "../schemas.js";
import { decodeToken } from "../../core/decode.js";
import { lintToken } from "../../core/linter.js";
import type { Config } from "../../config/schema.js";

export function createExplainRoute(config: Config) {
  const route = new Hono();
  const lintConfig = config.lint ?? {};

  route.post("/explain", async (c) => {
    const body = await c.req.json();
    const parsed = ExplainRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ errors: parsed.error.issues }, 422);
    }

    const decodeResult = decodeToken(parsed.data.token);
    if (!decodeResult.ok) {
      return c.json({ error: decodeResult.error.message }, 400);
    }

    const findings = lintToken(decodeResult.value, lintConfig);

    return c.json({ findings });
  });

  return route;
}
