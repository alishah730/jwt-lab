# Implementation Plan: jwt-lab

## Overview

Implement `jwt-lab` as a TypeScript npm package (binary: `jwt`) with dual ESM/CJS output. Build order follows strict bottom-up dependency: project scaffolding → core pure functions → config module → UI formatters → CLI commands → MCP server → tests → documentation. Each task builds on the previous and ends with all pieces wired together.

## Tasks

- [x] 1. Scaffold project structure and build tooling
  - Create `package.json` with name `jwt-lab`, description `jwt-lab – Modern JWT CLI, inspector, and MCP server for AI agents`, `bin: { "jwt": "dist/cli.js" }`, `engines: { node: ">=18" }`, keywords including `jwt`, `jwt-cli`, `jwt-tool`, `jwt-inspector`, `jwt-decoder`, `jwt-encoder`, `jwt-verifier`, `mcp-server`, `jwt-mcp`, `cli`, `security`, `authentication`
  - Add scripts: `build`, `test`, `lint`, `mcp:serve`, `dev:mcp`, `changeset`
  - Add dependencies: `jose`, `commander`, `zod`, `smol-toml`, `hono`, `picocolors`, `boxen`, `ora`, `cli-table3`, `uuid`
  - Add devDependencies: `typescript`, `tsup`, `vitest`, `@vitest/coverage-v8`, `@fast-check/vitest`, `fast-check`, `execa`, `eslint`, `prettier`, `@changesets/cli`
  - Create `tsconfig.json` with `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `module: NodeNext`, `target: ES2022`
  - Create `tsup.config.ts` producing ESM + CJS output under `dist/`, entry `src/cli.ts` and `src/mcp/app.ts`
  - Create `vitest.config.ts` with `globals: true`, `environment: node`, `coverage: { provider: "v8" }`
  - Create `.eslintrc.json` and `.prettierrc` with sensible defaults
  - Create `.changeset/config.json` for changesets workflow
  - Create `src/` directory structure: `core/`, `cli/commands/`, `mcp/routes/`, `mcp/middleware/`, `config/`, `ui/`, `tests/unit/`, `tests/integration/`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement shared types and utilities (`src/core/types.ts`)
  - Define `Ok<T>`, `Err<E>`, and `Result<T, E>` discriminated union types
  - Define `SUPPORTED_ALGORITHMS` const array and `SupportedAlgorithm` type
  - Define `EXIT_CODES` const object (`SUCCESS: 0`, `USER_ERROR: 1`, `INTERNAL_ERROR: 2`)
  - Define `DecodedToken`, `InspectResult`, `LintFinding`, `LintConfig`, `LintRule`, `Severity` interfaces
  - Define all error types: `EncodeError`, `DecodeError`, `VerifyError`, `VerifyFailureReason`, `KeygenError`, `DurationError`, `NlpError`, `JwksError`, `ConfigError`
  - Export helper functions `ok<T>(value: T): Ok<T>` and `err<E>(error: E): Err<E>`
  - _Requirements: 1.4, 1.6_

- [x] 3. Implement duration parser (`src/core/duration.ts`)
  - Implement `parseDuration(input: string): Result<number, DurationError>`
  - Support single-unit strings: `s` (seconds), `m` (minutes), `h` (hours), `d` (days), `w` (weeks)
  - Support compound durations like `"1h30m"` by summing all matched groups
  - Return `Err` for any string that matches no `(\d+)([smhdw])` groups
  - Export the function as a named export
  - _Requirements: 4.6_

  - [ ]* 3.1 Write property test for duration parsing (Property 3)
    - **Property 3: Duration Parsing Correctness**
    - **Validates: Requirements 4.6**
    - Use `fc.tuple(fc.integer({ min: 1, max: 999 }), fc.constantFrom("s","m","h","d","w"))` to generate valid inputs
    - Assert `parseDuration` returns `Ok` with correct seconds for all valid inputs
    - Assert `parseDuration` returns `Err` for arbitrary non-matching strings

- [x] 4. Implement NLP payload parser (`src/core/nlp.ts`)
  - Implement `parseNaturalLanguagePayload(description: string, now: Date): Result<Record<string, unknown>, NlpError>`
  - Recognize `"expires in <duration>"` → sets `exp` using `parseDuration`
  - Recognize `"issued by <string>"` → sets `iss`
  - Recognize `"for <string>"` → sets `sub`
  - Recognize `"role: <string>"` or `"<string> user"` → sets `role`
  - Recognize `"scope: <csv>"` → sets `scope` as string array
  - Return empty payload (not `Err`) when no patterns match
  - _Requirements: 4.2_

- [x] 5. Implement JWT encode (`src/core/encode.ts`)
  - Define `EncodeOptions` interface with `payload`, `header`, `secret`, `privateKeyPem`, `privateKeyJwk`, `alg`, `kid`, `now`
  - Implement `encodeToken(opts: EncodeOptions): Promise<Result<string, EncodeError>>` using `jose`
  - Support HMAC signing (`HS256/384/512`) via `secret`
  - Support asymmetric signing (`RS*`, `ES*`, `EdDSA`, `PS*`) via `privateKeyPem` or `privateKeyJwk`
  - Inject `now` as the clock for `iat` generation when provided
  - Generate UUID v4 `jti` when `payload.jti === true`
  - Merge `header` fields into the JOSE header alongside `alg` and `kid`
  - Return `Err` with descriptive message when no signing key is provided
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.7_

  - [ ]* 5.1 Write property test for encode→decode round trip (Property 1)
    - **Property 1: Encode → Decode Round Trip**
    - **Validates: Requirements 15.1, 15.3, 4.1**
    - Generate arbitrary payloads with `fc.record` containing string/number/boolean/array values
    - Assert decoded payload deeply equals original after encode→decode cycle

  - [ ]* 5.2 Write property test for fake time determinism (Property 4)
    - **Property 4: Fake Time Determinism**
    - **Validates: Requirements 3.2, 6.7, 7.5**
    - Generate arbitrary ISO-8601 timestamps and assert same `iat`/`exp` regardless of wall clock

- [x] 6. Implement JWT decode (`src/core/decode.ts`)
  - Implement `decodeToken(token: string): Result<DecodedToken, DecodeError>`
  - Split token on `.` and validate three-part structure; return `Err` if malformed
  - Base64url-decode header and payload segments; return `Err` if JSON parse fails
  - Set `signaturePresent: true` when the third segment is non-empty
  - No signature verification — pure structural decode only
  - _Requirements: 5.1, 5.5_

  - [ ]* 6.1 Write property test for malformed token error handling (Property 2)
    - **Property 2: Malformed Token Returns Structured Error**
    - **Validates: Requirements 5.5, 15.4**
    - Generate arbitrary strings that are not valid three-part dot-separated JWTs
    - Assert `decodeToken` returns `Err` (never throws) for all such inputs

- [x] 7. Implement JWKS cache (`src/core/jwks.ts`)
  - Define `JwksCache` interface with `get(uri: string): Promise<Result<JWKSDocument, JwksError>>` and `invalidate(uri: string): void`
  - Implement `createJwksCache(): JwksCache` using an in-memory `Map`
  - On cache miss: fetch via `fetch()`, validate response shape with Zod `JWKSSchema`, store on success
  - On fetch error or invalid shape: return `Err` without caching
  - On cache hit: return cached value without network call
  - _Requirements: 6.3_

  - [ ]* 7.1 Write property test for JWKS cache idempotence (Property 13)
    - **Property 13: JWKS Cache Idempotence**
    - **Validates: Requirements 6.3**
    - Mock `fetch` to count calls; assert exactly one fetch for N repeated `get(uri)` calls

- [x] 8. Implement JWT verify (`src/core/verify.ts`)
  - Define `VerifyOptions` interface with `token`, `secret`, `publicKeyPem`, `publicKeyJwk`, `jwksUri`, `alg`, `requiredClaims`, `leewaySeconds`, `now`
  - Implement `verifyToken(opts: VerifyOptions): Promise<Result<DecodedToken, VerifyError>>` using `jose`
  - Support HMAC verification via `secret`, asymmetric via `publicKeyPem`/`publicKeyJwk`, JWKS via `jwksUri` (using `createJwksCache`)
  - Enforce `alg` mismatch check when `opts.alg` is provided
  - Enforce `requiredClaims` presence check
  - Apply `leewaySeconds` to `exp`/`nbf`/`iat` validation
  - Use `opts.now` as clock override when provided
  - Map all jose errors to typed `VerifyFailureReason` values
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 8.1 Write property test for signature verification correctness (Property 8)
    - **Property 8: Signature Verification Correctness**
    - **Validates: Requirements 6.1, 6.2**
    - Generate HMAC secrets; assert verify succeeds with same key, fails with different key

  - [ ]* 8.2 Write property test for algorithm mismatch rejection (Property 9)
    - **Property 9: Algorithm Mismatch Rejection**
    - **Validates: Requirements 6.4**
    - Encode with alg X, verify specifying alg Y (X≠Y); assert `Err` with `reason: "algorithm_mismatch"`

  - [ ]* 8.3 Write property test for missing required claims rejection (Property 10)
    - **Property 10: Missing Required Claims Rejection**
    - **Validates: Requirements 6.5**

  - [ ]* 8.4 Write property test for leeway tolerance (Property 11)
    - **Property 11: Leeway Tolerance**
    - **Validates: Requirements 6.6**
    - Generate expired tokens with varying leeway; assert pass when L≥N, fail when L<N

  - [ ]* 8.5 Write property test for verify error reason completeness (Property 12)
    - **Property 12: Verify Error Reason Completeness**
    - **Validates: Requirements 6.8**
    - Assert every `VerifyError` has a `reason` from the defined enum, never undefined

- [x] 9. Implement security linter (`src/core/linter.ts`)
  - Define `LintRule` interface and implement all 6 built-in rules as named objects
  - `missing-exp` (warn): `payload.exp` is absent
  - `long-lived-token` (warn): `exp - iat > 86400`
  - `missing-nbf-long-lived` (info): `exp - iat > 3600` and `nbf` absent
  - `none-algorithm` (error): `header.alg === "none"`
  - `hmac-preferred-asymmetric` (info): `alg` ∈ {HS256, HS384, HS512}
  - `pii-claims` (warn): any claim key matches a pattern in `config.piiClaimPatterns`
  - Implement `lintToken(token: DecodedToken, config: LintConfig): LintFinding[]`
  - Filter disabled rules, apply severity overrides, sort findings by severity descending (error→warn→info)
  - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [ ]* 9.1 Write property test for linter rule completeness (Property 16)
    - **Property 16: Linter Rule Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**
    - For each rule, generate tokens that trigger and don't trigger the condition; assert finding presence

  - [ ]* 9.2 Write property test for findings sorted by severity (Property 17)
    - **Property 17: Linter Findings Sorted by Severity**
    - **Validates: Requirements 9.3**
    - Generate arbitrary tokens; assert returned findings array is sorted error→warn→info

  - [ ]* 9.3 Write property test for rule disable and severity override (Property 18)
    - **Property 18: Rule Disable and Severity Override**
    - **Validates: Requirements 10.7**
    - Assert disabled rules produce no findings; assert overridden severity matches config value

- [x] 10. Implement key generation (`src/core/keygen.ts`)
  - Define `KeygenOptions` and `GeneratedKeyPair` interfaces
  - Implement `generateKeyPair(opts: KeygenOptions): Promise<Result<GeneratedKeyPair, KeygenError>>` using `jose`
  - Support `rsa` (min 2048 bits, default P-256 for EC), `ec` (default P-256 curve), `ed25519`
  - Output in `jwk` format (JSON string) or `pem` format
  - Embed `kid` in JWK output when provided
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.1 Write property test for key generation round trip (Property 14)
    - **Property 14: Key Generation Round Trip**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - For each key type, generate pair, sign token with private key, verify with public key; assert success

  - [ ]* 10.2 Write property test for key ID embedding (Property 15)
    - **Property 15: Key ID Embedding**
    - **Validates: Requirements 8.5**
    - Generate arbitrary `kid` strings; assert JWK output contains matching `kid` field

- [x] 11. Checkpoint — core module complete
  - Ensure all core unit tests pass, ask the user if questions arise.

- [x] 12. Implement config module (`src/config/schema.ts` and `src/config/loader.ts`)
  - [x] 12.1 Create `src/config/schema.ts` with Zod `ConfigSchema`
    - Define `defaults` section: `iss`, `aud`, `alg` (SupportedAlgorithmSchema), `jwks` (url)
    - Define `keys` section: `type`, `privateKeyPath`, `publicKeyPath`
    - Define `profiles` section: record of `{ ttl, scopes, aud }`
    - Define `lint` section: `disabledRules`, `severityOverrides`, `piiClaimPatterns`
    - Export `Config` type inferred from schema
    - _Requirements: 2.2, 2.4_

  - [x] 12.2 Create `src/config/loader.ts`
    - Implement `findConfigFile(startDir: string): string | null` — walk upward checking for `.jwt-cli.toml`
    - Implement `loadConfig(filePath: string): Result<Config, ConfigError>` — parse TOML with `smol-toml`, validate with Zod
    - Implement `mergeConfig(fileConfig: Config, cliFlags: Partial<Config>): Config` — CLI flags win, deep merge `defaults` and `lint`
    - Return `Err` with descriptive Zod issue messages on validation failure
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [ ]* 12.3 Write property test for CLI flag priority over config file (Property 5)
    - **Property 5: CLI Flag Priority Over Config File**
    - **Validates: Requirements 2.5**
    - Generate arbitrary config values and CLI flag values; assert merged result uses CLI flag value

  - [ ]* 12.4 Write property test for config file discovery (Property 6)
    - **Property 6: Config File Discovery**
    - **Validates: Requirements 2.1**
    - Create temp directories at varying depths; assert `findConfigFile` finds or returns null correctly

  - [ ]* 12.5 Write property test for config validation (Property 7)
    - **Property 7: Config Validation Rejects Invalid Inputs**
    - **Validates: Requirements 2.2, 2.3**
    - Generate invalid TOML documents; assert `loadConfig` returns `Err` with descriptive message

  - [ ]* 12.6 Write property test for config round trip (Property 27)
    - **Property 27: Config Round Trip**
    - **Validates: Requirements 15.2**
    - Serialize valid `Config` to TOML and re-parse; assert deep equality with original

- [x] 13. Implement UI formatting helpers (`src/ui/`)
  - [x] 13.1 Create `src/ui/format.ts`
    - Implement `formatDecodedToken(decoded: DecodedToken, opts: FormatOptions): string` — pretty-print header and payload with picocolors
    - Implement `formatLintFindings(findings: LintFinding[]): string` — colored severity labels
    - Implement `formatVerifyResult(result: VerifyResult): string` — success/failure with colored indicator
    - Implement `formatKeyPair(pair: GeneratedKeyPair, format: KeyFormat): string`
    - All functions return strings; no `console.log` calls
    - _Requirements: 3.5, 3.8_

  - [x] 13.2 Create `src/ui/table.ts`
    - Implement `buildFindingsTable(findings: LintFinding[]): string` using `cli-table3`
    - Implement `buildInspectTable(inspection: InspectResult): string`
    - _Requirements: 3.8, 9.3_

  - [x] 13.3 Create `src/ui/spinner.ts`
    - Implement `withSpinner<T>(label: string, fn: () => Promise<T>): Promise<T>` using `ora`
    - _Requirements: 3.8_

- [x] 14. Implement CLI entry point (`src/cli.ts`)
  - Create root `Command("jwt")` with `.version(VERSION)` read from `package.json`
  - Register global options: `--fake-time <iso8601>`, `--config <path>`, `--json`
  - Import and register all subcommands from `src/cli/commands/`
  - Add `mcp` subcommand group with `serve` subcommand
  - Handle top-level errors: catch unhandled rejections, print colored message, exit with `EXIT_CODES.INTERNAL_ERROR`
  - Add shebang `#!/usr/bin/env node` at top of file
  - _Requirements: 1.1, 3.1, 3.7_

