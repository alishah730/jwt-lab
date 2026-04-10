import {
  jwtVerify,
  importSPKI,
  importJWK,
  createRemoteJWKSet,
  decodeProtectedHeader,
  errors as joseErrors,
  type JWK,
  type JWTVerifyGetKey,
} from "jose";
import {
  type Result,
  type DecodedToken,
  type VerifyError,
  type SupportedAlgorithm,
  ok,
  err,
} from "./types.js";

/** Options for verifying a JWT token. */
export interface VerifyOptions {
  /** The JWT string to verify. */
  token: string;
  /** HMAC secret string. */
  secret?: string;
  /** PEM-encoded public key. */
  publicKeyPem?: string;
  /** JWK public key object. */
  publicKeyJwk?: Record<string, unknown>;
  /** Remote JWKS URI. */
  jwksUri?: string;
  /** Expected algorithm — rejects tokens with a different alg. */
  alg?: SupportedAlgorithm;
  /** Claims that must be present in the payload. */
  requiredClaims?: string[];
  /** Clock skew tolerance in seconds for exp/nbf/iat. */
  leewaySeconds?: number;
  /** Clock override (Fake_Time support). */
  now?: Date;
}

/**
 * Verifies a JWT token's signature and validates its claims.
 * Uses jose for all cryptographic operations.
 *
 * @param opts - Verification options including the token and key material.
 * @returns Ok(DecodedToken) on success, Err(VerifyError) on failure.
 */
export async function verifyToken(
  opts: VerifyOptions,
): Promise<Result<DecodedToken, VerifyError>> {
  // Auto-detect algorithm from the token header when not explicitly provided.
  // This is needed for importSPKI / importJWK which require an algorithm hint.
  let effectiveAlg = opts.alg;
  if (effectiveAlg === undefined && (opts.publicKeyPem !== undefined || opts.publicKeyJwk !== undefined)) {
    try {
      const header = decodeProtectedHeader(opts.token);
      if (typeof header.alg === "string") {
        effectiveAlg = header.alg as SupportedAlgorithm;
      }
    } catch {
      // Fall through — jwtVerify will surface a proper error later.
    }
  }

  // 1. Resolve the verification key
  let key: Uint8Array | CryptoKey | JWK | JWTVerifyGetKey;

  if (opts.secret !== undefined) {
    key = new TextEncoder().encode(opts.secret) as Uint8Array;
  } else if (opts.publicKeyPem !== undefined) {
    try {
      key = await importSPKI(opts.publicKeyPem, effectiveAlg ?? "RS256");
    } catch (e) {
      return err<VerifyError>({
        reason: "malformed",
        message: `Failed to import PEM public key: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  } else if (opts.publicKeyJwk !== undefined) {
    try {
      key = await importJWK(opts.publicKeyJwk as unknown as JWK, effectiveAlg ?? "RS256");
    } catch (e) {
      return err<VerifyError>({
        reason: "malformed",
        message: `Failed to import JWK public key: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  } else if (opts.jwksUri !== undefined) {
    key = createRemoteJWKSet(new URL(opts.jwksUri));
  } else {
    return err<VerifyError>({
      reason: "malformed",
      message: "No verification key provided",
    });
  }

  // 2. Build jose jwtVerify options
  const joseOptions: Parameters<typeof jwtVerify>[2] = {
    clockTolerance: opts.leewaySeconds ?? 0,
    ...(effectiveAlg !== undefined ? { algorithms: [effectiveAlg] } : {}),
    ...(opts.now !== undefined ? { currentDate: opts.now } : {}),
  };

  // 3. Call jwtVerify
  let protectedHeader: Record<string, unknown>;
  let payload: Record<string, unknown>;

  try {
    const result = await jwtVerify(
      opts.token,
      key as Parameters<typeof jwtVerify>[1],
      joseOptions,
    );
    protectedHeader = result.protectedHeader as Record<string, unknown>;
    payload = result.payload as Record<string, unknown>;
  } catch (e) {
    return err<VerifyError>(mapJoseError(e));
  }

  // 4. Check requiredClaims
  if (opts.requiredClaims !== undefined) {
    for (const claim of opts.requiredClaims) {
      if (!(claim in payload)) {
        return err<VerifyError>({
          reason: "missing_claim",
          message: `Missing required claim: ${claim}`,
        });
      }
    }
  }

  // 5. Return success
  return ok<DecodedToken>({
    header: protectedHeader,
    payload,
    signaturePresent: true,
  });
}

/**
 * Maps a jose error to a typed VerifyError.
 *
 * @param e - The caught error from jose.
 * @returns A VerifyError with an appropriate reason and message.
 */
function mapJoseError(e: unknown): VerifyError {
  const message = e instanceof Error ? e.message : String(e);

  if (e instanceof joseErrors.JWTExpired) {
    return { reason: "expired", message };
  }

  if (e instanceof joseErrors.JWTClaimValidationFailed) {
    if (e.claim === "nbf") {
      return { reason: "not_yet_valid", message };
    }
    return { reason: "signature_mismatch", message };
  }

  if (e instanceof joseErrors.JWSSignatureVerificationFailed) {
    return { reason: "signature_mismatch", message };
  }

  if (
    e instanceof joseErrors.JOSEAlgNotAllowed ||
    (e instanceof Error && /algorithm/i.test(e.message))
  ) {
    return { reason: "algorithm_mismatch", message };
  }

  if (e instanceof joseErrors.JWTInvalid || e instanceof joseErrors.JOSENotSupported) {
    return { reason: "malformed", message };
  }

  // Fallback
  return { reason: "signature_mismatch", message };
}
