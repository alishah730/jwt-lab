/**
 * Shared types and utilities for jwt-cli core module.
 */

// ---------------------------------------------------------------------------
// Result type discriminated union
// ---------------------------------------------------------------------------

/** Represents a successful result containing a value. */
export type Ok<T> = { ok: true; value: T };

/** Represents a failed result containing an error. */
export type Err<E> = { ok: false; error: E };

/** A discriminated union representing either success or failure. */
export type Result<T, E> = Ok<T> | Err<E>;

/** Constructs a successful `Ok` result. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** Constructs a failed `Err` result. */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Supported algorithms
// ---------------------------------------------------------------------------

/** All JWT algorithms supported by jwt-cli. */
export const SUPPORTED_ALGORITHMS = [
  "HS256", "HS384", "HS512",
  "RS256", "RS384", "RS512",
  "ES256", "ES384", "ES512",
  "EdDSA",
  "PS256", "PS384", "PS512",
] as const;

/** A union type of all supported JWT algorithm identifiers. */
export type SupportedAlgorithm = typeof SUPPORTED_ALGORITHMS[number];

// ---------------------------------------------------------------------------
// Exit codes
// ---------------------------------------------------------------------------

/** Standard process exit codes used by the CLI. */
export const EXIT_CODES = {
  /** Command completed successfully. */
  SUCCESS: 0,
  /** User/input error (bad token, missing key, validation failure). */
  USER_ERROR: 1,
  /** Unexpected internal error (unhandled exception, bug). */
  INTERNAL_ERROR: 2,
} as const;

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

/** A decoded JWT with its header, payload, and signature presence flag. */
export interface DecodedToken {
  /** The JWT header claims as a plain object. */
  header: Record<string, unknown>;
  /** The JWT payload claims as a plain object. */
  payload: Record<string, unknown>;
  /** Whether a signature segment was present in the token string. */
  signaturePresent: boolean;
}

/** Severity level for a lint finding. */
export type Severity = "info" | "warn" | "error";

/** A single finding produced by a lint rule. */
export interface LintFinding {
  /** The identifier of the rule that produced this finding. */
  ruleId: string;
  /** The severity of this finding. */
  severity: Severity;
  /** Human-readable description of the issue. */
  description: string;
  /** Suggested remediation for the issue. */
  suggestedFix: string;
}

/** Configuration for the JWT linter. */
export interface LintConfig {
  /** Rule IDs that should be skipped entirely. */
  disabledRules?: string[];
  /** Per-rule severity overrides (rule ID → desired severity). */
  severityOverrides?: Record<string, Severity>;
  /** Claim key patterns (strings or regex-like) considered PII. */
  piiClaimPatterns?: string[];
}

/** A single lint rule definition. */
export interface LintRule {
  /** Unique identifier for this rule. */
  id: string;
  /** Default severity when the rule fires. */
  severity: Severity;
  /**
   * Evaluates the rule against a decoded token.
   * Returns a `LintFinding` when the rule condition is met, or `null` otherwise.
   */
  check: (token: DecodedToken, config: LintConfig) => LintFinding | null;
}

/** The result of inspecting a JWT token. */
export interface InspectResult {
  /** Overall validity status of the token. */
  status: "valid" | "expired" | "not_yet_valid" | "unverified";
  /** The algorithm declared in the token header. */
  algorithm: string;
  /** Key ID from the token header, if present. */
  kid?: string;
  /** Issuer claim (`iss`), if present. */
  issuer?: string;
  /** Subject claim (`sub`), if present. */
  subject?: string;
  /** Audience claim (`aud`), if present. */
  audience?: string | string[];
  /** Issued-at time (`iat`), if present. */
  issuedAt?: Date;
  /** Expiration time (`exp`), if present. */
  expiresAt?: Date;
  /** Not-before time (`nbf`), if present. */
  notBefore?: Date;
  /** Claims not covered by the standard registered claim names. */
  customClaims: Record<string, unknown>;
  /** Seconds until expiry; negative if already expired. */
  timeUntilExpiry?: number;
  /** Result of signature verification, if attempted. */
  verificationResult?: Result<true, VerifyError>;
  /** Lint findings produced for this token. */
  lintFindings: LintFinding[];
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Error returned when token encoding fails. */
export interface EncodeError {
  /** Human-readable error message. */
  message: string;
  /** Machine-readable error code. */
  code: "MISSING_KEY" | "INVALID_PAYLOAD" | "SIGN_FAILED";
}

/** Error returned when token decoding fails. */
export interface DecodeError {
  /** Human-readable error message. */
  message: string;
  /** Machine-readable error code. */
  code: "MALFORMED" | "INVALID_JSON";
}

/** The reason a token verification failed. */
export type VerifyFailureReason =
  | "signature_mismatch"
  | "expired"
  | "not_yet_valid"
  | "algorithm_mismatch"
  | "missing_claim"
  | "malformed";

/** Error returned when token verification fails. */
export interface VerifyError {
  /** The specific reason verification failed. */
  reason: VerifyFailureReason;
  /** Human-readable error message. */
  message: string;
}

/** Error returned when key generation fails. */
export interface KeygenError {
  /** Human-readable error message. */
  message: string;
  /** Machine-readable error code. */
  code: "UNSUPPORTED_TYPE" | "GENERATION_FAILED";
}

/** Error returned when duration string parsing fails. */
export interface DurationError {
  /** Human-readable error message. */
  message: string;
  /** The original input string that could not be parsed. */
  input: string;
}

/** Error returned when natural language payload parsing fails. */
export interface NlpError {
  /** Human-readable error message. */
  message: string;
}

/** Error returned when a JWKS operation fails. */
export interface JwksError {
  /** Human-readable error message. */
  message: string;
  /** Machine-readable error code. */
  code: "FETCH_FAILED" | "INVALID_SHAPE" | "KEY_NOT_FOUND";
}

/** Error returned when the high-level inspect flow fails before producing a result. */
export interface InspectError {
  /** Human-readable error message. */
  message: string;
  /** Machine-readable error code. */
  code: "DECODE_FAILED" | "OIDC_DISCOVERY_FAILED";
}

/** Error returned when config loading or validation fails. */
export interface ConfigError {
  /** Human-readable error message. */
  message: string;
  /** Machine-readable error code. */
  code: "NOT_FOUND" | "PARSE_ERROR" | "VALIDATION_ERROR";
  /** Detailed validation issue messages, if applicable. */
  issues?: string[];
}