- [x] 15. Implement encode command (`src/cli/commands/encode.ts`)
  - Export `buildEncodeCommand(): Command`
  - Register argument `<payload>` and all options: `--secret`, `--key`, `--alg`, `--header`, `--kid`, `--exp`, `--iat`, `--nbf`, `--iss`, `--sub`, `--aud`, `--jti`, `--copy`, `--profile`
  - Load config, merge with CLI flags (flags win), call `encodeToken` or `parseNaturalLanguagePayload` + `encodeToken`
  - Read key file from `--key` path when provided
  - Apply `--profile` preset from config before flag merge
  - Copy to clipboard when `--copy` is set
  - Output token string (pretty) or `{ token }` JSON when `--json`
  - Exit with `EXIT_CODES.USER_ERROR` on missing key, `EXIT_CODES.INTERNAL_ERROR` on unexpected error
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

- [x] 16. Implement decode command (`src/cli/commands/decode.ts`)
  - Export `buildDecodeCommand(): Command`
  - Register argument `<token>` (accepts `-` for stdin) and options: `--json`, `--batch`
  - Read from stdin when argument is `-`
  - In batch mode, split stdin on newlines and process each token independently
  - Call `decodeToken`, format with `formatDecodedToken` or output JSON object
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 17. Implement verify command (`src/cli/commands/verify.ts`)
  - Export `buildVerifyCommand(): Command`
  - Register argument `<token>` (accepts `-`) and options: `--secret`, `--key`, `--jwks`, `--alg`, `--require` (repeatable), `--leeway`, `--json`, `--batch`
  - Load config, merge flags, call `verifyToken`
  - Display success with colored indicator or structured error with failure reason
  - Support batch mode (newline-separated stdin)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

