/**
 * OIDC Token Inspector — using the high-level `inspectToken` API
 *
 * This example demonstrates how the library's `inspectToken` function provides
 * the same functionality as the CLI commands `jwt inspect` and `jwt verify`
 * in a single function call:
 *
 *   CLI:   jwt verify "eyJ..." --oidc-discovery "https://accounts.google.com"
 *   Code:  inspectToken({ token: "eyJ...", oidcDiscoveryUrl: "https://accounts.google.com" })
 *
 * The function handles:
 *   1. Decoding the token (structural)
 *   2. Resolving JWKS via OIDC discovery (when oidcDiscoveryUrl is provided)
 *   3. Verifying the signature using the remote public keys
 *   4. Linting the token for security issues
 *   5. Returning a complete InspectResult with status, claims, and findings
 *
 * Usage:
 *   TOKEN="eyJ..." OIDC_URL="https://accounts.google.com" npm run oidc-inspect
 *
 * Or edit the TOKEN / OIDC_URL constants below for quick testing.
 */
import {
  inspectToken,
  type InspectResult,
  type LintFinding,
} from "jwt-lab";

// ─── Configuration ───────────────────────────────────────────────────────────
const TOKEN =
  process.env["TOKEN"] ??
  "eyJhbGciOiJSUzI1NiIsImtpZCI6ImV4YW1wbGUta2V5LWlkIn0.eyJzdWIiOiJ1c2VyXzEyMyIsImlzcyI6Imh0dHBzOi8vYWNjb3VudHMuZXhhbXBsZS5jb20iLCJhdWQiOiJteS1hcHAiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMzYwMH0.SIGNATURE";

const OIDC_URL =
  process.env["OIDC_URL"] ??
  "https://accounts.google.com";

// ─── Output helpers ──────────────────────────────────────────────────────────
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const CYAN   = "\x1b[36m";
const BLUE   = "\x1b[34m";

function bold(s: string)   { return `${BOLD}${s}${RESET}`; }
function dim(s: string)    { return `${DIM}${s}${RESET}`; }
function green(s: string)  { return `${GREEN}${s}${RESET}`; }
function yellow(s: string) { return `${YELLOW}${s}${RESET}`; }
function red(s: string)    { return `${RED}${s}${RESET}`; }
function cyan(s: string)   { return `${CYAN}${s}${RESET}`; }

function hr(char = "─", width = 56) { return char.repeat(width); }

function labelValue(label: string, value: string, pad = 18) {
  return `  ${dim(label.padEnd(pad))}  ${value}`;
}

function severityIcon(sev: "error" | "warn" | "info"): string {
  return sev === "error" ? red("✗") : sev === "warn" ? yellow("⚠") : `${BLUE}ℹ${RESET}`;
}

function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function formatTimeLeft(seconds: number): string {
  if (seconds < 0) return red(`expired ${Math.abs(Math.floor(seconds))}s ago`);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return green(parts.join(" "));
}

// ─── Single function call — same as CLI `jwt inspect --oidc-discovery` ───────

console.log(`\n${hr("═")}`);
console.log(bold("  OIDC Token Inspector  (using inspectToken API)"));
console.log(hr("═"));

const preview = TOKEN.length > 60
  ? `${TOKEN.slice(0, 30)}${dim("…")}${TOKEN.slice(-10)}`
  : TOKEN;
console.log(`\n${bold("Token")}  ${dim(preview)}`);
console.log(`${bold("OIDC")}   ${dim(OIDC_URL)}\n`);

// ── This ONE call does: decode → OIDC discovery → JWKS fetch → verify → lint
const result = await inspectToken({
  token: TOKEN,
  oidcDiscoveryUrl: OIDC_URL,
});

if (!result.ok) {
  // Hard failure — couldn't decode or couldn't reach OIDC endpoint
  console.error(red(`  ✗ ${result.error.code}: ${result.error.message}`));
  process.exit(1);
}

const r: InspectResult = result.value;

// ─── Token metadata ──────────────────────────────────────────────────────────

console.log(bold("Token Metadata"));
console.log(hr());
console.log(labelValue("status",     r.status === "valid" ? green("✔ VALID") :
                                     r.status === "expired" ? red("EXPIRED") :
                                     r.status === "not_yet_valid" ? yellow("NOT YET VALID") :
                                     yellow("UNVERIFIED")));
