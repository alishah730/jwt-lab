# Requirements Document

## Introduction

`jwt-cli` is a production-ready npm package that serves two roles simultaneously: a premium developer CLI tool for the full JWT lifecycle (encode, decode, verify, inspect, key management, security auditing), and a Model Context Protocol (MCP) HTTP/JSON server exposing the same capabilities to AI agents. The CLI and MCP server share a pure core library with no I/O side-effects. The package is security-opinionated, embedding modern JWT best practices rather than acting as a thin wrapper around a JWT library.

## Glossary

- **CLI**: The `jwt` command-line interface, the primary user-facing binary.
- **Core**: The pure, I/O-free TypeScript module in `src/core/` containing all JWT logic, key handling, linting, and security analysis.
- **MCP_Server**: The Hono-based HTTP/JSON server in `src/mcp/` implementing the Model Context Protocol.
- **Token**: A JSON Web Token (JWT) string, either JWS or JWE.
- **Payload**: The JSON claims object embedded in a Token.
- **Header**: The JOSE header object of a Token.
- **Linter**: The shared security analysis module that evaluates a Token or Payload against a set of configurable rules.
- **Rule**: A single security or best-practice check performed by the Linter, identified by a unique string ID.
- **Profile**: A named configuration preset in `.jwt-cli.toml` that bundles TTL, scopes, and audience values.
- **Config_File**: A `.jwt-cli.toml` file discovered by searching from the current working directory upward.
- **JWKS**: A JSON Web Key Set, a JSON document containing one or more public keys.
- **PEM**: Privacy Enhanced Mail format for encoding cryptographic keys.
- **JWK**: JSON Web Key format for encoding cryptographic keys.
- **Fake_Time**: A fixed ISO-8601 timestamp injected via `--fake-time` to override the system clock for deterministic testing.
- **Batch_Mode**: Processing multiple line-separated Tokens read from stdin.
- **Exit_Code**: The numeric process exit code: 0 for success, 1 for user/input error, 2 for internal/unexpected error.

---

## Requirements

### Requirement 1: Package Structure and Build

**User Story:** As a developer, I want a well-structured TypeScript package with dual ESM/CJS output, so that I can install `jwt-cli` globally or use it as a library in any Node.js project.

#### Acceptance Criteria

1. THE CLI SHALL be published as an npm package named `jwt-cli` with a `bin` field mapping `"jwt"` to `"dist/cli.js"`.
2. THE CLI SHALL target Node.js >= 18 and declare this in the `engines` field of `package.json`.
3. THE CLI SHALL be built with `tsup` producing both ESM and CJS output under `dist/`.
4. THE CLI SHALL be written in TypeScript with `strict: true`, `noImplicitAny: true`, and `strictNullChecks: true`; the build MUST fail if any `any` type is present.
5. THE CLI SHALL expose the following npm scripts: `build`, `test`, `lint`, `mcp:serve`, `dev:mcp`, and `changeset`.
6. THE Core SHALL contain only pure functions with no I/O side-effects; all file system and network access MUST reside in `src/cli/`, `src/mcp/`, or `src/config/`.

---

### Requirement 2: Configuration Loading

**User Story:** As a developer, I want a `.jwt-cli.toml` config file that is discovered automatically, so that I can set project-level defaults without repeating flags on every command.

#### Acceptance Criteria

1. WHEN the CLI starts, THE Config_File SHALL be searched from the current working directory upward until a `.jwt-cli.toml` file is found or the filesystem root is reached.
2. WHEN a Config_File is found, THE CLI SHALL parse and validate it using Zod before applying any values.
3. IF a Config_File contains an invalid value, THEN THE CLI SHALL print a descriptive validation error and exit with Exit_Code 1.
4. THE Config_File SHALL support the following top-level sections: `defaults` (iss, aud, alg, jwks), `keys` (type, privateKeyPath, publicKeyPath), and `profiles` (named presets with ttl, scopes, aud).
5. WHEN both a Config_File value and a CLI flag are provided for the same option, THE CLI SHALL use the CLI flag value, treating CLI flags as the highest-priority override.
6. WHERE a `--config` flag is provided, THE CLI SHALL load that specific file path instead of performing the upward search.

---

### Requirement 3: Global CLI Flags and UX

**User Story:** As a developer, I want consistent global flags and a polished terminal experience, so that the tool feels intuitive and integrates well into scripts.

#### Acceptance Criteria