- [x] 18. Implement inspect command (`src/cli/commands/inspect.ts`)
  - Export `buildInspectCommand(): Command`
  - Register argument `<token>` (accepts `-`) and options: `--secret`, `--key`, `--jwks`, `--json`, `--batch`
  - Call `decodeToken`, optionally `verifyToken`, always `lintToken`
  - Build `InspectResult` with status, time calculations, all claims, lint findings
  - Display via `buildInspectTable` or output JSON when `--json`
  - Use `--fake-time` for all time-relative calculations
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 19. Implement keygen command (`src/cli/commands/keygen.ts`)
  - Export `buildKeygenCommand(): Command`
  - Register argument `<rsa|ec|ed25519>` and options: `--jwk`, `--pem`, `--kid`, `--out-dir`, `--bits`, `--curve`
  - Call `generateKeyPair`, format output with `formatKeyPair`
  - When `--out-dir` is provided, create directory if needed and write separate private/public key files, print file paths
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [~] 20. Implement explain command (`src/cli/commands/explain.ts`)
  - Export `buildExplainCommand(): Command`
  - Register argument `<token>` (accepts `-`) and option `--json`
  - Call `decodeToken` then `lintToken` (no signature verification)
  - Display findings table sorted by severity via `buildFindingsTable`
  - When `--json`, output JSON array of finding objects
  - Exit with `EXIT_CODES.SUCCESS` when no findings or only warn/info; exit with `EXIT_CODES.USER_ERROR` when any `error` finding present
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 20.1 Write property test for explain exit code on error findings (Property 19)
    - **Property 19: Explain Exit Code on Error Findings**
    - **Validates: Requirements 9.6**
    - Generate tokens with/without `error`-severity findings; assert correct exit code

