/**
 * Pure formatting functions for JWT CLI output.
 * No side effects — all functions return strings only.
 *
 * Design: Material-inspired clean layout with thin dividers,
 * human-readable dates, and subtle color accents.
 */

import pc from "picocolors";
import type { DecodedToken, LintFinding, InspectResult } from "../core/types.js";
import type { GeneratedKeyPair, KeyFormat } from "../core/keygen.js";

/** Options controlling output format. */
export interface FormatOptions {
  /** Output raw JSON instead of pretty-printed colored text. */
  json?: boolean;
  /** Whether to include ANSI color codes (default: true). */
  color?: boolean;
}

/** Result of a JWT verification attempt. */
export interface VerifyResult {
  /** Whether the token passed verification. */
  valid: boolean;
  /** The decoded token. */
  token: DecodedToken;
  /** Error details when verification failed. */
  error?: { reason: string; message: string };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DIM_LINE = pc.dim("─".repeat(48));

/** Colorizes any JSON value recursively with styled keys and values. */
function colorizeValue(value: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  if (typeof value === "string") {
    return pc.green(`"${value}"`);
  } else if (typeof value === "number") {
    return pc.yellow(String(value));
  } else if (typeof value === "boolean") {
    return pc.magenta(String(value));
  } else if (value === null) {
    return pc.dim("null");
  } else if (Array.isArray(value)) {
    if (value.length === 0) return pc.dim("[]");
    // For short primitive arrays, inline them
    const allPrimitive = value.every(
      (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
    );
    if (allPrimitive && value.length <= 4) {
      const items = value.map((v) => colorizeValue(v, 0));
      return `[${items.join(pc.dim(", "))}]`;
    }
    // Multi-line array
    const innerPad = " ".repeat(indent + 2);
    const items = value.map((v, i) => {
      const comma = i < value.length - 1 ? pc.dim(",") : "";
      return `${innerPad}${colorizeValue(v, indent + 2)}${comma}`;
    });
    return `[\n${items.join("\n")}\n${pad}]`;
  } else if (typeof value === "object") {
    return colorizeJson(value as Record<string, unknown>, indent, true);
  }
  return pc.dim(String(value));
}

/** Colorizes a JSON object with styled keys and values, with full recursive support. */
function colorizeJson(obj: Record<string, unknown>, indent = 2, inline = false): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return `${pc.dim("{}")}`;

  const pad = " ".repeat(indent);
  const innerPad = " ".repeat(indent + 2);
  const lines: string[] = [];
  // When inline, skip the pad on the opening brace (it follows a key on the same line)
  lines.push(inline ? pc.dim("{") : `${pad}${pc.dim("{")}`);

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    const comma = i < entries.length - 1 ? pc.dim(",") : "";
    const coloredValue = colorizeValue(value, indent + 2);
    lines.push(`${innerPad}${pc.cyan(`"${key}"`)}: ${coloredValue}${comma}`);
  }

  lines.push(`${pad}${pc.dim("}")}`);
  return lines.join("\n");
}

/** Known JWT timestamp claim names. */
const TIMESTAMP_CLAIMS = new Set(["exp", "iat", "nbf", "auth_time", "updated_at"]);

/** Human-readable labels for timestamp claims. */
const TIMESTAMP_LABELS: Record<string, string> = {
  exp: "Expires",
  iat: "Issued",
  nbf: "Not Before",
  auth_time: "Auth Time",
  updated_at: "Updated",
};

/**
 * Formats a Unix timestamp as a human-readable date string.
 * e.g. 1743601262 → "Apr 2, 2025 · 2:41:02 PM UTC"
 */
function formatTimestamp(epoch: number): string {
  const d = new Date(epoch * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + " · " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

/**
 * Computes a relative time description for a timestamp relative to now.
 * e.g. "in 2h 15m" or "3d 4h ago"
 */
function relativeTime(epoch: number): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const diff = epoch - nowSec;
  const abs = Math.abs(diff);

  if (abs < 60) return diff >= 0 ? "just now" : "just now";
  const parts: string[] = [];
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 && d === 0) parts.push(`${m}m`); // skip minutes if days shown

  const timeStr = parts.join(" ");
  return diff >= 0 ? `in ${timeStr}` : `${timeStr} ago`;
}

/** Section header with icon. */
function sectionHeader(icon: string, title: string): string {
  return `  ${icon}  ${pc.bold(title)}`;
}

const SEVERITY_PREFIX: Record<LintFinding["severity"], string> = {
  error: "✕",
  warn: "▲",
  info: "●",
};

