import { SignJWT, importPKCS8, importJWK, type JWK } from "jose";
import { v4 as uuidv4 } from "uuid";
import {
  type Result,
  type EncodeError,
  type SupportedAlgorithm,
  ok,
  err,
} from "./types.js";

/** Options for encoding a JWT token. */
export interface EncodeOptions {
  /** JWT payload claims */
  payload: Record<string, unknown>;
  /** Additional header fields to merge into the protected header */
  header?: Record<string, unknown>;
  /** HMAC secret string (for HS256/384/512) */
  secret?: string;
  /** PEM-encoded private key (for RS*, ES*, EdDSA, PS*) */
  privateKeyPem?: string;
  /** JWK private key object (for RS*, ES*, EdDSA, PS*) */
  privateKeyJwk?: Record<string, unknown>;
  /** JWT algorithm */
  alg: SupportedAlgorithm;
  /** Key ID to set in the protected header */
  kid?: string;
  /** Clock override for `iat` generation (Fake_Time support) */
  now?: Date;
}

/**
 * Encodes a JWT token using the provided options.
 *
 * Uses `jose` for all cryptographic operations. Never uses `jsonwebtoken`.
 *
 * - If `payload.jti === true`, it is replaced with a UUID v4 before signing.
 * - `iat` is set from `opts.now ?? new Date()` (unix seconds).
 * - Supports HMAC (`HS256/384/512`) via `secret`, and asymmetric algorithms
 *   (`RS*`, `ES*`, `EdDSA`, `PS*`) via `privateKeyPem` or `privateKeyJwk`.
 * - Extra `header` fields are merged into the protected header alongside `alg`
 *   and `kid`.
 *
 * @param opts - Encoding options.
 * @returns `Ok(token)` on success, or `Err(EncodeError)` on failure.
 */
export async function encodeToken(
  opts: EncodeOptions,
): Promise<Result<string, EncodeError>> {
  // Warn about "none" algorithm — jose does not support it.
  if ((opts.alg as string) === "none") {
    return err({
      message:
        'Algorithm "none" is not supported. jose does not allow unsigned tokens. Use a proper signing algorithm.',
      code: "SIGN_FAILED",
    });
  }

  try {
    // Build a mutable copy of the payload.
    const payload: Record<string, unknown> = { ...opts.payload };

    // Replace jti: true with a generated UUID v4.
    if (payload["jti"] === true) {
      payload["jti"] = uuidv4();
    }

    // Resolve the signing key.
    let signingKey: CryptoKey | Uint8Array;

    if (opts.secret !== undefined) {
      signingKey = new TextEncoder().encode(opts.secret);
    } else if (opts.privateKeyPem !== undefined) {
      signingKey = await importPKCS8(opts.privateKeyPem, opts.alg) as CryptoKey;
    } else if (opts.privateKeyJwk !== undefined) {
      signingKey = (await importJWK(
        opts.privateKeyJwk as unknown as JWK,
        opts.alg,
      )) as CryptoKey;
    } else {
      return err({
        message:
          "No signing key provided. Use --secret or --key.",
        code: "MISSING_KEY",
      });
    }

    // Determine iat from the clock override or wall clock.
    const now = opts.now ?? new Date();
    const iat = Math.floor(now.getTime() / 1000);

    // Build the protected header, merging any extra header fields.
    const protectedHeader: Record<string, unknown> = {
      ...(opts.header ?? {}),
      alg: opts.alg,
      ...(opts.kid !== undefined ? { kid: opts.kid } : {}),
    };

    // Sign the token.
    const token = await new SignJWT(payload)
      .setProtectedHeader(protectedHeader as { alg: string })
      .setIssuedAt(iat)
      .sign(signingKey);

    return ok(token);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return err({ message, code: "SIGN_FAILED" });
  }
}