- [~] 21. Implement shell/REPL command (`src/cli/commands/shell.ts`)
  - Export `buildShellCommand(): Command`
  - Start interactive REPL using Node.js `readline` with a `jwt> ` prompt
  - Persist command history to `~/.jwt-lab_history` across sessions
  - Provide tab completion for command names and flag names
  - On each encode/modify operation, display live preview of decoded token alongside encoded string
  - Handle `exit` input and `SIGINT` (Ctrl+C) cleanly, exit with `EXIT_CODES.SUCCESS`
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [~] 22. Implement MCP server Hono app and middleware (`src/mcp/app.ts`, `src/mcp/middleware/`)
  - [ ] 22.1 Create `src/mcp/middleware/auth.ts`
    - Check `Authorization: Bearer <key>` against `MCP_API_KEY` env var
    - Skip check when `MCP_API_KEY` is unset
    - Return HTTP 401 `{ error: "Unauthorized" }` on mismatch
    - _Requirements: 11.6_

  - [ ] 22.2 Create `src/mcp/middleware/rateLimit.ts`
    - Implement sliding window counter per client IP using in-memory `Map<string, number[]>`
    - Filter timestamps to those within the window (configurable, default 60s)
    - Return HTTP 429 `{ error: "Too Many Requests" }` when count >= limit
    - _Requirements: 11.7_

  - [ ] 22.3 Create `src/mcp/middleware/redact.ts`
    - Implement `redactToken(token: string): string` — truncate to first 20 chars + `"..."` when length > 20
    - Implement claim redaction middleware that removes configured claim names from response payloads
    - _Requirements: 11.8, 11.9_

  - [ ] 22.4 Create `src/mcp/app.ts`
    - Create Hono app factory `createApp(config: Config): Hono`
    - Register middleware in order: CORS (`hono/cors`), rate limiter, auth, error handler
    - Mount all route handlers
    - Export `startServer(port: number, host: string, config: Config): void` for CLI wiring
    - _Requirements: 11.1, 11.10_

  - [ ]* 22.5 Write property test for token redaction (Property 23)
    - **Property 23: Token Redaction in Logs**
    - **Validates: Requirements 11.8**
    - Generate strings of length > 20 and ≤ 20; assert correct truncation behavior

  - [ ]* 22.6 Write property test for claim redaction in MCP responses (Property 24)
    - **Property 24: Claim Redaction in MCP Responses**
    - **Validates: Requirements 11.9**
    - Generate claim sets and redaction configs; assert no redacted claim names appear in response

