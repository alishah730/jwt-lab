/**
 * Redaction utilities for MCP server.
 * Ensures sensitive data is never logged or leaked in responses.
 */

/**
 * Truncates a token string for safe logging.
 * Tokens longer than 20 characters are truncated to the first 20 chars + "...".
 */
export function redactToken(token: string): string {
  return token.length > 20 ? `${token.slice(0, 20)}...` : token;
}

/**
 * Removes specified claim keys from a payload object.
 * Returns a new object — does not mutate the original.
 *
 * @param payload - The original JWT payload.
 * @param claimsToRedact - A list of claim keys to remove.
 * @returns A copy of the payload with the specified claims removed.
 */
export function redactClaims(
  payload: Record<string, unknown>,
  claimsToRedact: string[],
): Record<string, unknown> {
  if (claimsToRedact.length === 0) return payload;

  const redactSet = new Set(claimsToRedact);
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (redactSet.has(key)) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }

  return result;
}
