/**
 * MCP route handler for POST /verify.
 */
import { Hono } from "hono";
import { VerifyRequestSchema } from "../schemas.js";
import { verifyToken } from "../../core/verify.js";
import { redactClaims } from "../middleware/redact.js";
import type { SupportedAlgorithm } from "../../core/types.js";
import type { Config } from "../../config/schema.js";

export function createVerifyRoute(config: Config) {
  const route = new Hono();
  const claimsToRedact = config.mcp?.redactClaims ?? [];

  route.post("/verify", async (c) => {
    const body = await c.req.json();
    const parsed = VerifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ errors: parsed.error.issues }, 422);
    }

    const data = parsed.data;
    const now = data.fakeTime ? new Date(data.fakeTime) : undefined;

    const result = await verifyToken({
      token: data.token,
      secret: data.secret,
      publicKeyPem: data.publicKeyPem,
      publicKeyJwk: data.publicKeyJwk,
      jwksUri: data.jwksUri,
      alg: data.alg as SupportedAlgorithm | undefined,
      requiredClaims: data.requiredClaims,
      leewaySeconds: data.leewaySeconds,
      now,
    });

    if (!result.ok) {
      return c.json({
        valid: false,
        reason: result.error.reason,
        message: result.error.message,
      }, 400);
    }

    return c.json({
      valid: true,
      header: result.value.header,
      payload: redactClaims(result.value.payload, claimsToRedact),
    });
  });

  return route;
}
