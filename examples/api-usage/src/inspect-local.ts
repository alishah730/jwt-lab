/**
 * Local Token Inspection
 *
 * Demonstrates the `inspectToken` high-level API with local keys
 * (no OIDC / JWKS network calls). This is the library equivalent of:
 *
 *   jwt inspect <token> --secret my-secret
 *   jwt inspect <token> --key ./public.pem
 *
 * Shows how inspectToken composes decode + verify + lint in one call.
 *
 * Run:  npm run inspect-local
 */
import {
  encodeToken,
  generateKeyPair,
  inspectToken,
  type InspectResult,
} from "jwt-lab";

const now = Math.floor(Date.now() / 1000);

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

function printResult(r: InspectResult) {
  console.log(`  status:      ${r.status}`);
  console.log(`  algorithm:   ${r.algorithm}`);
  if (r.kid)               console.log(`  kid:         ${r.kid}`);
  if (r.issuer)            console.log(`  issuer:      ${r.issuer}`);
  if (r.subject)           console.log(`  subject:     ${r.subject}`);
  if (r.audience)          console.log(`  audience:    ${Array.isArray(r.audience) ? r.audience.join(", ") : r.audience}`);
  if (r.issuedAt)          console.log(`  issuedAt:    ${r.issuedAt.toISOString()}`);
  if (r.expiresAt)         console.log(`  expiresAt:   ${r.expiresAt.toISOString()}`);
  if (r.timeUntilExpiry !== undefined)
    console.log(`  timeLeft:    ${r.timeUntilExpiry}s`);

  const custom = Object.keys(r.customClaims);
  if (custom.length > 0)   console.log(`  custom:      ${custom.join(", ")}`);

  if (r.verificationResult === undefined) {
    console.log(`  signature:   ⚠ not checked (no key provided)`);
  } else if (r.verificationResult.ok) {
    console.log(`  signature:   ✅ verified`);
  } else {
    console.log(`  signature:   ❌ ${r.verificationResult.error.reason}`);
  }

  console.log(`  lint:        ${r.lintFindings.length} finding(s)`);
  for (const f of r.lintFindings) {
    console.log(`               [${f.severity}] ${f.ruleId}: ${f.description}`);
  }
}

// ─── 1. Inspect with HMAC secret ─────────────────────────────────────────────

section("1. inspectToken — HMAC (HS256)");

const SECRET = "super-secret-demo-key";

const hmacToken = await encodeToken({
  payload: { sub: "user_42", role: "admin", iss: "https://auth.example.com", iat: now, exp: now + 3600 },
  secret: SECRET,
  alg: "HS256",
});
if (!hmacToken.ok) { console.error("  ❌ encode failed"); process.exit(1); }

const hmacInspect = await inspectToken({
  token: hmacToken.value,
  secret: SECRET,
});
if (!hmacInspect.ok) { console.error("  ❌ inspect failed:", hmacInspect.error); process.exit(1); }
printResult(hmacInspect.value);

// ─── 2. Inspect with wrong secret — shows verification failure in result ────

section("2. inspectToken — wrong secret (verification failure)");

const wrongInspect = await inspectToken({
  token: hmacToken.value,
  secret: "wrong-secret",
});
if (!wrongInspect.ok) { console.error("  ❌ inspect failed:", wrongInspect.error); process.exit(1); }
printResult(wrongInspect.value);
console.log(`\n  → status is "${wrongInspect.value.status}" because signature failed`);
console.log("  → But decode & lint still work — you still get all the metadata");

// ─── 3. Inspect with EC public key ──────────────────────────────────────────

section("3. inspectToken — EC P-256 key pair");

const ecKeys = await generateKeyPair({ type: "ec", format: "pem", kid: "demo-ec" });
if (!ecKeys.ok) { console.error("  ❌ keygen failed"); process.exit(1); }

const ecToken = await encodeToken({
  payload: { sub: "svc_worker", iss: "https://auth.example.com", aud: "internal-api", iat: now, exp: now + 900 },
  privateKeyPem: ecKeys.value.privateKey,
  alg: "ES256",
  kid: ecKeys.value.kid,
});
if (!ecToken.ok) { console.error("  ❌ encode failed"); process.exit(1); }

const ecInspect = await inspectToken({
  token: ecToken.value,
  publicKeyPem: ecKeys.value.publicKey,
  // alg not specified — auto-detected from header
});
if (!ecInspect.ok) { console.error("  ❌ inspect failed:", ecInspect.error); process.exit(1); }
printResult(ecInspect.value);

// ─── 4. Inspect without key — decode + lint only ────────────────────────────

section("4. inspectToken — decode + lint only (no key)");

const noKeyInspect = await inspectToken({ token: ecToken.value });
if (!noKeyInspect.ok) { console.error("  ❌ inspect failed:", noKeyInspect.error); process.exit(1); }
printResult(noKeyInspect.value);
console.log(`\n  → Still get full metadata even without verification`);

// ─── 5. Inspect expired token ───────────────────────────────────────────────

section("5. inspectToken — expired token");

const expiredToken = await encodeToken({
  payload: { sub: "old_user", iat: now - 7200, exp: now - 3600 },
  secret: SECRET,
  alg: "HS256",
});
if (!expiredToken.ok) { console.error("  ❌ encode failed"); process.exit(1); }

const expiredInspect = await inspectToken({
  token: expiredToken.value,
  secret: SECRET,
});
if (!expiredInspect.ok) { console.error("  ❌ inspect failed:", expiredInspect.error); process.exit(1); }
printResult(expiredInspect.value);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
if (process.exitCode !== 1) {
  console.log("  All local inspection examples passed.");
} else {
  console.log("  Some examples FAILED — see ❌ above.");
}
console.log("═".repeat(60) + "\n");
