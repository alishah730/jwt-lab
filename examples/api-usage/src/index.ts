/**
 * jwt-lab API usage examples
 *
 * Demonstrates all core library functions:
 *   parseDuration · encodeToken · decodeToken · verifyToken · lintToken
 *   generateKeyPair · inspectToken · parseNaturalLanguagePayload
 *
 * Run:  npm start
 */
import {
  parseDuration,
  encodeToken,
  decodeToken,
  verifyToken,
  lintToken,
  generateKeyPair,
  inspectToken,
  parseNaturalLanguagePayload,
  type EncodeOptions,
  type VerifyOptions,
  type KeygenOptions,
  type LintConfig,
  type LintFinding,
  type InspectResult,
} from "jwt-lab";

// ─── Helpers ────────────────────────────────────────────────────────────────

function section(title: string): void {
  console.log(`\n${"─".repeat(56)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(56));
}

function pass(label: string, detail?: unknown): void {
  const suffix = detail !== undefined ? `  →  ${JSON.stringify(detail)}` : "";
  console.log(`  ✅  ${label}${suffix}`);
}

function fail(label: string, detail?: unknown): void {
  const suffix = detail !== undefined ? `  →  ${JSON.stringify(detail)}` : "";
  console.error(`  ❌  ${label}${suffix}`);
  process.exitCode = 1;
}

// ─── 1. parseDuration ───────────────────────────────────────────────────────

section("1. parseDuration");

const cases: [string, number][] = [
  ["30s", 30],
  ["5m", 300],
  ["2h", 7200],
  ["1h30m", 5400],
  ["7d", 604800],
];

for (const [input, expected] of cases) {
  const result = parseDuration(input);
  if (result.ok && result.value === expected) {
    pass(`parseDuration("${input}")`, `${result.value}s`);
  } else {
    fail(`parseDuration("${input}") expected ${expected}s`, result);
  }
}

// Invalid input
const badDuration = parseDuration("not-a-duration");
if (!badDuration.ok) {
  pass("parseDuration('not-a-duration') correctly returns Err", badDuration.error.message);
}

// ─── 2. encodeToken — HMAC (HS256) ──────────────────────────────────────────

section("2. encodeToken — HMAC (HS256)");

const HMAC_SECRET = "super-secret-key-for-demo";
const now = Math.floor(Date.now() / 1000);

const hmacOpts: EncodeOptions = {
  payload: {
    sub: "user_42",
    role: "admin",
    iss: "https://auth.example.com",
    aud: "api.example.com",
    iat: now,
    exp: now + 3600, // 1 hour
  },
  secret: HMAC_SECRET,
  alg: "HS256",
};

const hmacResult = await encodeToken(hmacOpts);

if (!hmacResult.ok) {
  fail("encodeToken (HS256) failed", hmacResult.error);
  process.exit(1);
}

const hmacToken = hmacResult.value;
pass("Encoded HS256 JWT", `${hmacToken.slice(0, 36)}…`);

// ─── 3. decodeToken ──────────────────────────────────────────────────────────

section("3. decodeToken (no signature verification)");

const decoded = decodeToken(hmacToken);

if (!decoded.ok) {
  fail("decodeToken failed", decoded.error);
} else {
  pass("header.alg",     decoded.value.header["alg"]);
  pass("payload.sub",    decoded.value.payload["sub"]);
  pass("payload.role",   decoded.value.payload["role"]);
  pass("signaturePresent", decoded.value.signaturePresent);
}

// Malformed token
const malformed = decodeToken("not.a.jwt.at.all");
if (!malformed.ok) {
  pass("Malformed token correctly returns Err", malformed.error.code);
}

// ─── 4. verifyToken — HMAC ───────────────────────────────────────────────────

section("4. verifyToken — HMAC (HS256)");

const verifyHmacOpts: VerifyOptions = {
  token: hmacToken,
  secret: HMAC_SECRET,
  alg: "HS256",
  requiredClaims: ["sub", "iss", "exp"],
};

const verifyHmacResult = await verifyToken(verifyHmacOpts);

if (!verifyHmacResult.ok) {
  fail("verifyToken (HS256) failed", verifyHmacResult.error);
} else {
  pass("HS256 token verified — sub", verifyHmacResult.value.payload["sub"]);
}

// Wrong secret → should fail
const wrongSecretResult = await verifyToken({
  token: hmacToken,
  secret: "wrong-secret",
  alg: "HS256",
});
if (!wrongSecretResult.ok) {
  pass("Wrong secret correctly returns Err", wrongSecretResult.error.reason);
}

// ─── 5. generateKeyPair ──────────────────────────────────────────────────────

section("5. generateKeyPair");

// EC P-256 key pair in JWK format
const ecKeygenOpts: KeygenOptions = {
  type: "ec",
  format: "jwk",
  kid: "demo-ec-key-2026",
};

const ecKeyResult = await generateKeyPair(ecKeygenOpts);

if (!ecKeyResult.ok) {
  fail("generateKeyPair (EC) failed", ecKeyResult.error);
  process.exit(1);
}

const privateJwk = JSON.parse(ecKeyResult.value.privateKey) as Record<string, unknown>;
const publicJwk  = JSON.parse(ecKeyResult.value.publicKey)  as Record<string, unknown>;

pass("EC P-256 private key (JWK) — kty",  privateJwk["kty"]);
pass("EC P-256 public  key (JWK) — kid",  publicJwk["kid"]);

// RSA 2048 key pair in PEM format
const rsaKeygenOpts: KeygenOptions = {
  type: "rsa",
  format: "pem",
  rsaBits: 2048,
};

const rsaKeyResult = await generateKeyPair(rsaKeygenOpts);

if (!rsaKeyResult.ok) {
  fail("generateKeyPair (RSA) failed", rsaKeyResult.error);
} else {
  const pemPreview = rsaKeyResult.value.privateKey.split("\n")[0];
  pass("RSA 2048 private key (PEM)", pemPreview);
}

// Ed25519 key pair
const edKeyResult = await generateKeyPair({ type: "ed25519", format: "jwk" });
if (!edKeyResult.ok) {
  fail("generateKeyPair (Ed25519) failed", edKeyResult.error);
} else {
  const edJwk = JSON.parse(edKeyResult.value.privateKey) as Record<string, unknown>;
  pass("Ed25519 private key (JWK) — crv", edJwk["crv"]);
}

// ─── 6. encodeToken + verifyToken — Asymmetric (ES256) ───────────────────────

section("6. encodeToken + verifyToken — Asymmetric (ES256)");

const ecEncodeOpts: EncodeOptions = {
  payload: {
    sub: "svc_worker",
    iss: "https://auth.example.com",
    aud: "internal-api",
    iat: now,
    exp: now + 900, // 15 min
  },
  privateKeyJwk: privateJwk,
  alg: "ES256",
  kid: ecKeyResult.value.kid,
};

const ecTokenResult = await encodeToken(ecEncodeOpts);

if (!ecTokenResult.ok) {
  fail("encodeToken (ES256) failed", ecTokenResult.error);
  process.exit(1);
}

const ecToken = ecTokenResult.value;
pass("Encoded ES256 JWT", `${ecToken.slice(0, 36)}…`);

const verifyEcOpts: VerifyOptions = {
  token: ecToken,
  publicKeyJwk: publicJwk,
  alg: "ES256",
};

const verifyEcResult = await verifyToken(verifyEcOpts);

if (!verifyEcResult.ok) {
  fail("verifyToken (ES256) failed", verifyEcResult.error);
} else {
  pass("ES256 token verified — iss", verifyEcResult.value.payload["iss"]);
}

// ─── 7. lintToken ────────────────────────────────────────────────────────────

section("7. lintToken — security audit");

// Token with PII and no nbf — should produce findings
const piiPayload: EncodeOptions = {
  payload: {
    sub: "user_1",
    email: "user@example.com",   // PII
    phone: "+1-555-0100",        // PII
    iat: now,
    exp: now + 172800,           // 48h → long-lived
  },
  secret: HMAC_SECRET,
  alg: "HS256",
};

const piiTokenResult = await encodeToken(piiPayload);
if (!piiTokenResult.ok) {
  fail("Failed to create PII token for linting", piiTokenResult.error);
} else {
  const decodedPii = decodeToken(piiTokenResult.value);

  if (!decodedPii.ok) {
    fail("Failed to decode PII token", decodedPii.error);
  } else {
    const lintConfig: LintConfig = {
      piiClaimPatterns: ["email", "phone"],
      severityOverrides: { "missing-exp": "error" }, // escalate missing-exp to error
    };

    const findings: LintFinding[] = lintToken(decodedPii.value, lintConfig);

    if (findings.length === 0) {
      fail("Expected lint findings but got none");
    } else {
      pass(`Found ${findings.length} lint finding(s):`);
      for (const f of findings) {
        const icon = f.severity === "error" ? "🔴" : f.severity === "warn" ? "🟡" : "🔵";
        console.log(`       ${icon} [${f.severity}] ${f.ruleId}`);
        console.log(`          ${f.description}`);
        console.log(`          → ${f.suggestedFix}`);
      }
    }
  }
}

// Clean token — use ES256 (asymmetric) so no HMAC info-rule fires.
// Demonstrates using an already-generated key from section 5.
const cleanOpts: EncodeOptions = {
  payload: {
    sub: "svc",
    iss: "https://auth.example.com",
    iat: now,
    exp: now + 900,
  },
  privateKeyJwk: privateJwk,
  alg: "ES256",
};

const cleanTokenResult = await encodeToken(cleanOpts);
if (cleanTokenResult.ok) {
  const cleanDecoded = decodeToken(cleanTokenResult.value);
  if (cleanDecoded.ok) {
    const cleanFindings = lintToken(cleanDecoded.value, {});
    // Filter to error/warn only — info-level hints are informational, not failures
    const actionable = cleanFindings.filter((f) => f.severity !== "info");
    if (actionable.length === 0) {
      pass(`Clean ES256 token: 0 error/warn findings (${cleanFindings.length} info notes)`);
    } else {
      fail("Clean token has error/warn findings", actionable.map((f) => f.ruleId));
    }
  }
}

// ─── 8. Full end-to-end flow ─────────────────────────────────────────────────

section("8. Full end-to-end flow: generate → encode → verify → lint");

const e2eKeyResult = await generateKeyPair({ type: "ec", format: "jwk", kid: "e2e-key" });
if (!e2eKeyResult.ok) { fail("e2e keygen failed", e2eKeyResult.error); process.exit(1); }
const e2eKeys = e2eKeyResult.value;
const e2ePriv = JSON.parse(e2eKeys.privateKey) as Record<string, unknown>;
const e2ePub  = JSON.parse(e2eKeys.publicKey)  as Record<string, unknown>;

const exp1h = parseDuration("1h");
if (!exp1h.ok) { fail("parseDuration failed"); process.exit(1); }

const e2eEncode = await encodeToken({
  payload: { sub: "app_service", iss: "https://auth.myapp.com", iat: now, exp: now + exp1h.value },
  privateKeyJwk: e2ePriv,
  alg: "ES256",
  kid: e2eKeys.kid,
});
if (!e2eEncode.ok) { fail("e2e encode failed", e2eEncode.error); process.exit(1); }

const e2eVerify = await verifyToken({ token: e2eEncode.value, publicKeyJwk: e2ePub, alg: "ES256" });
if (!e2eVerify.ok) { fail("e2e verify failed", e2eVerify.error); process.exit(1); }

const e2eDecoded = decodeToken(e2eEncode.value);
if (!e2eDecoded.ok) { fail("e2e decode failed"); process.exit(1); }

const e2eFindings = lintToken(e2eDecoded.value, {});

pass("generate (EC P-256 JWK)       ✓");
pass("encode   (ES256)               ✓");
pass("verify   (public JWK)          ✓  sub=" + String(e2eVerify.value.payload["sub"]));
pass(`lint     (${e2eFindings.length} findings)               ${e2eFindings.length === 0 ? "✓  clean" : "⚠  see above"}`);

// ─── 9. inspectToken — high-level one-call API ──────────────────────────────

section("9. inspectToken — high-level one-call API");

// inspectToken = decode + verify + lint in a single call
const inspectResult = await inspectToken({
  token: e2eEncode.value,
  publicKeyJwk: e2ePub,
  alg: "ES256",
});

if (!inspectResult.ok) {
  fail("inspectToken failed", inspectResult.error);
} else {
  const ir: InspectResult = inspectResult.value;
  pass("status",         ir.status);
  pass("algorithm",      ir.algorithm);
  if (ir.issuer !== undefined)     pass("issuer",  ir.issuer);
  if (ir.subject !== undefined)    pass("subject", ir.subject);
  if (ir.expiresAt !== undefined)  pass("expiresAt", ir.expiresAt.toISOString());
  pass("lint findings",  `${ir.lintFindings.length} finding(s)`);
  pass("verified?",      ir.verificationResult?.ok === true ? "yes" : "no");
}

// inspectToken without key material — decode + lint only, status = "unverified"
const inspectNoKey = await inspectToken({ token: e2eEncode.value });
if (!inspectNoKey.ok) {
  fail("inspectToken (no key) failed", inspectNoKey.error);
} else {
  pass("inspectToken (no key) status", inspectNoKey.value.status);
  if (inspectNoKey.value.status === "unverified") {
    pass("Correctly returns 'unverified' when no key provided");
  } else {
    fail("Expected 'unverified' status", inspectNoKey.value.status);
  }
}

// ─── 10. parseNaturalLanguagePayload ────────────────────────────────────────

section("10. parseNaturalLanguagePayload — NLP encoding");

const nlpNow = new Date();

const nlpCases: [string, string[]][] = [
  ["admin token for user ali@example.com expires in 1h", ["role", "email", "exp"]],
  ["admin user bob@test.com", ["role", "email"]],
  ["service account with admin role", ["role"]],
];

for (const [input, expectedKeys] of nlpCases) {
  const nlpResult = parseNaturalLanguagePayload(input, nlpNow);
  if (!nlpResult.ok) {
    fail(`NLP("${input}") failed`, nlpResult.error.message);
  } else {
    const keys = Object.keys(nlpResult.value);
    const hasAll = expectedKeys.every((k) => keys.includes(k));
    if (hasAll) {
      pass(`NLP("${input.slice(0, 40)}…")`, keys.join(", "));
    } else {
      fail(`NLP missing expected keys`, { expected: expectedKeys, got: keys });
    }
  }
}

// Full encode from NLP → sign → verify round-trip
const nlpPayload = parseNaturalLanguagePayload(
  "admin token for user alice@corp.com expires in 30m",
  nlpNow,
);
if (nlpPayload.ok) {
  const nlpEncoded = await encodeToken({
    payload: nlpPayload.value,
    secret: HMAC_SECRET,
    alg: "HS256",
  });
  if (nlpEncoded.ok) {
    const nlpVerified = await verifyToken({
      token: nlpEncoded.value,
      secret: HMAC_SECRET,
      alg: "HS256",
    });
    if (nlpVerified.ok) {
      pass("NLP → encode → verify round-trip ✓");
    } else {
      fail("NLP round-trip verify failed", nlpVerified.error);
    }
  } else {
    fail("NLP round-trip encode failed", nlpEncoded.error);
  }
}

// ─── 11. verifyToken auto-detects algorithm ─────────────────────────────────

section("11. verifyToken — algorithm auto-detection");

// Generate an EC key pair, sign a token, then verify WITHOUT specifying alg
const autoDetectKey = await generateKeyPair({ type: "ec", format: "pem" });
if (!autoDetectKey.ok) { fail("keygen (EC PEM) failed", autoDetectKey.error); }
else {
  const autoToken = await encodeToken({
    payload: { sub: "auto-detect-test", iat: now, exp: now + 300 },
    privateKeyPem: autoDetectKey.value.privateKey,
    alg: "ES256",
  });
  if (!autoToken.ok) { fail("encode failed", autoToken.error); }
  else {
    // Verify WITHOUT explicitly passing alg — should auto-detect from header
    const autoVerify = await verifyToken({
      token: autoToken.value,
      publicKeyPem: autoDetectKey.value.publicKey,
      // alg deliberately omitted
    });
    if (autoVerify.ok) {
      pass("ES256 token verified without explicit alg ✓");
    } else {
      fail("Auto-detect verify failed (should have detected ES256)", autoVerify.error);
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(56)}`);
if (process.exitCode !== 1) {
  console.log("  All examples ran successfully.");
} else {
  console.log("  One or more examples FAILED — see ❌ above.");
}
console.log("═".repeat(56) + "\n");
