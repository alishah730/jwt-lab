import { type Result, type NlpError, ok } from "./types.js";
import { parseDuration } from "./duration.js";

/**
 * Parses a natural language description into a JWT payload object.
 * No external LLM calls — purely rule-based regex matching.
 *
 * Recognized patterns:
 * - `"expires in <duration>"` or `"for <duration>"` → sets `exp` (unix timestamp)
 * - `"issued by <string>"` → sets `iss`
 * - `"for user <string>"` or `"subject <string>"` → sets `sub`
 * - `"user <email>"` → sets `sub` to email
 * - `"role: <string>"` or `"<string> role"` or `"<string> user"` → sets `role`
 * - `"roles: a,b,c"` → sets `roles` array
 * - `"scope: <csv>"` or `"scopes: <csv>"` → sets `scope` array
 * - `"email: <email>"` or `"user <email>"` → sets `email`
 * - `"admin"` keyword → sets `role: "admin"`
 *
 * All matching is case-insensitive. When multiple patterns match the same
 * field, the last match wins. Returns `ok({})` (empty payload) when no
 * patterns match — never returns `Err`.
 *
 * @param description - Natural language string describing the desired payload.
 * @param now - The current time used as the base for relative expiry (`exp`).
 * @returns `Ok` with the parsed payload object (possibly empty), never `Err`.
 */
export function parseNaturalLanguagePayload(
  description: string,
  now: Date
): Result<Record<string, unknown>, NlpError> {
  const payload: Record<string, unknown> = {};
  const lower = description.toLowerCase();

  // exp: "expires in <duration>" or "for <duration>" (when not followed by "user")
  const expiresInMatch = lower.match(/expires?\s+in\s+(\S+)/);
  if (expiresInMatch) {
    const durationResult = parseDuration(expiresInMatch[1]);
    if (durationResult.ok) {
      payload["exp"] = Math.floor(now.getTime() / 1000) + durationResult.value;
    }
  }

  // "for <duration>" — only when the token after "for" looks like a duration
  const forDurationMatch = lower.match(/\bfor\s+(\d+[smhdw]\S*)/);
  if (forDurationMatch) {
    const durationResult = parseDuration(forDurationMatch[1]);
    if (durationResult.ok) {
      payload["exp"] = Math.floor(now.getTime() / 1000) + durationResult.value;
    }
  }

  // iss: "issued by <string>"
  const issuedByMatch = description.match(/issued\s+by\s+(\S+)/i);
  if (issuedByMatch) {
    payload["iss"] = issuedByMatch[1];
  }

  // sub: "for user <string>"
  const forUserMatch = description.match(/\bfor\s+user\s+(\S+)/i);
  if (forUserMatch) {
    payload["sub"] = forUserMatch[1];
  }

  // sub: "subject <string>"
  const subjectMatch = description.match(/\bsubject\s+(\S+)/i);
  if (subjectMatch) {
    payload["sub"] = subjectMatch[1];
  }

  // email + sub: "user <email>" — email pattern
  const userEmailMatch = description.match(/\buser\s+([\w.+-]+@[\w.-]+\.\w+)/i);
  if (userEmailMatch) {
    payload["sub"] = userEmailMatch[1];
    payload["email"] = userEmailMatch[1];
  }

  // email: "email: <email>"
  const emailMatch = description.match(/\bemail:\s*([\w.+-]+@[\w.-]+\.\w+)/i);
  if (emailMatch) {
    payload["email"] = emailMatch[1];
  }

  // role: "role: <string>"
  const roleColonMatch = description.match(/\brole:\s*(\S+)/i);
  if (roleColonMatch) {
    payload["role"] = roleColonMatch[1];
  }

  // role: "<string> role" (e.g. "admin role")
  const roleWordMatch = description.match(/\b(\w+)\s+role\b/i);
  if (roleWordMatch) {
    payload["role"] = roleWordMatch[1].toLowerCase();
  }

  // role: "<string> user" (e.g. "admin user") — only when not an email pattern
  const userRoleMatch = description.match(/\b(\w+)\s+user\b/i);
  if (userRoleMatch && !userEmailMatch) {
    payload["role"] = userRoleMatch[1].toLowerCase();
  }

  // role: "admin" keyword (standalone)
  if (/\badmin\b/i.test(description)) {
    payload["role"] = "admin";
  }

  // roles: "roles: a,b,c"
  const rolesMatch = description.match(/\broles:\s*([\w]+(?:\s*,\s*[\w]+)*)/i);
  if (rolesMatch) {
    payload["roles"] = rolesMatch[1]
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
  }

  // scope: "scope: <csv>" or "scopes: <csv>"
  const scopeMatch = description.match(/\bscopes?:\s*([\w,\s:/.-]+)/i);
  if (scopeMatch) {
    payload["scope"] = scopeMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return ok(payload);
}
