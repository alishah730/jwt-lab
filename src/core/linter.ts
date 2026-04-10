/**
 * JWT security linter — pure function, no I/O, no side effects.
 */

import {
  type DecodedToken,
  type LintConfig,
  type LintFinding,
  type LintRule,
  type Severity,
} from "./types.js";

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 2,
  warn: 1,
  info: 0,
};

const HMAC_ALGORITHMS = new Set(["HS256", "HS384", "HS512"]);

const DEFAULT_PII_PATTERNS = [
  "email",
  "phone",
  "ssn",
  "address",
  "name",
  "dob",
  "birthdate",
];

/** Fires when the `exp` claim is absent from the payload. */
const missingExpRule: LintRule = {
  id: "missing-exp",
  severity: "warn",
  check(token) {
    if (token.payload["exp"] === undefined) {
      return {
        ruleId: "missing-exp",
        severity: "warn",
        description: "Token has no expiration claim (`exp`).",
        suggestedFix:
          "Add an `exp` claim to limit the token's lifetime and reduce the risk of token replay attacks.",
      };
    }
    return null;
  },
};

/** Fires when the token lifetime exceeds 24 hours (`exp - iat > 86400`). */
const longLivedTokenRule: LintRule = {
  id: "long-lived-token",
  severity: "warn",
  check(token) {
    const exp = token.payload["exp"];
    const iat = token.payload["iat"];
    if (typeof exp === "number" && typeof iat === "number" && exp - iat > 86400) {
      return {
        ruleId: "long-lived-token",
        severity: "warn",
        description: `Token lifetime is ${exp - iat}s, which exceeds 24 hours.`,
        suggestedFix:
          "Reduce the token lifetime to 24 hours or less, and use refresh tokens for long-lived sessions.",
      };
    }
    return null;
  },
};

/** Fires when the token lifetime exceeds 1 hour and `nbf` is absent. */
const missingNbfLongLivedRule: LintRule = {
  id: "missing-nbf-long-lived",
  severity: "info",
  check(token) {
    const exp = token.payload["exp"];
    const iat = token.payload["iat"];
    if (
      typeof exp === "number" &&
      typeof iat === "number" &&
      exp - iat > 3600 &&
      token.payload["nbf"] === undefined
    ) {
      return {
        ruleId: "missing-nbf-long-lived",
        severity: "info",
        description:
          "Long-lived token is missing a `nbf` (not-before) claim.",
        suggestedFix:
          "Add an `nbf` claim to prevent the token from being used before it is intended to be valid.",
      };
    }
    return null;
  },
};

/** Fires when the algorithm is `none`. */
const noneAlgorithmRule: LintRule = {
  id: "none-algorithm",
  severity: "error",
  check(token) {
    if (token.header["alg"] === "none") {
      return {
        ruleId: "none-algorithm",
        severity: "error",
        description: 'Token uses the "none" algorithm, which provides no signature security.',
        suggestedFix:
          'Replace "none" with a secure algorithm such as RS256 or ES256.',
      };
    }
    return null;
  },
};

/** Fires when an HMAC algorithm (HS256/384/512) is used instead of an asymmetric one. */
const hmacPreferredAsymmetricRule: LintRule = {
  id: "hmac-preferred-asymmetric",
  severity: "info",
  check(token) {
    const alg = token.header["alg"];
    if (typeof alg === "string" && HMAC_ALGORITHMS.has(alg)) {
      return {
        ruleId: "hmac-preferred-asymmetric",
        severity: "info",
        description: `Token uses HMAC algorithm (${alg}). Asymmetric algorithms are preferred for most use cases.`,
        suggestedFix:
          "Consider using an asymmetric algorithm such as RS256 or ES256 so that verifiers do not need access to the signing secret.",
      };
    }
    return null;
  },
};

/** Fires when any payload claim key matches a known PII pattern. */
const piiClaimsRule: LintRule = {
  id: "pii-claims",
  severity: "warn",
  check(token, config) {
    const patterns = config.piiClaimPatterns ?? DEFAULT_PII_PATTERNS;
    const matchedKeys = Object.keys(token.payload).filter((key) =>
      patterns.some((pattern) =>
        key.toLowerCase().includes(pattern.toLowerCase()),
      ),
    );
    if (matchedKeys.length > 0) {
      return {
        ruleId: "pii-claims",
        severity: "warn",
        description: `Payload contains claims that may hold PII: ${matchedKeys.join(", ")}.`,
        suggestedFix:
          "Avoid embedding PII directly in JWT payloads. Store sensitive data server-side and reference it by an opaque identifier.",
      };
    }
    return null;
  },
};

/** All built-in lint rules, exported for testing and extension. */
export const BUILT_IN_RULES: LintRule[] = [
  missingExpRule,
  longLivedTokenRule,
  missingNbfLongLivedRule,
  noneAlgorithmRule,
  hmacPreferredAsymmetricRule,
  piiClaimsRule,
];

/**
 * Runs all enabled lint rules against a decoded token.
 * Returns findings sorted by severity descending (error → warn → info).
 * Pure function — no I/O, no side effects.
 */
export function lintToken(token: DecodedToken, config: LintConfig): LintFinding[] {
  const disabled = new Set(config.disabledRules ?? []);

  const findings: LintFinding[] = [];

  for (const rule of BUILT_IN_RULES) {
    if (disabled.has(rule.id)) continue;

    const finding = rule.check(token, config);
    if (finding === null) continue;

    const overriddenSeverity = config.severityOverrides?.[rule.id];
    findings.push(
      overriddenSeverity !== undefined
        ? { ...finding, severity: overriddenSeverity }
        : finding,
    );
  }

  return findings.sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity],
  );
}
