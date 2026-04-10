import {
  generateKeyPair as joseGenerateKeyPair,
  exportPKCS8,
  exportSPKI,
  exportJWK,
} from "jose";
import { type Result, type KeygenError, ok, err } from "./types.js";

/** Supported key types for generation. */
export type KeyType = "rsa" | "ec" | "ed25519";

/** Output format for the generated key pair. */
export type KeyFormat = "jwk" | "pem";

/** Options for key pair generation. */
export interface KeygenOptions {
  /** Key type to generate */
  type: KeyType;
  /** Output format */
  format: KeyFormat;
  /** Key ID to embed in JWK output */
  kid?: string;
  /** RSA key size in bits (default: 2048, minimum: 2048) */
  rsaBits?: number;
  /** EC curve (default: "P-256") */
  ecCurve?: string;
}

/** The generated key pair in the requested format. */
export interface GeneratedKeyPair {
  /** Private key in the requested format (JWK JSON string or PEM) */
  privateKey: string;
  /** Public key in the requested format (JWK JSON string or PEM) */
  publicKey: string;
  /** Key ID, if provided */
  kid?: string;
}

/**
 * Generates a cryptographic key pair for JWT signing.
 * Uses jose for all cryptographic operations.
 *
 * @param opts - Key generation options
 * @returns A `Result` containing the generated key pair or a `KeygenError`
 */
export async function generateKeyPair(
  opts: KeygenOptions
): Promise<Result<GeneratedKeyPair, KeygenError>> {
  try {
    let privateKey: CryptoKey;
    let publicKey: CryptoKey;

    switch (opts.type) {
      case "rsa": {
        const pair = await joseGenerateKeyPair("RS256", {
          modulusLength: Math.max(opts.rsaBits ?? 2048, 2048),
          extractable: true,
        });
        privateKey = pair.privateKey as CryptoKey;
        publicKey = pair.publicKey as CryptoKey;
        break;
      }
      case "ec": {
        const pair = await joseGenerateKeyPair("ES256", {
          crv: opts.ecCurve ?? "P-256",
          extractable: true,
        });
        privateKey = pair.privateKey as CryptoKey;
        publicKey = pair.publicKey as CryptoKey;
        break;
      }
      case "ed25519": {
        const pair = await joseGenerateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
        privateKey = pair.privateKey as CryptoKey;
        publicKey = pair.publicKey as CryptoKey;
        break;
      }
      default: {
        const exhaustive: never = opts.type;
        return err({
          message: `Unsupported key type: ${exhaustive}`,
          code: "UNSUPPORTED_TYPE",
        });
      }
    }

    if (opts.format === "pem") {
      const [privPem, pubPem] = await Promise.all([
        exportPKCS8(privateKey),
        exportSPKI(publicKey),
      ]);
      return ok({
        privateKey: privPem,
        publicKey: pubPem,
        ...(opts.kid !== undefined ? { kid: opts.kid } : {}),
      });
    }

    // JWK format
    const [privJwk, pubJwk] = await Promise.all([
      exportJWK(privateKey),
      exportJWK(publicKey),
    ]);

    if (opts.kid !== undefined) {
      privJwk.kid = opts.kid;
      pubJwk.kid = opts.kid;
    }

    return ok({
      privateKey: JSON.stringify(privJwk, null, 2),
      publicKey: JSON.stringify(pubJwk, null, 2),
      ...(opts.kid !== undefined ? { kid: opts.kid } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ message, code: "GENERATION_FAILED" });
  }
}