const SEVERITY_COLOR: Record<LintFinding["severity"], (s: string) => string> = {
  error: pc.red,
  warn: pc.yellow,
  info: pc.cyan,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pretty-prints a decoded JWT token with a modern material-inspired layout.
 * Includes human-readable dates for timestamp claims.
 */
export function formatDecodedToken(decoded: DecodedToken, opts?: FormatOptions): string {
  if (opts?.json) {
    return JSON.stringify(decoded, null, 2);
  }

  const lines: string[] = [];

  // Title
  lines.push("");
  lines.push(sectionHeader("🔑", pc.cyan("JWT Decoded")));
  lines.push(`  ${DIM_LINE}`);

  // Header
  lines.push("");
  lines.push(`  ${pc.dim("HEADER")}  ${pc.dim(`alg: ${decoded.header["alg"] ?? "?"}`)}  ${pc.dim(`typ: ${decoded.header["typ"] ?? "?"}`)}`);
  lines.push(colorizeJson(decoded.header, 2));

  // Payload
  lines.push("");
  lines.push(`  ${pc.dim("PAYLOAD")}`);
  lines.push(colorizeJson(decoded.payload, 2));

  // Timestamp annotations — human-readable dates below payload
  const timestamps = Object.entries(decoded.payload).filter(
    ([key, val]) => TIMESTAMP_CLAIMS.has(key) && typeof val === "number"
  );

  if (timestamps.length > 0) {
    lines.push("");
    lines.push(`  ${pc.dim("TIMESTAMPS")}`);
    for (const [key, val] of timestamps) {
      const epoch = val as number;
      const label = TIMESTAMP_LABELS[key] ?? key;
      const human = formatTimestamp(epoch);
      const rel = relativeTime(epoch);

      // Color the relative time based on whether it's expired
      const isExpiry = key === "exp";
      const relColored = isExpiry
        ? (epoch < Date.now() / 1000 ? pc.red(rel) : pc.green(rel))
        : pc.dim(rel);

      lines.push(`  ${pc.dim("│")} ${pc.bold(label.padEnd(12))} ${human}  ${relColored}`);
    }
  }

  // Signature
  lines.push("");
  const sigIcon = decoded.signaturePresent ? pc.green("●") : pc.yellow("○");
  const sigText = decoded.signaturePresent
    ? pc.green("present")
    : pc.yellow("absent");
  lines.push(`  ${sigIcon} ${pc.dim("Signature")} ${sigText}`);

  lines.push(`  ${DIM_LINE}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Formats lint findings as a clean, scannable list.
 */
export function formatLintFindings(findings: LintFinding[]): string {
  if (findings.length === 0) {
    return `  ${pc.green("●")} ${pc.green("No lint findings")}`;
  }

  return findings
    .map((f) => {
      const icon = SEVERITY_COLOR[f.severity](SEVERITY_PREFIX[f.severity]);
      const rule = pc.dim(`${f.ruleId}`);
      const desc = SEVERITY_COLOR[f.severity](f.description);
      const fix = pc.dim(`  ↳ ${f.suggestedFix}`);
      return `  ${icon} ${rule} ${desc}\n${fix}`;
    })
    .join("\n");
}

/**
 * Formats a verify result with clean status indicators.
 */
export function formatVerifyResult(result: VerifyResult): string {
  const lines: string[] = [""];

  if (result.valid) {
    lines.push(sectionHeader(pc.green("✓"), pc.green("Valid JWT")));
    lines.push(`  ${DIM_LINE}`);
    const alg = result.token.header["alg"];
    const sub = result.token.payload["sub"];
    if (alg !== undefined) lines.push(`  ${pc.dim("Algorithm")}  ${pc.cyan(String(alg))}`);
    if (sub !== undefined) lines.push(`  ${pc.dim("Subject  ")}  ${pc.cyan(String(sub))}`);
  } else {
    lines.push(sectionHeader(pc.red("✕"), pc.red("Invalid JWT")));
    lines.push(`  ${DIM_LINE}`);
    if (result.error) {
      lines.push(`  ${pc.dim("Reason ")}  ${pc.yellow(result.error.reason)}`);
      lines.push(`  ${pc.dim("Detail ")}  ${result.error.message}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Formats a generated key pair with a clean layout.
 */
export function formatKeyPair(pair: GeneratedKeyPair, format: KeyFormat): string {
  const lines: string[] = [""];

  lines.push(sectionHeader("🗝️ ", `Key Pair Generated  ${pc.dim(`(${format.toUpperCase()})`)}`));
  if (pair.kid) {
    lines.push(`  ${pc.dim("kid")}  ${pc.cyan(pair.kid)}`);
  }
  lines.push(`  ${DIM_LINE}`);

  lines.push("");
  lines.push(`  ${pc.bold(pc.yellow("PRIVATE KEY"))}`);
  lines.push(pc.dim(pair.privateKey.split("\n").map((l) => `  ${l}`).join("\n")));

  lines.push("");
  lines.push(`  ${pc.bold(pc.green("PUBLIC KEY"))}`);
  lines.push(pc.dim(pair.publicKey.split("\n").map((l) => `  ${l}`).join("\n")));

  lines.push(`  ${DIM_LINE}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Formats a duration in seconds as a human-readable string.
 * e.g. 3661 → "1h 1m 1s"
 */
export function formatDuration(seconds: number): string {
  const abs = Math.abs(Math.floor(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return (seconds < 0 ? "-" : "") + parts.join(" ");
}

/**
 * Formats an InspectResult with a clean, modern material-style layout.
 */
export function formatInspectResult(result: InspectResult): string {
  const statusColor: Record<InspectResult["status"], (s: string) => string> = {
    valid: pc.green,
    expired: pc.red,
    not_yet_valid: pc.yellow,
    unverified: pc.cyan,
  };

  const statusIcon: Record<InspectResult["status"], string> = {
    valid: pc.green("✓"),
    expired: pc.red("✕"),
    not_yet_valid: pc.yellow("◷"),
    unverified: pc.cyan("?"),
  };

  const colorFn = statusColor[result.status];
  const icon = statusIcon[result.status];

  const lines: string[] = [""];

  // Header
  lines.push(sectionHeader("🔍", pc.cyan("Token Inspection")));
  lines.push(`  ${DIM_LINE}`);

  // Status
  lines.push("");
  lines.push(`  ${icon} ${pc.bold("Status")}  ${colorFn(result.status.replace(/_/g, " "))}`);

  // Metadata
  lines.push("");
  lines.push(`  ${pc.dim("METADATA")}`);
  lines.push(`  ${pc.dim("│")} ${"Algorithm".padEnd(12)} ${pc.cyan(result.algorithm)}`);
  if (result.kid) lines.push(`  ${pc.dim("│")} ${"Key ID".padEnd(12)} ${pc.cyan(result.kid)}`);
  if (result.issuer) lines.push(`  ${pc.dim("│")} ${"Issuer".padEnd(12)} ${result.issuer}`);
  if (result.subject) lines.push(`  ${pc.dim("│")} ${"Subject".padEnd(12)} ${result.subject}`);
  if (result.audience) {
    const aud = Array.isArray(result.audience) ? result.audience.join(", ") : result.audience;
    lines.push(`  ${pc.dim("│")} ${"Audience".padEnd(12)} ${aud}`);
  }

  // Timestamps with human-readable format
  const hasTimestamps = result.issuedAt || result.expiresAt || result.notBefore;
  if (hasTimestamps) {
    lines.push("");
    lines.push(`  ${pc.dim("TIMESTAMPS")}`);
    if (result.issuedAt) {
      const epoch = Math.floor(result.issuedAt.getTime() / 1000);
      lines.push(`  ${pc.dim("│")} ${"Issued".padEnd(12)} ${formatTimestamp(epoch)}  ${pc.dim(relativeTime(epoch))}`);
    }
    if (result.expiresAt) {
      const epoch = Math.floor(result.expiresAt.getTime() / 1000);
      const rel = relativeTime(epoch);
      const relColored = epoch < Date.now() / 1000 ? pc.red(rel) : pc.green(rel);
      lines.push(`  ${pc.dim("│")} ${"Expires".padEnd(12)} ${formatTimestamp(epoch)}  ${relColored}`);
    }
    if (result.notBefore) {
      const epoch = Math.floor(result.notBefore.getTime() / 1000);
      lines.push(`  ${pc.dim("│")} ${"Not Before".padEnd(12)} ${formatTimestamp(epoch)}  ${pc.dim(relativeTime(epoch))}`);
    }
    if (result.timeUntilExpiry !== undefined) {
      const label = result.timeUntilExpiry >= 0 ? "TTL" : "Expired";
      const val = formatDuration(result.timeUntilExpiry);
      const colored = result.timeUntilExpiry >= 0 ? pc.green(val) : pc.red(val);
      lines.push(`  ${pc.dim("│")} ${label.padEnd(12)} ${colored}`);
    }
  }

  // Custom claims
  const customKeys = Object.keys(result.customClaims);
  if (customKeys.length > 0) {
    lines.push("");
    lines.push(`  ${pc.dim("CLAIMS")}`);
    for (const key of customKeys) {
      const val = result.customClaims[key];
      const formatted = typeof val === "string" ? pc.green(`"${val}"`) : pc.yellow(JSON.stringify(val));
      lines.push(`  ${pc.dim("│")} ${key.padEnd(12)} ${formatted}`);
    }
  }

  // Lint findings
  if (result.lintFindings.length > 0) {
    lines.push("");
    lines.push(`  ${pc.dim("LINT")}`);
    lines.push(formatLintFindings(result.lintFindings));
  }

  lines.push(`  ${DIM_LINE}`);
  lines.push("");

  return lines.join("\n");
}