- [~] 23. Implement MCP route handlers (`src/mcp/routes/`)
  - [ ] 23.1 Create `src/mcp/schemas.ts` with Zod request/response schemas
    - `EncodeRequestSchema`: `payload`, `alg`, `secret`, `privateKeyJwk`, `exp`, `iss`, `sub`, `aud`, `kid`, `fakeTime`
    - `DecodeRequestSchema`: `token`
    - `VerifyRequestSchema`: `token`, `secret`, `publicKeyJwk`, `jwksUri`, `alg`, `requiredClaims`, `leewaySeconds`, `fakeTime`
    - `InspectRequestSchema`, `KeygenRequestSchema`, `ExplainRequestSchema`
    - _Requirements: 11.3_

  - [ ] 23.2 Create route handlers for each endpoint
    - `src/mcp/routes/encode.ts` — `POST /encode`: validate with `EncodeRequestSchema`, call `encodeToken`, return `{ token }`
    - `src/mcp/routes/decode.ts` — `POST /decode`: validate, call `decodeToken`, return decoded object
    - `src/mcp/routes/verify.ts` — `POST /verify`: validate, call `verifyToken`, return `{ valid, payload }` or error
    - `src/mcp/routes/inspect.ts` — `POST /inspect`: validate, call decode + verify + lint, return `InspectResult`
    - `src/mcp/routes/keygen.ts` — `POST /keygen`: validate, call `generateKeyPair`, return key pair
    - `src/mcp/routes/explain.ts` — `POST /explain`: validate, call decode + lint, return findings array
    - Each handler: return HTTP 422 on Zod failure, HTTP 400 on Core user error, HTTP 500 on unexpected error
    - Apply claim redaction middleware to all responses
    - _Requirements: 11.2, 11.3, 11.4, 11.11_

  - [ ]* 23.3 Write property test for MCP invalid body returns 422 (Property 20)
    - **Property 20: MCP Invalid Body Returns 422**
    - **Validates: Requirements 11.3, 11.4**
    - Generate invalid request bodies for each endpoint; assert HTTP 422 with `errors` array

  - [ ]* 23.4 Write property test for MCP auth enforcement (Property 21)
    - **Property 21: MCP Auth Enforcement**
    - **Validates: Requirements 11.6**
    - Set `MCP_API_KEY`; assert 401 without correct header, non-401 with correct header

  - [ ]* 23.5 Write property test for MCP rate limiting (Property 22)
    - **Property 22: MCP Rate Limiting**
    - **Validates: Requirements 11.7**
    - Send N+1 requests from same IP; assert HTTP 429 on requests beyond threshold

