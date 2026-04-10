import { type Result, type DecodedToken, type DecodeError, ok, err } from "./types.js";

/**
 * Base64url-decodes a segment and parses it as JSON.
 *
 * @param segment - A base64url-encoded string.
 * @param label - Human-readable label used in error messages ("header" or "payload").
 * @returns The parsed object, or a `DecodeError` if decoding/parsing fails.
 */
function decodeSegment(
  segment: string,
  label: string,
): Record<string, unknown> | DecodeError {
  let json: string;
  try {
    json = Buffer.from(segment, "base64url").toString("utf8");
  } catch {
    return { message: `Failed to base64url-decode ${label} segment`, code: "MALFORMED" };
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { message: `Invalid JSON in ${label} segment`, code: "INVALID_JSON" };
    }
    return parsed as Record<string, unknown>;
  } catch {
    return { message: `Invalid JSON in ${label} segment`, code: "INVALID_JSON" };
  }
}

/**
 * Decodes a JWT token without performing signature verification.
 * Pure structural decode only — splits on ".", base64url-decodes, JSON-parses.
 *
 * @param token - The JWT string to decode.
 * @returns Ok(DecodedToken) on success, Err(DecodeError) on failure.
 */
export function decodeToken(token: string): Result<DecodedToken, DecodeError> {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return err({
        message: `Malformed JWT: expected 3 dot-separated parts, got ${parts.length}`,
        code: "MALFORMED",
      });
    }

    const headerResult = decodeSegment(parts[0], "header");
    if ("code" in headerResult) {
      return err(headerResult as DecodeError);
    }

    const payloadResult = decodeSegment(parts[1], "payload");
    if ("code" in payloadResult) {
      return err(payloadResult as DecodeError);
    }

    return ok({
      header: headerResult,
      payload: payloadResult,
      signaturePresent: parts[2].length > 0,
    });
  } catch (e) {
    return err({
      message: `Unexpected error during decode: ${e instanceof Error ? e.message : String(e)}`,
      code: "MALFORMED",
    });
  }
}
