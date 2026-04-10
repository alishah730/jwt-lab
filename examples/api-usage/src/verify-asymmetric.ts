/**
 * Asymmetric Key Verification Examples
 *
 * Demonstrates generating key pairs (EC, RSA, Ed25519), encoding tokens with
 * private keys, and verifying them with public keys — all via the jwt-lab API.
 *
 * Shows that `verifyToken` auto-detects the algorithm from the token header,
 * so you don't need to pass `alg` explicitly.
 *
 * Run:  npm run verify-asymmetric
 */
import {
  encodeToken,
  verifyToken,
  generateKeyPair,
  inspectToken,
  type SupportedAlgorithm,
} from "jwt-lab";

const now = Math.floor(Date.now() / 1000);

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

// ─── Helper: round-trip sign + verify for a given algorithm ──────────────────

async function roundTrip(opts: {
  name: string;
  keyType: "ec" | "rsa" | "ed25519";
  alg: SupportedAlgorithm;
  format: "pem" | "jwk";
}) {
  section(`${opts.name} — ${opts.alg} (${opts.format.toUpperCase()})`);

  // 1. Generate key pair
  const keys = await generateKeyPair({
    type: opts.keyType,
    format: opts.format,
    kid: `${opts.name}-key`,
  });
  if (!keys.ok) {
    console.error(`  ❌  keygen failed: ${keys.error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ✅  Generated ${opts.keyType.toUpperCase()} key pair (${opts.format})`);

  // 2. Encode token with private key
  const privateKey =
    opts.format === "jwk"
      ? { privateKeyJwk: JSON.parse(keys.value.privateKey) as Record<string, unknown> }
      : { privateKeyPem: keys.value.privateKey };

  const token = await encodeToken({
    payload: {
      sub: `${opts.name}-subject`,
      iss: "https://auth.example.com",
      aud: "api.example.com",
      iat: now,
      exp: now + 3600,
    },
    alg: opts.alg,
    kid: keys.value.kid,
    ...privateKey,
  });

  if (!token.ok) {
    console.error(`  ❌  encode failed: ${token.error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ✅  Encoded token: ${token.value.slice(0, 40)}…`);

  // 3. Verify WITH explicit alg
  const publicKey =
    opts.format === "jwk"
      ? { publicKeyJwk: JSON.parse(keys.value.publicKey) as Record<string, unknown> }
      : { publicKeyPem: keys.value.publicKey };

  const verified = await verifyToken({
    token: token.value,
    alg: opts.alg,
    ...publicKey,
  });
  if (verified.ok) {
    console.log(`  ✅  Verified with explicit alg=${opts.alg}`);
  } else {
    console.error(`  ❌  Verify failed: ${verified.error.message}`);
    process.exitCode = 1;
  }

  // 4. Verify WITHOUT alg — auto-detection from token header
  const autoVerify = await verifyToken({
    token: token.value,
    ...publicKey,
    // alg deliberately omitted
  });
  if (autoVerify.ok) {
    console.log(`  ✅  Verified with auto-detected alg (no explicit alg passed)`);
  } else {
    console.error(`  ❌  Auto-detect verify failed: ${autoVerify.error.message}`);
    process.exitCode = 1;
  }

  // 5. inspectToken — one-call equivalent
  const inspected = await inspectToken({
    token: token.value,
    ...publicKey,
  });
  if (inspected.ok && inspected.value.status === "valid") {
    console.log(`  ✅  inspectToken status: ${inspected.value.status}`);
  } else if (inspected.ok) {
    console.error(`  ❌  inspectToken status: ${inspected.value.status} (expected "valid")`);
    process.exitCode = 1;
  } else {
    console.error(`  ❌  inspectToken failed: ${inspected.error.message}`);
    process.exitCode = 1;
  }
}

// ─── Run all algorithm variants ──────────────────────────────────────────────

await roundTrip({ name: "ec-jwk",     keyType: "ec",      alg: "ES256", format: "jwk" });
await roundTrip({ name: "ec-pem",     keyType: "ec",      alg: "ES256", format: "pem" });
await roundTrip({ name: "rsa-jwk",    keyType: "rsa",     alg: "RS256", format: "jwk" });
await roundTrip({ name: "rsa-pem",    keyType: "rsa",     alg: "RS256", format: "pem" });
await roundTrip({ name: "ed25519-jwk", keyType: "ed25519", alg: "EdDSA", format: "jwk" });

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
if (process.exitCode !== 1) {
  console.log("  All asymmetric verification examples passed.");
} else {
  console.log("  Some examples FAILED — see ❌ above.");
}
console.log("═".repeat(60) + "\n");
