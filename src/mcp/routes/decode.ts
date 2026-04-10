/**
 * MCP route handler for POST /decode.
 */
import { Hono } from "hono";
import { DecodeRequestSchema } from "../schemas.js";
import { decodeToken } from "../../core/decode.js";
import { redactClaims } from "../middleware/redact.js";
import type { Config } from "../../config/schema.js";

export function createDecodeRoute(config: Config) {
  const route = new Hono();
  const claimsToRedact = config.mcp?.redactClaims ?? [];

  route.post("/decode", async (c) => {
    const body = await c.req.json();
    const parsed = DecodeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ errors: parsed.error.issues }, 422);
    }

    const result = decodeToken(parsed.data.token);

    if (!result.ok) {
      return c.json({ error: result.error.message }, 400);
    }

    return c.json({
      header: result.value.header,
      payload: redactClaims(result.value.payload, claimsToRedact),
      signaturePresent: result.value.signaturePresent,
    });
  });

  return route;
}