- [~] 24. Implement OpenAPI spec (`src/mcp/openapi.ts`)
  - Generate OpenAPI 3.1 spec programmatically from Zod schemas
  - Document all 6 endpoints with request body schemas, success response schemas, and error schemas (400, 401, 422, 429, 500)
  - Serve at `GET /docs` as JSON response
  - _Requirements: 11.5_

- [~] 25. Wire MCP serve subcommand into CLI (`src/cli/commands/mcp.ts`)
  - Export `buildMcpCommand(): Command` with `serve` subcommand
  - Register options: `--port <number>` (default 3000), `--host <string>` (default `0.0.0.0`)
  - Load config, call `startServer(port, host, config)`
  - Print startup message with URL to stdout
  - _Requirements: 11.1_

- [~] 26. Checkpoint — CLI and MCP server complete
  - Ensure all unit and integration tests pass, ask the user if questions arise.

- [~] 27. Write core unit tests (`tests/unit/`)
  - [ ] 27.1 `tests/unit/duration.test.ts` — valid single-unit, compound, and invalid inputs
  - [ ] 27.2 `tests/unit/encode.test.ts` — HMAC and asymmetric signing with fixed `now`, missing key error
  - [ ] 27.3 `tests/unit/decode.test.ts` — valid tokens, malformed tokens, base64url-invalid segments
  - [ ] 27.4 `tests/unit/verify.test.ts` — correct key, wrong key, expired, not-yet-valid, missing claims, leeway
  - [ ] 27.5 `tests/unit/linter.test.ts` — each of the 6 rules triggered and not triggered, disable, severity override
  - [ ] 27.6 `tests/unit/keygen.test.ts` — RSA, EC, Ed25519 in JWK and PEM formats, kid embedding
  - [ ] 27.7 `tests/unit/nlp.test.ts` — each recognized pattern, no-match fallback
  - [ ] 27.8 `tests/unit/jwks.test.ts` — cache hit (single fetch), cache miss, fetch error, invalid shape
  - [ ] 27.9 `tests/unit/config.test.ts` — valid TOML, invalid TOML, Zod validation errors, mergeConfig priority
  - _Requirements: 13.1, 13.2, 13.6_