1. THE CLI SHALL support the global flags `--help`, `--version`, `--fake-time <iso8601>`, and `--config <path>` on all commands.
2. WHEN `--fake-time <iso8601>` is provided, THE Core SHALL use the specified timestamp in place of the system clock for all time-sensitive operations including expiration checks and `iat` generation.
3. THE CLI SHALL support `-` as a token argument on all commands that accept a token, causing THE CLI to read the token value from stdin.
4. THE CLI SHALL support a `--copy` flag on commands that produce a token, causing THE CLI to copy the output to the system clipboard.
5. THE CLI SHALL default to pretty-printed, colored terminal output and SHALL switch to machine-readable JSON output when `--json` is provided.
6. THE CLI SHALL support `--batch` on `decode`, `verify`, and `inspect` commands, reading newline-separated tokens from stdin and processing each independently.
7. IF an error occurs, THEN THE CLI SHALL print a colored, actionable error message without a raw stack trace and SHALL exit with Exit_Code 1 for user errors or Exit_Code 2 for unexpected internal errors.
8. THE CLI SHALL use `picocolors` for color output, `boxen` for framed output blocks, `ora` for progress spinners, and `table` or `cli-table3` for tabular data.

---

### Requirement 4: Encode Command

**User Story:** As a developer, I want to encode a JWT from a JSON payload or a natural language description, so that I can quickly generate tokens for testing and development.

#### Acceptance Criteria

1. WHEN `jwt encode <payload>` is invoked with a valid JSON string, THE CLI SHALL sign the JSON object and output the resulting Token.
2. WHEN `jwt encode <description>` is invoked with a non-JSON string, THE CLI SHALL interpret the input as a natural language description and derive a Payload from it before signing.
3. THE CLI SHALL accept the following signing options: `--secret <string>` for HMAC, `--key <path>` for a PEM or JWK private key file, and `--alg <algorithm>` to override the algorithm.
4. THE CLI SHALL accept the following Header options: `--header <json>` to merge additional header fields, and `--kid <string>` to set the key ID.
5. THE CLI SHALL accept the following standard claims options: `--exp <duration>`, `--iat`, `--nbf <duration>`, `--iss <string>`, `--sub <string>`, `--aud <string>`, `--jti`.
6. WHEN `--exp <duration>` is provided, THE Core SHALL parse human-readable duration strings (e.g., `"1h"`, `"30m"`, `"7d"`) into a numeric `exp` claim relative to the current time or Fake_Time.
7. WHEN `--jti` is provided without a value, THE Core SHALL generate a cryptographically random UUID v4 as the `jti` claim value.
8. IF no signing key or secret is provided and no default is set in the Config_File, THEN THE CLI SHALL print an error describing the missing key and exit with Exit_Code 1.
9. WHEN `--copy` is provided, THE CLI SHALL copy the encoded Token string to the system clipboard after output.

---

### Requirement 5: Decode Command

**User Story:** As a developer, I want to decode a JWT without verifying it, so that I can quickly inspect the contents of any token.

#### Acceptance Criteria

1. WHEN `jwt decode <token>` is invoked, THE Core SHALL base64url-decode the Header and Payload and return them as structured objects without performing signature verification.
2. THE CLI SHALL display the decoded Header, Payload, and a signature presence indicator in a formatted, human-readable layout by default.
3. WHEN `--json` is provided, THE CLI SHALL output a single JSON object with `header`, `payload`, and `signature` fields.
4. WHEN `--batch` is provided, THE CLI SHALL read newline-separated tokens from stdin and output one decoded result per line.
5. IF a token string is malformed and cannot be split into three dot-separated parts, THEN THE Core SHALL return a structured error describing the malformation.

---

### Requirement 6: Verify Command

**User Story:** As a developer, I want to fully verify a JWT's signature and claims, so that I can validate tokens in development and CI pipelines.

#### Acceptance Criteria

1. WHEN `jwt verify <token>` is invoked with `--secret <string>`, THE Core SHALL verify the token's HMAC signature using the provided secret.
2. WHEN `jwt verify <token>` is invoked with `--key <path>`, THE Core SHALL verify the token's asymmetric signature using the public key loaded from the specified PEM or JWK file.
3. WHEN `jwt verify <token>` is invoked with `--jwks <url>`, THE Core SHALL fetch the JWKS from the URL, cache it in memory for the process lifetime, and use the matching key to verify the signature.
4. WHEN `--alg <algorithm>` is provided, THE Core SHALL reject tokens whose Header `alg` field does not match the specified algorithm.
5. WHEN `--require <claim>` is provided one or more times, THE Core SHALL reject tokens that are missing any of the specified claims.
6. WHEN `--leeway <seconds>` is provided, THE Core SHALL apply the specified number of seconds of clock skew tolerance to `exp`, `nbf`, and `iat` validation.
7. WHEN `--fake-time` is active, THE Core SHALL use the Fake_Time value instead of the system clock for all expiration and not-before checks.
8. IF signature verification fails, THEN THE Core SHALL return a structured error with a reason field distinguishing between signature mismatch, expired token, not-yet-valid token, and algorithm mismatch.
9. WHEN verification succeeds, THE CLI SHALL display the verified Payload with a success indicator; WHEN `--json` is provided, THE CLI SHALL output a JSON object with a `valid: true` field and the Payload.

