You are an expert TypeScript CLI and backend developer.

Your task: **Design and implement a complete, production‑ready npm package** called **`jwt-cli`** that is both:


1. A **modern JWT command‑line tool** with a premium UX.
2. A **Model Context Protocol (MCP) server** exposing the same capabilities over HTTP/JSON for AI agents.


The result must be a real, installable, well‑tested project with clear structure, strict types, and security‑first defaults.


---


## High‑level vision


Build a **JWT Swiss‑army knife** for developers and AI agents:


- Full JWT lifecycle: design, encode, decode, verify, inspect, lint, key management, and security auditing.
- **Security‑opinionated**: embed modern JWT best practices; do NOT be a dumb wrapper around a JWT library.
- **AI‑native**: expose an HTTP/JSON MCP server that is safe for LLM tool‑use (redaction, constraints, clear schemas).
- **Premium DX**: feels like `httpie` + `jq` in the terminal; fast, beautiful, and script‑friendly.


The CLI and MCP server MUST share core logic (no duplication).


---


## Tech stack (required)


Implement using exactly this stack:


- **Language & runtime**
  - TypeScript, strict mode: `strict: true`, `noImplicitAny`, `strictNullChecks`, no `any`
  - Node.js ≥ 18


- **Core libraries**
  - JWT: [`jose`](https://github.com/panva/jose) (JWS + JWE). **Never** use `jsonwebtoken`.
  - CLI parsing: `commander`
  - Validation: `zod` (all external inputs, including CLI flags/env/HTTP JSON, must be validated with Zod)
  - HTTP/MCP server: `hono` + `@hono/node-server` (Node ≥ 18, lightweight & fast)
  - Terminal UX: `picocolors`, `boxen`, `ora`, `table` (or `cli-table3`)


- **Tooling**
  - Bundler: `tsup` (dual ESM + CJS output; proper shebang for CLI)
  - Tests: Vitest + `@vitest/ui`
  - Linting/formatting: ESLint (flat config) + `typescript-eslint` + Prettier
  - Versioning: `changesets`


No extra runtime deps beyond what is listed above unless absolutely necessary and justified.


---


## Project structure


Design a clean, maintainable layout. For example:


- `src/cli/` – CLI entrypoint + commander wiring.
- `src/core/` – pure JWT logic, key handling, linting, security analysis (no I/O side‑effects).
- `src/mcp/` – Hono app, routing, auth, OpenAPI spec.
- `src/config/` – config loading (`.jwt-cli.toml`), environment handling.
- `src/ui/` – terminal formatting helpers (colors, tables, boxes, emojis).
- `tests/` – unit + integration tests.


The CLI and MCP server MUST consume functions from `src/core/`, not reimplement behavior.


---


## Package & build requirements


- Package name: `jwt-cli`
- Description:
  `A fast, secure, beautiful, and AI-agent-ready command-line tool for working with JSON Web Tokens (JWTs), plus a full Model Context Protocol (MCP) server.`
- `bin` field: `"jwt": "dist/cli.js"` (with shebang and executable bit).
- Build with `tsup`:
  - Output both **ESM and CJS**.
  - Tree‑shakable core.
  - Generate type declarations.
- Compatible with global install: `npm install -g jwt-cli`
- Zero runtime deps beyond:
  - `jose`, `commander`, `zod`, `hono`, `@hono/node-server`, `picocolors`, `boxen`, `ora`, `table` (or similar).
- Provide:
  - `npm run build`
  - `npm run test`
  - `npm run lint`
  - `npm run mcp:serve`
  - `npm run dev:mcp` (watch mode)
  - `npm run changeset` (for releases)


---


## Global behavior & UX


- Global flags:
  - `--help`
  - `--version`
  - `--fake-time <ISO or duration>` (global override, used by verify/inspect/explain)
  - `--config <path>` (default: `.jwt-cli.toml` in CWD or parents)
- Stdin support:
  - Commands that accept a token or payload must accept `-` to read from stdin.
- Clipboard:
  - `--copy` flag to copy the resulting token (or key) to clipboard when available (implement with optional dependency or platform‑specific handling).
- Output modes:
  - Pretty interactive / colored output (default).
  - `--json` for machine‑readable output (stable schema, no colors).
- Parallel batch:
  - All token‑accepting commands should support reading line‑separated tokens from stdin and processing in parallel batches when `--batch` is set.


Error handling:


- No raw stack traces by default.
- Use colors, emojis, and **actionable suggestions** (e.g., “Token expired 2h ago; use `--fake-time` to test at a specific instant”).
- Exit codes:
  - `0` success
  - `1` user / token / validation error
  - `2` internal error / bug


---


## Config as code


Support a TOML config file `.jwt-cli.toml`:


- Example structure:


  ```toml
  [defaults]
  iss = "https://auth.myapp.com/"
  aud = "myapp-api"
  alg = "RS256"
  jwks = "https://auth.myapp.com/.well-known/jwks.json"


  [keys."my-rs256-key"]
  type = "rsa"
  privateKeyPath = "./keys/jwt-rs256.pem"
  publicKeyPath = "./keys/jwt-rs256.pub"


  [profiles.access_token]
  ttl = "15m"
  scopes = ["read", "write"]


  [profiles.service_token]
  ttl = "1h"
  aud = "internal-service"
  ```


- Implement:
  - Search for `.jwt-cli.toml` from CWD upward unless `--config` is passed.
  - Merge config defaults with CLI flags (CLI overrides config).


Use Zod schemas to validate config and surface clear errors.


---


## Core commands (implement all)


### 1. `jwt encode <payload | "natural language description"> [options]`


- Two input modes:
  1. **JSON mode**:
     - `payload` is JSON string or `-` from stdin.
  2. **Natural language mode**:
     - If the first argument is not valid JSON, treat it as a natural‑language description, e.g.:
       `"admin token for user user@example.com that expires in 12 hours with roles: admin,editor"`.
     - Implement a deterministic parser (no external LLM calls) that:
       - Extracts common fields (sub, email, roles, exp).
       - Fills in `exp` based on phrases like “in 12 hours”, “for 30 minutes”, “for 1 day”.
       - Maps “roles: a,b,c” into a `roles` array claim.
- Options:
  - Signing options:
    - `--secret <string>` (HMAC)
    - `--key <path>` (PEM/JWK)
    - `--alg <alg>` (all jose‑supported algs; warn loudly on `"none"`)
  - Header:
    - `--header <json>`
    - `--kid <string>` (sets `kid` in header)
  - Standard claims:
    - `--exp <duration|ISO>`
    - `--iat <ISO>`
    - `--nbf <duration|ISO>`
    - `--iss <string>`
    - `--sub <string>`
    - `--aud <string>`
    - `--jti <string>`
  - Output:
    - `--pretty` (default)
    - `--json`
    - `--copy`


Implementation notes:


- Reuse a Zod‑based “duration or ISO time” parser.
- Use `jose` for signing.
- Print both the token and a quick one‑line summary (`alg`, `kid`, `exp in XXX`, `sub`, `aud`).


### 2. `jwt decode <token | ->`


- Decode without verification.
- Show:
  - Header (pretty colored JSON)
  - Payload (pretty colored JSON)
  - Signature (hex/length info, but never log secret keys)
- Options:
  - `--json` for structured header/payload/signature JSON.
- If read from stdin, support:
  - Single token
  - Batch tokens (one per line) with `--batch`.


### 3. `jwt verify <token | ->`


- Full verification **and** claims validation.
- Options:
  - Signing sources:
    - `--secret <string>`
    - `--key <path>`
    - `--jwks <url>` (remote JWKS with local in‑memory caching; cache key = URL + kid)
  - Constraints:
    - `--alg <alg or list>`
    - `--require <claim1,claim2,...>` (these claims must be present)
    - `--leeway <seconds>` (for exp/nbf skew)
  - Time travel:
    - `--fake-time <ISO>` (or global `--fake-time`)
- Behavior:
  - Verify signature with `jose`.
  - Validate `exp`, `nbf`, `iat`, `iss`, `aud`, `typ` using safe defaults.
  - On success:
    - Print “✅ Valid JWT” with short summary and remaining TTL.
  - On failure:
    - Print clear reason with suggestions (e.g., wrong audience, expired, unsupported alg).
    - Map errors to consistent JSON in `--json` mode.


### 4. `jwt inspect <token | ->`


- High‑level breakdown:
  - Overall status (valid / invalid / unverifiable).
  - Expiration countdown (“expires in 14m” or “expired 2h 13m ago”).
  - Basic metadata: `alg`, `kid`, `iss`, `sub`, `aud`, `iat`, `exp`.
  - Security notes: e.g., “Missing exp claim”, “Symmetric key used with public audience”.
- Uses same verification core but can be run without keys for partial insight.
- Optionally accepts `--jwks`, `--secret`, `--key` to perform full verification.


### 5. `jwt keygen <type>`


- Types:
  - `rsa`
  - `ec`
  - `ed25519` (and other supported EdDSA variants)
- Behavior:
  - Generate key pair.
  - Output:
    - PEM (private + public)
    - JWK (private + public)
  - Options:
    - `--jwk`
    - `--pem`
    - `--out-dir <path>`
    - `--kid <string>`
  - Provide friendly guidance on where to store keys and how to reference them.


### 6. `jwt explain <token>`


- Static security audit without requiring keys.
- Behavior:
  - Decode token.
  - Analyze:
    - Algorithm strength (HS256 vs RS256 vs ES256 vs none).
    - Presence/absence of `exp`, `iat`, `nbf`, `iss`, `aud`.
    - Token length (oversized claims).
    - Suspicious patterns (e.g., alg: none, missing exp, wildcards in aud).
  - Output:
    - A ranked list of issues (error/warn/info) with:
      - ID
      - Description
      - Suggested fix (“Set exp to ≤ 15 minutes for public web tokens”).
    - `--json` for structured audit output (for CI).


### 7. `jwt mcp serve [options]`


Implement a **Model Context Protocol‑style HTTP/JSON server** using Hono + `@hono/node-server`.


- Server:
  - Start with `jwt mcp serve --port 8080 --host 0.0.0.0`.
  - Use Hono routes for all endpoints.
  - Integrate Zod for request/response validation and type inference.
- Endpoints:
  - `POST /encode`
  - `POST /decode`
  - `POST /verify`
  - `POST /inspect`
  - `POST /keygen`
  - `POST /explain`
- Requirements:
  - Strict JSON schemas for all endpoints with Zod.
  - Automatically generate OpenAPI/Swagger docs at `/docs`.
  - CORS enabled (configurable allowed origins).
  - Optional API key auth via header (e.g., `x-api-key`) with config.
  - Basic rate limiting (per IP or API key) with sane defaults.


Security / privacy for MCP:


- **Never** log full raw tokens; at most log:
  - alg, kid, iss, aud, exp timestamps, and a hash of the token.
- Provide a config option to **redact** sensitive claims in responses (e.g., email, name).
- By default, return:
  - header (full)
  - payload with configurable redactions
  - no raw signature in logs


All MCP handlers must reuse the same `src/core` logic as the CLI, just wrapping it in HTTP.


### 8. `jwt shell`


- Interactive REPL:
  - Prompt with something like `jwt>`.
  - Features:
    - Command history.
    - Tab completion for subcommands and common flags.
    - Live token preview: as you edit payload or claims, show decoded summary in a side panel.
  - Support:
    - `encode`, `decode`, `verify`, `inspect`, `explain` sub‑modes.
- Implementation can wrap commander subcommands in an interactive interface.
- Use `ora`, `boxen`, `picocolors`, `table` to create a polished TUI.


---


## Additional security & linting features


Beyond the explicit commands, implement:


- A shared **linting / security analysis module** that:
  - Implements rules for:
    - Missing or long `exp`
    - No `nbf` for long‑lived tokens
    - Weak algorithms (HS256 for 3rd‑party clients)
    - Sensitive PII claims inside the token
  - Exposes these rules to:
    - `jwt inspect`
    - `jwt explain`
    - MCP `/inspect` and `/explain`.


- Future‑proof rule system:
  - Simple configuration to enable/disable rules by ID.
  - Severity levels (info/warn/error).


---


## Tests


Use Vitest for:


- Unit tests for:
  - Duration parsing.
  - Token generation (using deterministic keys).
  - Config loading and merging.
  - Security lint rules.
- Integration tests for:
  - CLI commands (using `execa` or similar) with snapshot tests for pretty output and json output.
  - MCP HTTP endpoints (using `hono`’s testing utilities or supertest‑like tools).


Make tests deterministic and independent of the current time by using fixed fake times.


---


## Documentation


Produce:


- A rich `README.md` including:
  - Installation (`npm install -g jwt-cli`).
  - CLI usage examples for each command.
  - MCP server usage with curl examples.
  - Example `.jwt-cli.toml`.
- Inline JSDoc / TSDoc for all public functions in `src/core`.


---


## Implementation style


- No `any`. Use Zod inference and discriminated unions where appropriate.
- Prefer small, composable functions over large monoliths.
- Keep I/O (CLI, HTTP) thin and delegate to pure core functions.
- Ensure that:
  - `jwt encode` / `decode` / `verify` / `inspect` / `explain` use the same core helpers as MCP.
  - MCP and CLI stay in sync behavior‑wise.


---


**Deliverables for this task:**


1. `package.json` with the described scripts, bin, and dependencies.
2. `tsconfig.json` with strict TypeScript configuration.
3. `tsup.config.ts` for dual build.
4. ESLint + Prettier flat configs.
5. Source code implementing all commands and MCP server.
6. Vitest test suite with good coverage.
7. Example `.jwt-cli.toml`.
8. `README.md` documenting usage, config, and MCP APIs.


Focus on correctness, security, UX polish, and reuse between CLI and MCP server.
