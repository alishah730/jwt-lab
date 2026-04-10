/**
 * MCP route handler for POST /keygen.
 */
import { Hono } from "hono";
import { KeygenRequestSchema } from "../schemas.js";
import { generateKeyPair } from "../../core/keygen.js";

const route = new Hono();

route.post("/keygen", async (c) => {
  const body = await c.req.json();
  const parsed = KeygenRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ errors: parsed.error.issues }, 422);
  }

  const data = parsed.data;
  const result = await generateKeyPair({
    type: data.type,
    format: data.format,
    kid: data.kid,
    rsaBits: data.rsaBits,
    ecCurve: data.ecCurve,
  });

  if (!result.ok) {
    return c.json({ error: result.error.message }, 400);
  }

  return c.json({
    privateKey: result.value.privateKey,
    publicKey: result.value.publicKey,
    ...(result.value.kid !== undefined ? { kid: result.value.kid } : {}),
  });
});

export { route as keygenRoute };
