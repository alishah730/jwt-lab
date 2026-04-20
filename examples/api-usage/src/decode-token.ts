/**
 * jwt-lab — decodeToken() Example
 *
 * Demonstrates decoding JWTs programmatically without signature verification,
 * equivalent to:   jwt decode <token>
 *
 * Usage:  npm run decode-token
 */
import { decodeToken } from "jwt-lab";
import type { DecodedToken, DecodeError, Result } from "jwt-lab";

// ─── Helper: pretty-print a decoded token ────────────────────────────
function printDecoded(label: string, result: Result<DecodedToken, DecodeError>): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("═".repeat(60));

  if (!result.ok) {
    console.log(`  ❌ Decode failed: ${result.error.message} [${result.error.code}]`);
    return;
  }

  const { header, payload, signaturePresent } = result.value;

  console.log("\n  📋 Header:");
  console.log(`     ${JSON.stringify(header, null, 2).replace(/\n/g, "\n     ")}`);

  console.log("\n  📦 Payload:");
  console.log(`     ${JSON.stringify(payload, null, 2).replace(/\n/g, "\n     ")}`);

  console.log(`\n  🔏 Signature present: ${signaturePresent ? "yes" : "no"}`);

  // Standard claim helpers
  if (typeof payload["exp"] === "number") {
    const expDate = new Date(payload["exp"] * 1000);
    const now = Date.now() / 1000;
    const delta = payload["exp"] - now;
    const expired = delta < 0;
    console.log(
      `\n  ⏰ Expiry: ${expDate.toISOString()} (${expired ? "EXPIRED " + Math.abs(Math.round(delta)) + "s ago" : "valid for " + Math.round(delta) + "s"})`,
    );
  }
  if (typeof payload["iss"] === "string") {
    console.log(`  🏢 Issuer: ${payload["iss"]}`);
  }
  if (typeof payload["sub"] === "string") {
    console.log(`  👤 Subject: ${payload["sub"]}`);
  }
  if (payload["aud"] !== undefined) {
    console.log(`  🎯 Audience: ${typeof payload["aud"] === "string" ? payload["aud"] : JSON.stringify(payload["aud"])}`);
  }
}

// ─── Helper: extract payload (like the user's code snippet) ──────────
function extractPayload(token: string): Record<string, unknown> {
  const result = decodeToken(token);
  if (result.ok) {
    return result.value.payload;
  }
  console.error("Error decoding JWT token:", result.error);
  return {};
}

// ─── 1. Decode a real-world OIDC token ───────────────────────────────
console.log("\n🔬 jwt-lab — decodeToken() Examples\n");

const oidcToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30";

printDecoded("1 · Real-world OIDC token (RS256)", decodeToken(oidcToken));
console.log("\n  🔍 Extracting specific claims from payload...");
console.log(decodeToken(oidcToken));
console.log("=====");
// Quick extraction using the helper
const payload = extractPayload(oidcToken);
console.log("\n  📤 extractPayload() →", {
  sub: payload["sub"],
  aud: payload["aud"],
  iss: payload["iss"],
  roles: (payload["claimsByAud"] as Record<string, Record<string, unknown>>)?.["dhs_lcm_dev"]?.["roles"],
});

// ─── 2. Decode a simple HMAC token ──────────────────────────────────
import { encodeToken } from "jwt-lab";

const encoded = await encodeToken({
  payload: { sub: "user123", role: "admin", data: { level: 5 } },
  secret: "demo-secret",
  alg: "HS256",
});
if (!encoded.ok) throw new Error(encoded.error.message);

printDecoded("2 · Self-signed HMAC token (HS256)", decodeToken(encoded.value));

// ─── 3. Handle malformed tokens gracefully ──────────────────────────
printDecoded("3 · Malformed: not a JWT", decodeToken("this-is-not-a-jwt"));
printDecoded("4 · Malformed: only 2 parts", decodeToken("abc.def"));
printDecoded("5 · Malformed: bad base64", decodeToken("!!!.@@@.###"));

// ─── 4. Decode a token with nested claims and extract deep values ───
const nested = await encodeToken({
  payload: {
    sub: "svc-account",
    permissions: { read: true, write: false, admin: false },
    tags: ["api", "v2", "beta"],
  },
  secret: "test",
  alg: "HS256",
});
if (!nested.ok) throw new Error(nested.error.message);

const nestedResult = decodeToken(nested.value);
if (nestedResult.ok) {
  

  const p = nestedResult.value.payload;
  console.log(`\n${"═".repeat(60)}`);
  console.log("  5 · Deep claim extraction");
  console.log("═".repeat(60));
  console.log("  permissions.write →", (p["permissions"] as Record<string, unknown>)?.["write"]);
  console.log("  tags[1]           →", (p["tags"] as string[])?.[1]);
  console.log("  alg from header   →", nestedResult.value.header["alg"]);
}

// ─── 5. Unsecured token (alg: none) ────────────────────────────────
const unsecuredToken =
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.";

printDecoded("6 · Unsecured token (alg: none)", decodeToken(unsecuredToken));

console.log("\n✅ All decode examples complete!\n");
