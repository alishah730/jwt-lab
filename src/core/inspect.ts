/**
 * High-level token inspection — decode, verify (optionally via OIDC/JWKS),
 * and lint in a single call. Mirrors the CLI `jwt inspect` and `jwt verify`
 * commands as a composable library function.
 */

import { decodeToken } from "./decode.js";
import { verifyToken, type VerifyOptions } from "./verify.js";
import { lintToken } from "./linter.js";
import { resolveOidcJwksUri } from "./jwks.js";
import {
  type Result,
  type InspectResult,
  type InspectError,
  type LintConfig,
  type LintFinding,
  type SupportedAlgorithm,
  ok,
  err,
} from "./types.js";

/** Standard registered claim names excluded from customClaims. */
const STANDARD_CLAIMS = new Set([
  "iss", "sub", "aud", "exp", "iat", "nbf", "jti",
]);

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for the high-level `inspectToken` function. */
export interface InspectTokenOptions {
  /** The JWT string to inspect. */
  token: string;

  // --- Verification key material (all optional — omit to skip verification) ---

  /** HMAC secret for signature verification. */
  secret?: string;
  /** PEM-encoded public key for signature verification. */
  publicKeyPem?: string;
  /** JWK public key object for signature verification. */
  publicKeyJwk?: Record<string, unknown>;
  /** Remote JWKS endpoint URL for signature verification. */
  jwksUri?: string;
  /** OpenID Connect discovery URL — auto-resolves to a JWKS URI. */
  oidcDiscoveryUrl?: string;

  // --- Verification constraints ---

  /** Expected algorithm — rejects tokens with a different `alg`. */
  alg?: SupportedAlgorithm;
  /** Claims that must be present in the payload. */
  requiredClaims?: string[];
  /** Clock skew tolerance in seconds for exp/nbf/iat checks. */
  leewaySeconds?: number;

  // --- Lint ---

  /** Lint configuration (disabled rules, severity overrides, PII patterns). */
  lintConfig?: LintConfig;

  // --- Clock ---

  /** Clock override — used for both verification and status determination. */
  now?: Date;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Inspects a JWT token in a single call: decode → (OIDC discovery) → verify → lint.
 *
 * This is the high-level library equivalent of the CLI commands
 * `jwt inspect` and `jwt verify --oidc-discovery`.
 *
 * - If no key material is provided, the token is decoded and linted only
 *   (status will be `"unverified"`, `"expired"`, or `"not_yet_valid"`).
 * - If key material is provided (secret, PEM, JWK, JWKS URI, or OIDC discovery URL),
 *   signature verification is attempted and the result is included.
 * - Verification failure does **not** cause the function to return `Err` —
 *   the failure is recorded in `InspectResult.verificationResult`.
 *   Only hard failures (decode error, OIDC discovery failure) return `Err`.
 *
 * @param opts - Inspection options including the token and optional key material.
 * @returns `Ok(InspectResult)` on success, `Err(InspectError)` on hard failure.
 *
 * @example
 * ```ts
 * // Verify via OIDC discovery
 * const result = await inspectToken({
 *   token: "eyJ...",
 *   oidcDiscoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
 * });
 * if (result.ok) {
 *   console.log(result.value.status);            // "valid" | "expired" | ...
 *   console.log(result.value.verificationResult); // { ok: true } or { ok: false, error }
 *   console.log(result.value.lintFindings);       // LintFinding[]
 * }
 * ```
 */
export async function inspectToken(
  opts: InspectTokenOptions,
): Promise<Result<InspectResult, InspectError>> {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();

  // ── 1. Decode ──────────────────────────────────────────────────────────
  const decodeResult = decodeToken(opts.token);
  if (!decodeResult.ok) {
    return err({
      message: decodeResult.error.message,
      code: "DECODE_FAILED",
    });
  }
  const decoded = decodeResult.value;
  const { header, payload } = decoded;

  // ── 2. Resolve OIDC discovery → JWKS URI ───────────────────────────────
  let jwksUri = opts.jwksUri;
  if (jwksUri === undefined && opts.oidcDiscoveryUrl !== undefined) {
    const oidcResult = await resolveOidcJwksUri(opts.oidcDiscoveryUrl);
    if (!oidcResult.ok) {
      return err({
        message: oidcResult.error.message,
        code: "OIDC_DISCOVERY_FAILED",
      });
    }
    jwksUri = oidcResult.value;
  }

  // ── 3. Verify (if any key material was supplied) ───────────────────────
  const hasKey =
    opts.secret !== undefined ||
    opts.publicKeyPem !== undefined ||
    opts.publicKeyJwk !== undefined ||
    jwksUri !== undefined;

  let verificationResult: InspectResult["verificationResult"];

  if (hasKey) {
    const verifyOpts: VerifyOptions = {
      token: opts.token,
      secret: opts.secret,
      publicKeyPem: opts.publicKeyPem,
      publicKeyJwk: opts.publicKeyJwk,
      jwksUri,
      alg: opts.alg,
      requiredClaims: opts.requiredClaims,
      leewaySeconds: opts.leewaySeconds,
      now,
    };

    const vr = await verifyToken(verifyOpts);
    verificationResult = vr.ok ? { ok: true as const, value: true as const } : vr;
  }

  // ── 4. Lint ────────────────────────────────────────────────────────────
  const lintFindings: LintFinding[] = lintToken(decoded, opts.lintConfig ?? {});

  // ── 5. Build InspectResult ─────────────────────────────────────────────
  const algorithm = typeof header["alg"] === "string" ? header["alg"] : "unknown";
  const kid = typeof header["kid"] === "string" ? header["kid"] : undefined;
  const issuer = typeof payload["iss"] === "string" ? payload["iss"] : undefined;
  const subject = typeof payload["sub"] === "string" ? payload["sub"] : undefined;

  let audience: string | string[] | undefined;
  if (typeof payload["aud"] === "string") {
    audience = payload["aud"];
  } else if (Array.isArray(payload["aud"])) {
    audience = (payload["aud"] as unknown[]).map(String);
  }

  const iat = payload["iat"];
  const exp = payload["exp"];
  const nbf = payload["nbf"];

  const issuedAt = typeof iat === "number" ? new Date(iat * 1000) : undefined;
  const expiresAt = typeof exp === "number" ? new Date(exp * 1000) : undefined;
  const notBefore = typeof nbf === "number" ? new Date(nbf * 1000) : undefined;
  const timeUntilExpiry = typeof exp === "number" ? exp - nowMs / 1000 : undefined;

  // Custom claims — everything not in the standard set
  const customClaims: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!STANDARD_CLAIMS.has(key)) {
      customClaims[key] = value;
    }
  }

  // Determine status
  const nowSec = nowMs / 1000;
  let status: InspectResult["status"];
  if (typeof exp === "number" && exp < nowSec) {
    status = "expired";
  } else if (typeof nbf === "number" && nbf > nowSec) {
    status = "not_yet_valid";
  } else if (verificationResult?.ok === true) {
    status = "valid";
  } else {
    status = "unverified";
  }

  return ok({
    status,
    algorithm,
    kid,
    issuer,
    subject,
    audience,
    issuedAt,
    expiresAt,
    notBefore,
    timeUntilExpiry,
    customClaims,
    lintFindings,
    verificationResult,
  });
}
