/**
 * MCP route handler for POST /encode.
 */
import { Hono } from "hono";
import { EncodeRequestSchema } from "../schemas.js";
import { encodeToken } from "../../core/encode.js";
import { parseDuration } from "../../core/duration.js";
import type { SupportedAlgorithm } from "../../core/types.js";

const route = new Hono();

route.post("/encode", async (c) => {
  const body = await c.req.json();
  const parsed = EncodeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ errors: parsed.error.issues }, 422);
  }

  const data = parsed.data;
  const now = data.fakeTime ? new Date(data.fakeTime) : new Date();
  const payload: Record<string, unknown> = { ...data.payload };

  // Apply standard claims from request
  if (data.iss !== undefined) payload["iss"] = data.iss;
  if (data.sub !== undefined) payload["sub"] = data.sub;
  if (data.aud !== undefined) payload["aud"] = data.aud;
  if (data.jti === true) payload["jti"] = true;

  // Parse exp duration
  if (data.exp !== undefined) {
    const expResult = parseDuration(data.exp);
    if (!expResult.ok) {
      return c.json({ error: expResult.error.message }, 400);
    }
    payload["exp"] = Math.floor(now.getTime() / 1000) + expResult.value;
  }

  const result = await encodeToken({
    payload,
    secret: data.secret,
    privateKeyPem: data.privateKeyPem,
    privateKeyJwk: data.privateKeyJwk,
    alg: data.alg as SupportedAlgorithm,
    kid: data.kid,
    header: data.header,
    now,
  });

  if (!result.ok) {
    return c.json({ error: result.error.message }, 400);
  }

  return c.json({ token: result.value });
});

export { route as encodeRoute };