- [~] 28. Write CLI integration tests (`tests/integration/cli/`)
  - Use `execa` to spawn the built `jwt` binary
  - [ ] 28.1 `encode.test.ts` — encode JSON payload, encode NLP description, `--exp`, `--fake-time`, missing key error
  - [ ] 28.2 `decode.test.ts` — decode valid token, decode from stdin (`-`), `--json`, `--batch`, malformed token error
  - [ ] 28.3 `verify.test.ts` — verify with secret, with key file, with `--jwks` (mocked), `--alg` mismatch, `--require`, `--leeway`, `--fake-time`
  - [ ] 28.4 `inspect.test.ts` — inspect with and without verification, `--json`, lint findings in output
  - [ ] 28.5 `keygen.test.ts` — all three key types, `--jwk`, `--pem`, `--out-dir` creates directory and files
  - [ ] 28.6 `explain.test.ts` — token with error finding exits 1, token with no findings exits 0, `--json` output
  - [ ] 28.7 `config.test.ts` — config file discovery from subdirectory, `--config` flag override, invalid config exits 1
  - _Requirements: 13.3, 13.5, 13.6_

  - [ ]* 28.8 Write property test for JSON output is valid JSON (Property 25)
    - **Property 25: JSON Output is Valid JSON**
    - **Validates: Requirements 3.5, 5.3, 6.9, 7.4, 9.4**
    - For each command with `--json`, assert `JSON.parse(stdout)` does not throw

  - [ ]* 28.9 Write property test for batch mode produces N results for N inputs (Property 26)
    - **Property 26: Batch Mode Produces N Results for N Inputs**
    - **Validates: Requirements 3.6, 5.4**
    - Generate N tokens, pipe to batch command, assert N output lines