console.log(labelValue("algorithm",  cyan(r.algorithm)));
if (r.kid !== undefined)        console.log(labelValue("kid",         r.kid));
if (r.issuer !== undefined)     console.log(labelValue("issuer",      r.issuer));
if (r.subject !== undefined)    console.log(labelValue("subject",     r.subject));
if (r.audience !== undefined)   console.log(labelValue("audience",    Array.isArray(r.audience) ? r.audience.join(", ") : r.audience));
if (r.issuedAt !== undefined)   console.log(labelValue("issued at",   formatDate(r.issuedAt)));
if (r.expiresAt !== undefined)  console.log(labelValue("expires at",  formatDate(r.expiresAt)));
if (r.notBefore !== undefined)  console.log(labelValue("not before",  formatDate(r.notBefore)));
if (r.timeUntilExpiry !== undefined) console.log(labelValue("time left",   formatTimeLeft(r.timeUntilExpiry)));

// Custom claims
const customKeys = Object.keys(r.customClaims);
if (customKeys.length > 0) {
  console.log(`\n  ${dim("Custom claims:")}`);
  for (const [k, v] of Object.entries(r.customClaims)) {
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    console.log(labelValue(`  ${k}`, val.length > 60 ? val.slice(0, 57) + "..." : val));
  }
}

// ─── Verification result ─────────────────────────────────────────────────────

console.log(`\n${bold("Signature Verification")}`);
console.log(hr());
if (r.verificationResult === undefined) {
  console.log(yellow("  ⚠ No key material provided — signature not checked"));
} else if (r.verificationResult.ok) {
  console.log(green("  ✔ Signature verified against remote JWKS"));
} else {
  const e = r.verificationResult.error;
  console.log(red(`  ✗ ${e.reason.replace(/_/g, " ").toUpperCase()}`));
  console.log(dim(`    ${e.message}`));
}

// ─── Lint findings ───────────────────────────────────────────────────────────

console.log(`\n${bold("Security Audit")}`);
console.log(hr());

const findings: LintFinding[] = r.lintFindings;

if (findings.length === 0) {
  console.log(green("  ✔ No security issues found"));
} else {
  const errors = findings.filter((f) => f.severity === "error");
  const warns  = findings.filter((f) => f.severity === "warn");
  const infos  = findings.filter((f) => f.severity === "info");

  const summary = [
    errors.length > 0 ? red(`${errors.length} error(s)`) : null,
    warns.length  > 0 ? yellow(`${warns.length} warning(s)`) : null,
    infos.length  > 0 ? `${infos.length} info` : null,
  ].filter(Boolean).join("  ");

  console.log(`  ${summary}\n`);

  for (const f of findings) {
    console.log(`  ${severityIcon(f.severity)} ${bold(`[${f.ruleId}]`)}  ${dim(`(${f.severity})`)}`);
    console.log(`     ${f.description}`);
    console.log(`     ${dim("→")} ${dim(f.suggestedFix)}`);
    console.log();
  }
}

// ─── Final summary ───────────────────────────────────────────────────────────

console.log(hr("═"));
console.log(bold("  Summary"));
console.log(hr("═"));

const sigOk         = r.verificationResult?.ok === true;
const isExpired     = r.status === "expired";
const hasLintErrors = findings.some((f) => f.severity === "error");

const overallStatus = !sigOk && r.verificationResult !== undefined
  ? red("  ✗  INVALID")
  : isExpired
  ? yellow("  ⚠  EXPIRED")
  : hasLintErrors
  ? yellow("  ⚠  INSECURE")
  : r.status === "valid"
  ? green("  ✔  VALID")
  : yellow("  ⚠  UNVERIFIED");

console.log(bold(overallStatus));
console.log();
console.log(labelValue("signature",  sigOk ? green("✔ verified") : r.verificationResult ? red("✗ failed") : yellow("⚠ unchecked")));
console.log(labelValue("expiry",     isExpired ? red("expired") : r.expiresAt ? green("valid") : yellow("no exp claim")));
console.log(labelValue("lint",       hasLintErrors ? red(`${findings.filter(f => f.severity==="error").length} error(s)`) :
                                     findings.some(f => f.severity === "warn") ? yellow(`${findings.filter(f => f.severity==="warn").length} warning(s)`) :
                                     green("clean")));
console.log(labelValue("algorithm",  cyan(r.algorithm)));
if (r.issuer !== undefined)  console.log(labelValue("issuer", r.issuer));
if (r.subject !== undefined) console.log(labelValue("subject", r.subject));

console.log(`\n${hr("═")}\n`);

// Exit with non-zero code on failure
if (!sigOk && r.verificationResult !== undefined || isExpired || hasLintErrors) {
  process.exit(1);
}