---

### Requirement 7: Inspect Command

**User Story:** As a developer, I want a high-level human-readable breakdown of a token's status and security posture, so that I can quickly understand a token without memorizing claim semantics.

#### Acceptance Criteria

1. WHEN `jwt inspect <token>` is invoked, THE CLI SHALL display: token status (valid/expired/not-yet-valid), expiration countdown or time-since-expiry, algorithm, key ID if present, issuer, subject, audience, and all custom claims.
2. WHEN `--jwks <url>`, `--secret`, or `--key` is provided, THE CLI SHALL attempt signature verification and include the verification result in the inspection output.
3. THE Linter SHALL be invoked during inspection and its findings SHALL be displayed as ranked security notes alongside the token breakdown.
4. WHEN `--json` is provided, THE CLI SHALL output a single structured JSON object containing all inspection fields including Linter findings.
5. WHEN `--fake-time` is active, THE Core SHALL use the Fake_Time value for all time-relative calculations in the inspection output.

---

### Requirement 8: Keygen Command

**User Story:** As a developer, I want to generate cryptographic key pairs for JWT signing, so that I can set up asymmetric signing without external tools.

#### Acceptance Criteria

1. WHEN `jwt keygen rsa` is invoked, THE Core SHALL generate an RSA key pair with a minimum key size of 2048 bits.
2. WHEN `jwt keygen ec` is invoked, THE Core SHALL generate an EC key pair using the P-256 curve by default.
3. WHEN `jwt keygen ed25519` is invoked, THE Core SHALL generate an Ed25519 key pair.
4. THE CLI SHALL accept `--jwk` to output keys in JWK format, `--pem` to output keys in PEM format, and `--out-dir <path>` to write key files to a directory instead of stdout.
5. WHEN `--kid <string>` is provided, THE Core SHALL embed the specified key ID in the generated JWK.
6. WHEN `--out-dir <path>` is provided, THE CLI SHALL write separate files for the private and public keys and SHALL print the file paths to stdout.
7. IF `--out-dir <path>` points to a non-existent directory, THEN THE CLI SHALL create the directory before writing key files.

---

### Requirement 9: Explain Command (Security Audit)

**User Story:** As a developer or CI pipeline, I want a static security audit of a token without needing signing keys, so that I can catch JWT anti-patterns before they reach production.

#### Acceptance Criteria

1. WHEN `jwt explain <token>` is invoked, THE Linter SHALL analyze the token's Header and Payload without performing signature verification.
2. THE Linter SHALL evaluate the token against all enabled Rules and return a list of findings, each containing: rule ID, severity (`info`, `warn`, or `error`), description, and suggested fix.
3. THE CLI SHALL display findings ranked by severity (error first, then warn, then info) in a formatted table.
4. WHEN `--json` is provided, THE CLI SHALL output a JSON array of finding objects suitable for CI consumption.
5. WHEN no findings are produced, THE CLI SHALL display a confirmation that no issues were detected and exit with Exit_Code 0.
6. WHEN one or more findings with severity `error` are present, THE CLI SHALL exit with Exit_Code 1.

---

### Requirement 10: Security Linting Rules

**User Story:** As a developer, I want the Linter to enforce modern JWT best practices automatically, so that I don't have to remember every security guideline.

#### Acceptance Criteria

1. THE Linter SHALL include a rule that flags tokens missing an `exp` claim with severity `warn`.
2. THE Linter SHALL include a rule that flags tokens whose `exp` claim exceeds 24 hours from `iat` with severity `warn`.
3. THE Linter SHALL include a rule that flags long-lived tokens (exp - iat > 1 hour) that are missing an `nbf` claim with severity `info`.
4. THE Linter SHALL include a rule that flags tokens using the `none` algorithm with severity `error`.
5. THE Linter SHALL include a rule that flags tokens using HMAC algorithms (HS256, HS384, HS512) in contexts where asymmetric algorithms are preferred, with severity `info`.
6. THE Linter SHALL include a rule that flags tokens containing claim names that match a configurable list of sensitive PII patterns (e.g., `email`, `phone`, `ssn`, `address`) with severity `warn`.
7. THE Config_File SHALL allow individual Rules to be disabled by ID and SHALL allow the severity of any Rule to be overridden.
8. THE Linter SHALL be a pure function in Core that accepts a decoded token and a rule configuration and returns a list of findings with no side-effects.

---

### Requirement 11: MCP Server

**User Story:** As an AI agent or LLM tool-use system, I want an HTTP/JSON server exposing JWT operations, so that I can encode, decode, verify, and audit tokens programmatically without spawning a CLI process.

