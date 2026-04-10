<div align="center">

```

     ██╗██╗    ██╗████████╗   ██╗      █████╗ ██████╗ 
     ██║██║    ██║╚══██╔══╝   ██║     ██╔══██╗██╔══██╗
     ██║██║ █╗ ██║   ██║█████╗██║     ███████║██████╔╝
██   ██║██║███╗██║   ██║╚════╝██║     ██╔══██║██╔══██╗
╚█████╔╝╚███╔███╔╝   ██║      ███████╗██║  ██║██████╔╝
 ╚════╝  ╚══╝╚══╝    ╚═╝      ╚══════╝╚═╝  ╚═╝╚═════╝
────────────────────────────────────────────────────────
v0.1.0 · JWT toolkit for developers & AI agents
```

# jwt-lab

### The JWT Swiss-Army Knife for Developers & AI Agents

[![npm version](https://img.shields.io/npm/v/jwt-lab?style=flat-square&color=cb3837)](https://www.npmjs.com/package/jwt-lab)
[![license](https://img.shields.io/npm/l/jwt-lab?style=flat-square&color=blue)](LICENSE)
[![node](https://img.shields.io/node/v/jwt-lab?style=flat-square&color=339933)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![CI](https://github.com/alishah730/jwt-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/alishah730/jwt-lab/actions/workflows/ci.yml)
[![CodeQL](https://github.com/alishah730/jwt-lab/actions/workflows/codeql.yml/badge.svg)](https://github.com/alishah730/jwt-lab/actions/workflows/codeql.yml)
[![tests](https://img.shields.io/badge/tests-95%20passed-brightgreen?style=flat-square)]()
[![MCP](https://img.shields.io/badge/MCP-ready-purple?style=flat-square)]()

**Encode · Decode · Verify · Inspect · Explain · Keygen · MCP Server**

A fast, secure, beautiful, and AI-agent-ready command-line tool **and TypeScript/JavaScript library** for working with JSON Web Tokens (JWTs), plus a full Model Context Protocol (MCP) HTTP/JSON server.

[Installation](#installation) · [Quick Start](#quick-start) · [Commands](#commands) · [MCP Server](#mcp-server) · [Configuration](#configuration) · [API Reference](#api-reference)

</div>

---

## Why jwt-lab?

| Feature | jwt-lab | jwt.io | Other CLIs |
|---------|---------|--------|------------|
| 🔐 Security linting & audit | ✅ 6 built-in rules | ❌ | ❌ |
| 🤖 AI-native MCP server | ✅ Full HTTP/JSON API | ❌ | ❌ |
| � Programmatic TypeScript API | ✅ ESM + CJS, `Result<T,E>` | ❌ | ❌ |
| 🔍 One-call token inspection | ✅ `inspectToken()` | ❌ | ❌ |
| �🗣️ Natural language encoding | ✅ `"admin token expires in 1h"` | ❌ | ❌ |
| ⏰ Time travel (`--fake-time`) | ✅ Deterministic testing | ❌ | ❌ |
| 📋 Config as code (`.jwt-cli.toml`) | ✅ Profiles, defaults, keys | ❌ | ❌ |
| 🎨 Premium terminal UX | ✅ Colors, boxes, tables | ❌ | Partial |
| 🔑 Key generation (RSA/EC/Ed25519) | ✅ JWK + PEM output | ❌ | Partial |
| 📦 Dual ESM + CJS output | ✅ | N/A | ❌ |
| 🧪 Strict TypeScript, zero `any` | ✅ | N/A | ❌ |

---

## Installation

```bash
# Global install (recommended for CLI)
npm install -g jwt-lab

# Or use with npx
npx jwt-lab --help

# Add to a project (as a library)
npm install jwt-lab
```

## Quick Start

### CLI

```bash
# Encode a JWT with HMAC secret
jwt encode '{"sub":"user1","role":"admin"}' --secret my-secret --exp 1h

# Decode without verification
jwt decode eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.xxx

# Verify signature + claims
jwt verify <token> --secret my-secret

# Security audit (no keys needed)
jwt explain <token>

# Inspect with full breakdown
jwt inspect <token> --secret my-secret

# Generate key pairs
jwt keygen ec --pem --out-dir ./keys

# Natural language encoding
jwt encode "admin token for user ali@example.com expires in 12h" --secret s

# Start MCP server for AI agents
jwt mcp serve --port 3000
```

### Library (TypeScript / JavaScript)

```typescript
import { inspectToken, encodeToken, verifyToken, generateKeyPair } from 'jwt-lab';

// One-call inspection: decode + verify + lint
const result = await inspectToken({
  token: 'eyJ...',
  secret: 'my-secret',
});
if (result.ok) {
  console.log(result.value.status);     // "valid" | "expired" | "not_yet_valid" | "unverified"
  console.log(result.value.algorithm);   // "HS256"
  console.log(result.value.lintFindings); // security findings
}

// Or use individual functions for fine-grained control
const token = await encodeToken({
  payload: { sub: 'user1', role: 'admin' },
  secret: 'my-secret',
  alg: 'HS256',
});

const verified = await verifyToken({
  token: token.value,
  secret: 'my-secret',
  // alg auto-detected from token header
});

// Generate keys
const keys = await generateKeyPair({ type: 'ec', format: 'jwk' });
```

---

## Commands

### `jwt encode`

Encode a JWT from JSON or natural language.

```bash
# JSON payload
jwt encode '{"sub":"user1","role":"admin","email":"user@example.com"}' \
  --secret my-secret \
  --exp 1h \
  --iss https://auth.myapp.com

# Natural language (no LLM — deterministic regex parser)
jwt encode "admin user user@example.com expires in 30m" --secret s

# With asymmetric key
jwt encode '{"sub":"svc"}' --key ./private.pem --alg ES256

# With profile from config
jwt encode '{"sub":"user1"}' --secret s --profile access_token

# Copy to clipboard
jwt encode '{"sub":"user1"}' --secret s --exp 1h --copy

# JSON output
jwt encode '{"sub":"user1"}' --secret s --json
```

**Options:**

| Flag | Description |
|------|-------------|
| `--secret <string>` | HMAC secret (HS256/384/512) |
| `--key <path>` | PEM or JWK private key file |
| `--alg <algorithm>` | Signing algorithm |
| `--exp <duration>` | Expiration (e.g., `1h`, `30m`, `7d`) |
| `--iss <string>` | Issuer claim |
| `--sub <string>` | Subject claim |
| `--aud <string>` | Audience claim |
| `--kid <string>` | Key ID in header |
| `--jti` | Generate random UUID as JTI |
| `--header <json>` | Additional header fields |
| `--profile <name>` | Use named profile from config |
| `--copy` | Copy token to clipboard |
| `--json` | Output as JSON |

---

### `jwt decode`

Decode a JWT without verification.

```bash
jwt decode <token>

# From stdin
echo "<token>" | jwt decode -

# Batch mode
cat tokens.txt | jwt decode - --batch

# JSON output
jwt decode <token> --json
```

---

### `jwt verify`

Full signature verification and claims validation.

```bash
# HMAC
jwt verify <token> --secret my-secret

# Asymmetric key
jwt verify <token> --key ./public.pem --alg ES256

# JWKS endpoint
jwt verify <token> --jwks https://auth.example.com/.well-known/jwks.json

# Required claims
jwt verify <token> --secret s --require sub,iss,exp

# Clock skew tolerance
jwt verify <token> --secret s --leeway 30

# Time travel for testing
jwt verify <token> --secret s --fake-time 2024-01-01T00:00:00Z
```

**Output:**

```
✅ Valid JWT
Algorithm: HS256
Subject:   user1
```

---

### `jwt inspect`

High-level token breakdown with status, metadata, and security posture.

```bash
jwt inspect <token>
jwt inspect <token> --secret my-secret  # with verification
jwt inspect <token> --json              # machine-readable
jwt inspect <token> --table             # table format
```

**Output:**

```
╭───── Token Inspection ──────╮
│                              │
│  Status: ✅ valid            │
│  Algorithm: HS256            │
│  Subject:   user1            │
│  Issuer:    auth.example.com │
│  Expires in: 59m 30s         │
│                              │
│  Lint Findings:              │
│  ⚠️ [pii-claims] Payload ... │
│                              │
╰──────────────────────────────╯
```

---

### `jwt explain`

Static security audit — no keys required.

```bash
jwt explain <token>
jwt explain <token> --json    # for CI pipelines
jwt explain <token> --table   # table format
```

**Output:**

```
🔍 JWT Security Audit

❌ [none-algorithm] Token uses the "none" algorithm
  → Replace "none" with a secure algorithm such as RS256 or ES256

⚠️ [pii-claims] Payload contains claims that may hold PII: email
  → Avoid embedding PII directly in JWT payloads

ℹ️ [hmac-preferred-asymmetric] Token uses HMAC algorithm (HS256)
  → Consider using an asymmetric algorithm such as RS256 or ES256
```

**Built-in security rules:**

| Rule ID | Severity | What it checks |
|---------|----------|----------------|
| `none-algorithm` | 🔴 error | Algorithm is `"none"` |
| `missing-exp` | 🟡 warn | Token has no expiration |
| `long-lived-token` | 🟡 warn | Lifetime > 24 hours |
| `pii-claims` | 🟡 warn | Claims containing PII patterns |
| `missing-nbf-long-lived` | 🔵 info | Long-lived token without `nbf` |
| `hmac-preferred-asymmetric` | 🔵 info | HMAC where asymmetric is preferred |

---

### `jwt keygen`

Generate cryptographic key pairs.

```bash
# EC key pair (default P-256)
jwt keygen ec

# RSA key pair
jwt keygen rsa --bits 4096

# Ed25519
jwt keygen ed25519

# PEM output to files
jwt keygen ec --pem --out-dir ./keys

# JWK with key ID
jwt keygen rsa --jwk --kid my-production-key
```

---

## MCP Server

jwt-lab includes a full **Model Context Protocol** HTTP/JSON server for AI agents and programmatic access.

### Start the server

```bash
jwt mcp serve --port 3000 --host 0.0.0.0
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/encode` | Encode a JWT |
| `POST` | `/decode` | Decode a JWT |
| `POST` | `/verify` | Verify a JWT |
| `POST` | `/inspect` | Inspect a JWT |
| `POST` | `/keygen` | Generate key pair |
| `POST` | `/explain` | Security audit |
| `GET` | `/docs` | OpenAPI 3.1 spec |
| `GET` | `/health` | Health check |

### Examples with curl

```bash
# Encode
curl -X POST http://localhost:3000/encode \
  -H "Content-Type: application/json" \
  -d '{"payload":{"sub":"user1"},"secret":"my-secret","alg":"HS256","exp":"1h"}'

# Decode
curl -X POST http://localhost:3000/decode \
  -H "Content-Type: application/json" \
  -d '{"token":"eyJhbGciOiJIUzI1NiJ9..."}'

# Verify
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"eyJ...","secret":"my-secret"}'

# Explain (security audit)
curl -X POST http://localhost:3000/explain \
  -H "Content-Type: application/json" \
  -d '{"token":"eyJ..."}'

# Generate key pair
curl -X POST http://localhost:3000/keygen \
  -H "Content-Type: application/json" \
  -d '{"type":"ec","format":"jwk"}'

# OpenAPI docs
curl http://localhost:3000/docs
```

### Authentication

Set the `MCP_API_KEY` environment variable to enable Bearer token authentication:

```bash
MCP_API_KEY=your-secret-key jwt mcp serve

# Then include the key in requests:
curl -X POST http://localhost:3000/encode \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"payload":{"sub":"user1"},"secret":"s","alg":"HS256"}'
```

### Security Features

- **Token redaction**: Full tokens are never logged; truncated to 20 chars
- **Claim redaction**: Configure `mcp.redactClaims` to hide sensitive claims in responses
- **Rate limiting**: Sliding window per IP (configurable)
- **CORS**: Configurable allowed origins
- **Input validation**: All requests validated with Zod schemas

---

## Configuration

Create a `.jwt-cli.toml` in your project root:

```toml
[defaults]
iss = "https://auth.myapp.com/"
aud = "myapp-api"
alg = "ES256"

[profiles.access_token]
ttl    = "15m"
scopes = ["read", "write"]

[profiles.service_token]
ttl = "1h"
aud = "internal-service"

[lint]
piiClaimPatterns = ["email", "phone", "ssn"]

[lint.severityOverrides]
"missing-exp" = "error"

[mcp]
port = 3000
redactClaims = ["email", "phone"]

[mcp.rateLimit]
windowSeconds = 60
maxRequests   = 100
```

The CLI auto-discovers `.jwt-cli.toml` by walking upward from the current directory. Use `--config <path>` to specify a custom path.

**Priority:** CLI flags > config file > built-in defaults

---

## Global Flags

| Flag | Description |
|------|-------------|
| `--help` | Show help |
| `--version` | Show version |
| `--fake-time <iso8601>` | Override system clock |
| `--config <path>` | Path to config file |
| `--json` | Machine-readable JSON output |

---

## API Reference

### Core Library

jwt-lab's core is a pure, I/O-free TypeScript library (except for OIDC/JWKS which makes HTTP requests). All functions return `Result<T, E>` types — no exceptions thrown.

```typescript
import {
  // High-level
  inspectToken,        // decode + verify + lint in one call

  // Low-level building blocks
  encodeToken,         // sign a JWT
  decodeToken,         // decode without verification
  verifyToken,         // verify signature + claims
  lintToken,           // security audit (no keys needed)
  generateKeyPair,     // RSA, EC, Ed25519 key pairs
  parseDuration,       // "1h30m" → 5400 seconds
  parseNaturalLanguagePayload,  // NLP → JWT payload

  // OIDC / JWKS
  resolveOidcJwksUri,  // fetch JWKS URI from OIDC discovery
  buildDiscoveryUrl,   // issuer → discovery URL
} from 'jwt-lab';
```

#### `inspectToken(opts)` — High-Level API

The `inspectToken` function is the library equivalent of `jwt inspect` and `jwt verify --oidc-discovery`. It composes decode → OIDC discovery → verify → lint in a single call:

```typescript
import { inspectToken } from 'jwt-lab';

// With HMAC secret
const result = await inspectToken({
  token: 'eyJ...',
  secret: 'my-secret',
});

// With OIDC discovery (auto-resolves JWKS)
const result = await inspectToken({
  token: 'eyJ...',
  oidcDiscoveryUrl: 'https://accounts.google.com',
});

// With asymmetric key (auto-detects algorithm from token header)
const result = await inspectToken({
  token: 'eyJ...',
  publicKeyPem: '-----BEGIN PUBLIC KEY-----\n...',
});

// Decode + lint only (no key → status = "unverified")
const result = await inspectToken({ token: 'eyJ...' });

if (result.ok) {
  const { status, algorithm, issuer, subject, expiresAt,
          customClaims, verificationResult, lintFindings } = result.value;
  // status: "valid" | "expired" | "not_yet_valid" | "unverified"
}
```

**`InspectTokenOptions`:**

| Option | Type | Description |
|--------|------|-------------|
| `token` | `string` | JWT string (required) |
| `secret` | `string` | HMAC secret |
| `publicKeyPem` | `string` | PEM-encoded public key |
| `publicKeyJwk` | `object` | JWK public key |
| `jwksUri` | `string` | Remote JWKS endpoint |
| `oidcDiscoveryUrl` | `string` | OIDC discovery URL (auto-resolves JWKS) |
| `alg` | `SupportedAlgorithm` | Expected algorithm (auto-detected if omitted) |
| `requiredClaims` | `string[]` | Claims that must be present |
| `leewaySeconds` | `number` | Clock skew tolerance |
| `lintConfig` | `LintConfig` | Lint rule overrides |
| `now` | `Date` | Clock override for testing |

**`InspectResult`:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"valid" \| "expired" \| "not_yet_valid" \| "unverified"` | Overall token status |
| `algorithm` | `string` | Algorithm from the header |
| `kid` | `string?` | Key ID from the header |
| `issuer` | `string?` | `iss` claim |
| `subject` | `string?` | `sub` claim |
| `audience` | `string \| string[]?` | `aud` claim |
| `issuedAt` | `Date?` | `iat` as Date |
| `expiresAt` | `Date?` | `exp` as Date |
| `notBefore` | `Date?` | `nbf` as Date |
| `timeUntilExpiry` | `number?` | Seconds until expiry (negative = expired) |
| `customClaims` | `Record<string, unknown>` | Non-standard claims |
| `verificationResult` | `Result<true, VerifyError>?` | Signature check result |
| `lintFindings` | `LintFinding[]` | Security audit findings |

#### Low-Level Functions

```typescript
// Encode a JWT
const token = await encodeToken({
  payload: { sub: 'user1', role: 'admin' },
  secret: 'my-secret',
  alg: 'HS256',
});

// Decode without verification
const decoded = decodeToken('eyJ...');
// → { header, payload, signaturePresent }

// Verify signature + claims
const verified = await verifyToken({
  token: 'eyJ...',
  secret: 'my-secret',
  // alg auto-detected from header if omitted
});

// Security audit (no keys needed)
const decoded = decodeToken('eyJ...');
const findings = lintToken(decoded.value, {
  piiClaimPatterns: ['email', 'phone'],
});

// Generate key pairs
const keys = await generateKeyPair({
  type: 'ec',       // 'rsa' | 'ec' | 'ed25519'
  format: 'jwk',    // 'jwk' | 'pem'
  kid: 'my-key-id',
});

// Parse durations
const seconds = parseDuration('1h30m');
// → { ok: true, value: 5400 }

// Natural language → payload
const payload = parseNaturalLanguagePayload(
  'admin token for user ali@example.com expires in 1h',
  new Date()
);
// → { ok: true, value: { exp: ..., sub: 'ali@example.com', email: '...', role: 'admin' } }
```

#### Algorithm Auto-Detection

`verifyToken` and `inspectToken` auto-detect the signing algorithm from the JWT header when `alg` is not explicitly provided. This means you can verify tokens without knowing the algorithm in advance:

```typescript
// No need to specify alg — auto-detected from the token header
const result = await verifyToken({
  token: ecSignedJwt,
  publicKeyPem: ecPublicKey,
});
```

See [`src/core/`](src/core/) for full API documentation with TSDoc comments.

### Examples

The [`examples/api-usage/`](examples/api-usage/) directory contains runnable TypeScript examples:

| Script | Description |
|--------|-------------|
| `npm start` | All core functions: encode, decode, verify, lint, keygen, inspectToken, NLP |
| `npm run inspect-local` | `inspectToken` with local keys (HMAC, EC, expired, no-key) |
| `npm run verify-asymmetric` | All asymmetric algorithms + auto-detection (EC, RSA, Ed25519) |
| `npm run nlp-encode` | Natural language → JWT payload → encode → decode round-trip |
| `npm run oidc-inspect` | OIDC token inspection with a single `inspectToken` call |

```bash
cd examples/api-usage
npm install
npm start                   # run main examples
npm run inspect-local       # inspectToken with local keys
npm run verify-asymmetric   # EC, RSA, Ed25519 verification
npm run nlp-encode          # natural language encoding
```

---

## Tech Stack

| Category | Choice |
|----------|--------|
| Language | TypeScript 6 (strict mode, zero `any`) |
| Runtime | Node.js ≥ 22 |
| JWT | [`jose`](https://github.com/panva/jose) v6 |
| CLI | [`commander`](https://github.com/tj/commander.js) v14 |
| Validation | [`zod`](https://github.com/colinhacks/zod) v4 |
| HTTP | [`hono`](https://hono.dev) + `@hono/node-server` |
| Build | [`tsup`](https://github.com/egoist/tsup) (dual ESM + CJS) |
| Tests | [`vitest`](https://vitest.dev) v4 |
| Terminal | `picocolors`, `boxen`, `ora`, `cli-table3` |

---

## Shell Completions

jwt-lab ships with built-in tab-completion scripts for **Bash**, **Zsh**, and **Fish**. The completions are aware of every subcommand and flag — pressing `Tab` surfaces commands, options, algorithm names, and file paths in context.

### How it works

The `jwt completions <shell>` command prints a shell-specific completion script to stdout. You either `eval` it at shell startup or write it to a file that your shell auto-loads. No third-party tools are required.

```
jwt completions bash   →  prints a Bash completion function + `complete -F` binding
jwt completions zsh    →  prints a Zsh `_jwt` compdef function
jwt completions fish   →  prints Fish `complete` directives
```

### Bash

**One-liner (current session only):**
```bash
eval "$(jwt completions bash)"
```

**Persistent — add to `~/.bashrc`:**
```bash
echo 'eval "$(jwt completions bash)"' >> ~/.bashrc
source ~/.bashrc
```

**Or save to the system completions directory (recommended for shared machines):**
```bash
jwt completions bash | sudo tee /etc/bash_completion.d/jwt > /dev/null
```

> Requires `bash-completion` package. Install with `brew install bash-completion` on macOS or `apt install bash-completion` on Debian/Ubuntu.

### Zsh

**One-liner (current session only):**
```zsh
eval "$(jwt completions zsh)"
```

**Persistent — add to `~/.zshrc`:**
```zsh
echo 'eval "$(jwt completions zsh)"' >> ~/.zshrc
source ~/.zshrc
```

**Or save to a `$fpath` directory (the clean approach):**
```zsh
# Pick any directory already in your fpath, or create one
mkdir -p ~/.zsh/completions
jwt completions zsh > ~/.zsh/completions/_jwt

# Make sure the directory is in fpath — add to ~/.zshrc if not already there:
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -Uz compinit && compinit' >> ~/.zshrc
source ~/.zshrc
```

> **oh-my-zsh users:** Save to `~/.oh-my-zsh/completions/_jwt` — it's already in `fpath`.

### Fish

Fish completions are discovered automatically from `~/.config/fish/completions/`. Just save the script there:

```fish
jwt completions fish > ~/.config/fish/completions/jwt.fish
```

Completions take effect immediately — no `source` or restart needed.

### What gets completed

| Context | Completions offered |
|---------|---------------------|
| `jwt <Tab>` | All subcommands with descriptions |
| `jwt encode <Tab>` | `--secret`, `--key`, `--alg`, `--exp`, `--iss`, `--json`, … |
| `jwt verify <Tab>` | `--secret`, `--key`, `--jwks`, `--oidc-discovery`, `--alg`, `--require`, `--leeway`, … |
| `jwt keygen <Tab>` | Algorithm types: `RS256 RS384 RS512 ES256 ES384 ES512 EdDSA PS256 PS384 PS512` |
| `jwt --alg <Tab>` | Full algorithm list |
| `--key <Tab>` | File path completion (all shells) |
| `--config <Tab>` | File path completion (all shells) |
| `jwt completions <Tab>` | `bash  zsh  fish` |

---

## CI/CD & Publishing

Every push and pull request to `main` runs the full pipeline:

| Job | Steps |
|-----|-------|
| **Test & Build** | lint → type-check → tests → build → CLI smoke test (Node 22 & 24) |
| **Security Audit** | `npm audit` at moderate severity |
| **CodeQL** | Static analysis for JavaScript/TypeScript (separate scheduled workflow) |
| **Publish** | Runs only on `v*` tag push → bumps version → builds → publishes to npm with provenance |

### Publishing a release

```bash
# 1. Bump version
npm version 1.0.0 --no-git-tag-version
git add package.json && git commit -m "chore: bump version to 1.0.0"
git push origin main

# 2. Create a GPG-signed annotated tag
git tag -s v1.0.0 -m "Release v1.0.0"
git tag -v v1.0.0  # verify signature

# 3. Push tag — triggers the publish workflow
git push origin v1.0.0

# 4. Create a signed GitHub Release
gh release create v1.0.0 --title "v1.0.0" --notes "Release notes here" --verify-tag
```

For a **prerelease** (e.g. `v1.1.0-beta.1`), the package is published with the `beta` dist-tag automatically.

> The workflow uses `npm publish --provenance`, which attaches a cryptographic SLSA Level 2 attestation proving the package was built from this exact commit.

### Required repository secret

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm Automation token with **publish** access — add at *Settings → Secrets → Actions* |

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint

# Start MCP server (dev)
npm run dev:mcp
```

## CI/CD & Publishing

Every push and pull request to `main` runs the full pipeline:

| Job | Steps |
|-----|-------|
| **Test & Build** | lint → type-check → tests → build → CLI smoke test (Node 22 & 24) |
| **Security Audit** | `npm audit` at moderate severity |
| **CodeQL** | Static analysis for JavaScript/TypeScript (separate scheduled workflow) |
| **Publish** | Runs only on GitHub Release publish → bumps version → builds → publishes to npm |

### Publishing a release

1. Create and push a tag: `git tag v1.0.0 && git push origin v1.0.0`
2. Create a GitHub Release from that tag (set it to **Published**, not Draft)
3. The pipeline auto-bumps `package.json`, builds, and publishes to npm

For a prerelease (e.g. `v1.1.0-beta.1`), the package is published with the `beta` dist-tag automatically.

### Required repository secret

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | npm automation token with **publish** access — add in *Settings → Secrets → Actions* |

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE) © jwt-lab contributors

---

<div align="center">

**Built with ❤️ for developers and AI agents**

[Report Bug](https://github.com/alishah730/jwt-lab/issues) · [Request Feature](https://github.com/alishah730/jwt-lab/issues) · [Discussions](https://github.com/alishah730/jwt-lab/discussions)

</div>