- [~] 29. Write MCP integration tests (`tests/integration/mcp/`)
  - Use Hono test client (`app.request()`) — no real HTTP server needed
  - [ ] 29.1 `encode.test.ts` — valid request returns 200 with token, invalid body returns 422
  - [ ] 29.2 `decode.test.ts` — valid token returns 200, malformed token returns 400
  - [ ] 29.3 `verify.test.ts` — correct key returns 200 `{ valid: true }`, wrong key returns 400
  - [ ] 29.4 `inspect.test.ts` — returns InspectResult with lint findings
  - [ ] 29.5 `keygen.test.ts` — returns key pair in requested format
  - [ ] 29.6 `explain.test.ts` — returns findings array
  - [ ] 29.7 `auth.test.ts` — with `MCP_API_KEY` set: 401 without header, 200 with correct header
  - [ ] 29.8 `rateLimit.test.ts` — N+1 requests returns 429 on last
  - [ ] 29.9 `docs.test.ts` — `GET /docs` returns valid JSON OpenAPI spec
  - _Requirements: 13.4, 13.6_

  - [ ]* 29.10 Write property test for header merge correctness (Property 28)
    - **Property 28: Header Merge Correctness**
    - **Validates: Requirements 4.4**
    - Generate arbitrary header JSON objects; assert all key-value pairs appear in decoded token header

  - [ ]* 29.11 Write property test for JTI uniqueness (Property 29)
    - **Property 29: JTI Uniqueness**
    - **Validates: Requirements 4.7**
    - Call `encodeToken` with `jti: true` N times; assert all generated `jti` values are distinct UUID v4s

- [~] 30. Create example config file (`examples/.jwt-cli.toml`)
  - Write a well-commented example `.jwt-cli.toml` demonstrating all supported sections
  - Include `[defaults]` with `iss`, `aud`, `alg`
  - Include `[keys]` with `privateKeyPath` and `publicKeyPath`
  - Include `[profiles.dev]` and `[profiles.prod]` presets
  - Include `[lint]` with `disabledRules`, `severityOverrides`, and `piiClaimPatterns`
  - _Requirements: 14.1_

- [~] 31. Write README.md with full documentation
  - Title: `jwt-lab`
  - Description paragraph using phrases: "JWT CLI", "jwt cli tool", "jwt inspector", "MCP server", "jwt mcp"
  - Badges: npm version, license, Node.js version
  - Installation section: `npm install -g jwt-lab` and `npx jwt-lab`
  - CLI usage examples for all commands: encode, decode, verify, inspect, keygen, explain, shell, mcp serve
  - MCP server section with `curl` examples for each endpoint
  - Configuration section with annotated `.jwt-cli.toml` example
  - Security linting rules table
  - Contributing section referencing changesets
  - Keywords in prose: "JWT CLI", "jwt cli tool", "jwt inspector", "jwt decoder", "jwt encoder", "jwt verifier", "MCP server", "jwt mcp", "jwt tool"
  - _Requirements: 14.1_

- [~] 32. Final checkpoint — all tests pass and documentation complete
  - Ensure all unit, integration, and property-based tests pass
  - Ensure `npm run build` succeeds with no TypeScript errors
  - Ensure `npm run lint` passes
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across many generated inputs
- Unit tests validate specific examples, edge cases, and error conditions
- The `--fake-time` flag enables deterministic testing without `vi.useFakeTimers()`
- All Core functions are pure — no I/O — making them trivially unit-testable
- The MCP server and CLI share the same Core functions; no JWT logic is duplicated
