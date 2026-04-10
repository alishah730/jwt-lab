/**
 * Natural Language Encoding
 *
 * Demonstrates jwt-lab's deterministic NLP parser that converts
 * plain English descriptions into JWT payloads — no LLM required.
 *
 * This is the library equivalent of:
 *   jwt encode "admin token for user ali@example.com expires in 1h" --secret s
 *
 * Run:  npm run nlp-encode
 */
import {
  parseNaturalLanguagePayload,
  encodeToken,
  decodeToken,
  type NlpError,
} from "jwt-lab";

const SECRET = "demo-secret";
const now = new Date();

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

// ─── Showcase NLP payload parsing ────────────────────────────────────────────

section("Natural Language → JWT Payload");

const descriptions = [
  "admin token for user ali@example.com expires in 1h",
  "readonly user bob@test.com expires in 30m",
  "service account with admin role for api.internal",
  "user token expires in 7d",
  "admin for alice@corp.com expires in 15m",
];

for (const desc of descriptions) {
  console.log(`\n  Input:   "${desc}"`);
  const result = parseNaturalLanguagePayload(desc, now);
  if (result.ok) {
    console.log(`  Payload: ${JSON.stringify(result.value, null, 2).split("\n").join("\n           ")}`);
  } else {
    const e: NlpError = result.error;
    console.error(`  ❌ Parse error: ${e.message}`);
  }
}

// ─── Full round-trip: NLP → encode → decode ──────────────────────────────────

section("NLP → Encode → Decode Round-Trip");

const input = "admin token for user alice@corp.com expires in 2h";
console.log(`\n  Input: "${input}"\n`);

const payload = parseNaturalLanguagePayload(input, now);
if (!payload.ok) {
  console.error(`  ❌ NLP parse failed: ${payload.error.message}`);
  process.exit(1);
}

console.log("  1. Parsed payload:");
for (const [k, v] of Object.entries(payload.value)) {
  console.log(`     ${k}: ${JSON.stringify(v)}`);
}

const token = await encodeToken({
  payload: payload.value,
  secret: SECRET,
  alg: "HS256",
});

if (!token.ok) {
  console.error(`  ❌ Encode failed: ${token.error.message}`);
  process.exit(1);
}
console.log(`\n  2. Encoded JWT: ${token.value.slice(0, 50)}…`);

const decoded = decodeToken(token.value);
if (!decoded.ok) {
  console.error(`  ❌ Decode failed: ${decoded.error.message}`);
  process.exit(1);
}

console.log("\n  3. Decoded payload:");
for (const [k, v] of Object.entries(decoded.value.payload)) {
  const display = k === "exp" || k === "iat"
    ? `${v} (${new Date((v as number) * 1000).toISOString()})`
    : JSON.stringify(v);
  console.log(`     ${k}: ${display}`);
}

console.log(`\n  ✅  Round-trip complete\n`);
