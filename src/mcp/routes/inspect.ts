/**
 * MCP route handler for POST /inspect.
 */
import { Hono } from "hono";
import { InspectRequestSchema } from "../schemas.js";
import { decodeToken } from "../../core/decode.js";
import { verifyToken } from "../../core/verify.js";
import { lintToken } from "../../core/linter.js";
import { redactClaims } from "../middleware/redact.js";
import type { SupportedAlgorithm, InspectResult } from "../../core/types.js";
import type { Config } from "../../config/schema.js";

const STANDARD_CLAIMS = new Set(["iss", "sub", "aud", "exp", "iat", "nbf", "jti"]);

export function createInspectRoute(config: Config) {
  const route = new Hono();
  const claimsToRedact = config.mcp?.redactClaims ?? [];
  const lintConfig = config.lint ?? {};

  route.post("/inspect", async (c) => {
    const body = await c.req.json();
    const parsed = InspectRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ errors: parsed.error.issues }, 422);
    }

    const data = parsed.data;
    const now = data.fakeTime ? new Date(data.fakeTime) : new Date();
    const nowMs = now.getTime();

    const decodeResult = decodeToken(data.token);
    if (!decodeResult.ok) {
      return c.json({ error: decodeResult.error.message }, 400);
    }

    const decoded = decodeResult.value;
    const { header, payload } = decoded;

    // Optionally verify
    const hasKey = data.secret !== undefined || data.publicKeyPem !== undefined ||
      data.publicKeyJwk !== undefined || data.jwksUri !== undefined;

    let verificationResult: InspectResult["verificationResult"];
    if (hasKey) {
      const vr = await verifyToken({
        token: data.token,
        secret: data.secret,
        publicKeyPem: data.publicKeyPem,
        publicKeyJwk: data.publicKeyJwk,
        jwksUri: data.jwksUri,
        alg: data.alg as SupportedAlgorithm | undefined,
        now,
      });
      verificationResult = vr.ok ? { ok: true, value: true as const } : vr;
    }

    // Determine status
    const nowSec = nowMs / 1000;
    const exp = payload["exp"];
    const nbf = payload["nbf"];
    let status: InspectResult["status"] = "unverified";
    if (typeof exp === "number" && exp < nowSec) status = "expired";
    else if (typeof nbf === "number" && nbf > nowSec) status = "not_yet_valid";
    if (verificationResult?.ok === true && status === "unverified") status = "valid";

    // Extract metadata
    const algorithm = typeof header["alg"] === "string" ? header["alg"] : "unknown";
    const kid = typeof header["kid"] === "string" ? header["kid"] : undefined;
    const customClaims: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!STANDARD_CLAIMS.has(key)) customClaims[key] = value;
    }

    const lintFindings = lintToken(decoded, lintConfig);

    const result: Record<string, unknown> = {
      status,
      algorithm,
      ...(kid !== undefined ? { kid } : {}),
      ...(payload["iss"] !== undefined ? { issuer: payload["iss"] } : {}),
      ...(payload["sub"] !== undefined ? { subject: payload["sub"] } : {}),
      ...(payload["aud"] !== undefined ? { audience: payload["aud"] } : {}),
      ...(typeof payload["iat"] === "number"
        ? { issuedAt: new Date(payload["iat"] * 1000).toISOString() } : {}),
      ...(typeof exp === "number"
        ? { expiresAt: new Date(exp * 1000).toISOString(), timeUntilExpiry: exp - nowSec } : {}),
      ...(typeof nbf === "number"
        ? { notBefore: new Date(nbf * 1000).toISOString() } : {}),
      customClaims: redactClaims(customClaims, claimsToRedact),
      lintFindings,
      ...(verificationResult !== undefined
        ? { verificationResult: verificationResult.ok ? { ok: true } : { ok: false, error: verificationResult.error } }
        : {}),
    };

    return c.json(result);
  });

  return route;
}