#### Acceptance Criteria

1. WHEN `jwt mcp serve` is invoked, THE MCP_Server SHALL start a Hono HTTP server on a configurable port (default 3000).
2. THE MCP_Server SHALL expose the following endpoints: `POST /encode`, `POST /decode`, `POST /verify`, `POST /inspect`, `POST /keygen`, `POST /explain`.
3. THE MCP_Server SHALL validate all request bodies using Zod schemas before passing data to Core functions.
4. IF a request body fails Zod validation, THEN THE MCP_Server SHALL return HTTP 422 with a JSON body containing a structured list of validation errors.
5. THE MCP_Server SHALL serve an OpenAPI 3.1 specification at `GET /docs` describing all endpoints, request schemas, and response schemas.
6. WHERE an `MCP_API_KEY` environment variable is set, THE MCP_Server SHALL require a matching `Authorization: Bearer <key>` header on all non-docs endpoints and SHALL return HTTP 401 for missing or invalid keys.
7. THE MCP_Server SHALL apply basic rate limiting, rejecting requests that exceed a configurable threshold with HTTP 429.
8. THE MCP_Server SHALL never log full raw Token strings; WHEN logging is performed, THE MCP_Server SHALL truncate or redact Token values to at most the first 20 characters followed by `"..."`.
9. THE MCP_Server SHALL support configurable claim redaction, omitting specified claim names from all response payloads.
10. THE MCP_Server SHALL set CORS headers allowing configurable origins.
11. THE MCP_Server SHALL delegate all JWT logic to Core functions; no JWT processing logic SHALL be duplicated in `src/mcp/`.

---

### Requirement 12: Shell / Interactive REPL

**User Story:** As a developer, I want an interactive REPL for JWT operations, so that I can experiment with tokens without re-typing flags on every command.

#### Acceptance Criteria

1. WHEN `jwt shell` is invoked, THE CLI SHALL start an interactive REPL session with a prompt.
2. THE CLI SHALL maintain command history across REPL invocations, persisting history to a file in the user's home directory.
3. THE CLI SHALL provide tab completion for command names and flag names within the REPL.
4. WHEN a token is encoded or modified in the REPL, THE CLI SHALL display a live preview of the decoded token alongside the encoded string.
5. WHEN the user types `exit` or presses Ctrl+C, THE CLI SHALL terminate the REPL session cleanly and exit with Exit_Code 0.

---

### Requirement 13: Testing

**User Story:** As a maintainer, I want a comprehensive test suite, so that I can confidently refactor and release new versions.

#### Acceptance Criteria

1. THE CLI SHALL use Vitest as the test runner with `@vitest/ui` for the interactive UI.
2. THE Core SHALL have unit tests covering: duration string parsing, token generation and signing, config file loading and validation, and all Linter security rules.
3. THE CLI SHALL have integration tests for each command using `execa` to spawn the CLI binary and assert on stdout, stderr, and exit codes.
4. THE MCP_Server SHALL have integration tests using Hono's testing utilities to assert on HTTP response status codes, headers, and JSON bodies.
5. WHEN `--fake-time` is used in tests, THE Core SHALL produce deterministic output independent of the system clock.
6. THE CLI SHALL achieve deterministic test results; tests MUST NOT depend on real network calls or the system clock without mocking.

---

### Requirement 14: Documentation

**User Story:** As a new user, I want clear documentation, so that I can get started quickly and understand all available options.

#### Acceptance Criteria

1. THE CLI SHALL include a `README.md` with sections covering: installation, CLI usage examples for all commands, MCP server usage with `curl` examples, and an example `.jwt-cli.toml`.
2. THE Core SHALL have TSDoc/JSDoc comments on all exported functions describing parameters, return types, and thrown errors.
3. THE CLI SHALL display accurate `--help` output for every command and subcommand, generated from the `commander` definitions.

---

### Requirement 15: Parser and Round-Trip Integrity

**User Story:** As a developer, I want the token encoding and decoding pipeline to be provably correct, so that no data is lost or corrupted during serialization.

#### Acceptance Criteria

1. WHEN a valid Payload is encoded into a Token and then decoded, THE Core SHALL produce a Payload object that is deeply equal to the original input Payload (round-trip property).
2. WHEN a Config_File is loaded and then serialized back to TOML, THE Core SHALL produce a document that, when re-parsed, yields a Config object deeply equal to the original (round-trip property).
3. THE Core SHALL include property-based tests using Vitest that verify the encode→decode round-trip holds for arbitrarily generated Payload objects containing string, number, boolean, and array values.
4. IF a Token string is structurally valid but contains a base64url segment that decodes to invalid JSON, THEN THE Core SHALL return a structured parse error rather than throwing an unhandled exception.
