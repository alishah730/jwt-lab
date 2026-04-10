/**
 * In-memory JWKS (JSON Web Key Set) cache.
 *
 * Fetches JWKS documents from remote URIs and caches them for the lifetime
 * of the process to avoid redundant network requests.
 */

import { z } from "zod";
import { type Result, type JwksError, ok, err } from "./types.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single JSON Web Key. */
export interface JWK {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
  [key: string]: unknown;
}

/** A JSON Web Key Set document. */
export interface JWKSDocument {
  keys: JWK[];
}

/** Interface for the JWKS cache. */
export interface JwksCache {
  /**
   * Fetches and caches a JWKS document from the given URI.
   * Returns the cached value on subsequent calls (process-lifetime cache).
   */
  get(uri: string): Promise<Result<JWKSDocument, JwksError>>;

  /** Removes a cached entry, forcing a fresh fetch on the next `get()` call. */
  invalidate(uri: string): void;
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const jwksSchema = z.object({
  keys: z.array(z.record(z.string(), z.unknown())),
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a new in-memory JWKS cache.
 * Cache entries persist for the lifetime of the process.
 */
export function createJwksCache(): JwksCache {
  const cache = new Map<string, JWKSDocument>();

  return {
    async get(uri: string): Promise<Result<JWKSDocument, JwksError>> {
      // Cache hit – return immediately without a network request.
      const cached = cache.get(uri);
      if (cached !== undefined) {
        return ok(cached);
      }

      // Cache miss – fetch from the network.
      let response: Response;
      try {
        response = await fetch(uri);
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : String(cause);
        return err<JwksError>({
          message: `Failed to fetch JWKS from "${uri}": ${message}`,
          code: "FETCH_FAILED",
        });
      }

      if (!response.ok) {
        return err<JwksError>({
          message: `Failed to fetch JWKS from "${uri}": HTTP ${response.status} ${response.statusText}`,
          code: "FETCH_FAILED",
        });
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : String(cause);
        return err<JwksError>({
          message: `Failed to parse JWKS response from "${uri}": ${message}`,
          code: "FETCH_FAILED",
        });
      }

      const parsed = jwksSchema.safeParse(json);
      if (!parsed.success) {
        return err<JwksError>({
          message: `Invalid JWKS shape from "${uri}": ${parsed.error.message}`,
          code: "INVALID_SHAPE",
        });
      }

      const document: JWKSDocument = parsed.data as unknown as JWKSDocument;
      cache.set(uri, document);
      return ok(document);
    },

    invalidate(uri: string): void {
      cache.delete(uri);
    },
  };
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

/** Convenience singleton JWKS cache shared across the process. */
export const jwksCache: JwksCache = createJwksCache();

// ---------------------------------------------------------------------------
// OpenID Connect Discovery
// ---------------------------------------------------------------------------

/** Schema for an OpenID Connect discovery document (only the fields we need). */
const oidcDiscoverySchema = z.object({
  jwks_uri: z.string().url(),
  issuer: z.string().optional(),
});

/**
 * Fetches an OpenID Connect discovery document and extracts the `jwks_uri`.
 *
 * @param discoveryUrl - The full URL to the `.well-known/openid-configuration` endpoint.
 * @returns The `jwks_uri` string on success, or an error.
 */
export async function resolveOidcJwksUri(
  discoveryUrl: string,
): Promise<Result<string, JwksError>> {
  let response: Response;
  try {
    response = await fetch(discoveryUrl);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err<JwksError>({
      message: `Failed to fetch OIDC discovery from "${discoveryUrl}": ${message}`,
      code: "FETCH_FAILED",
    });
  }

  if (!response.ok) {
    return err<JwksError>({
      message: `Failed to fetch OIDC discovery from "${discoveryUrl}": HTTP ${response.status} ${response.statusText}`,
      code: "FETCH_FAILED",
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err<JwksError>({
      message: `Failed to parse OIDC discovery response from "${discoveryUrl}": ${message}`,
      code: "FETCH_FAILED",
    });
  }

  const parsed = oidcDiscoverySchema.safeParse(json);
  if (!parsed.success) {
    // The URL might already be a JWKS endpoint — check if the response looks
    // like a JWKS document (has a `keys` array) and use the URL directly.
    const jwksParsed = jwksSchema.safeParse(json);
    if (jwksParsed.success) {
      return ok(discoveryUrl);
    }
    return err<JwksError>({
      message: `Invalid OIDC discovery document from "${discoveryUrl}": missing or invalid jwks_uri`,
      code: "INVALID_SHAPE",
    });
  }

  return ok(parsed.data.jwks_uri);
}

/**
 * Builds a well-known discovery URL from an issuer string.
 * Appends `/.well-known/openid-configuration` to the issuer URL.
 *
 * @param issuer - The `iss` claim value from a JWT.
 * @returns The discovery URL, or null if the issuer is not a valid URL.
 */
export function buildDiscoveryUrl(issuer: string): string | null {
  try {
    const url = new URL(issuer);
    // Remove trailing slash to avoid double-slash
    const base = url.href.replace(/\/+$/, "");
    return `${base}/.well-known/openid-configuration`;
  } catch {
    return null;
  }
}
