# Contributing to jwt-lab

Thank you for your interest in contributing to jwt-lab! This guide will help you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/jwt-lab.git
cd jwt-lab

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Project Structure

```
src/
  core/       # Pure functions — JWT logic, no I/O
  cli/        # Commander CLI wiring + command handlers
  mcp/        # Hono HTTP server, middleware, routes
  config/     # TOML config loading + Zod validation
  ui/         # Terminal formatting (colors, tables, boxes)
tests/
  unit/       # Unit tests for core modules
  integration/
    cli/      # CLI integration tests (execa)
    mcp/      # MCP server tests (Hono test client)
```

## Architecture Rules

1. **`src/core/` is pure** — no I/O, no `fs`, no `fetch`, no `process.env`
2. **CLI and MCP share core** — never duplicate JWT logic
3. **Result types** — core functions return `Result<T, E>`, never throw
4. **Zod everywhere** — all external input validated with Zod schemas
5. **No `any`** — strict TypeScript, the build fails on `any`

## Pull Request Process

1. Fork and create a feature branch from `main`
2. Write tests for new features
3. Ensure all tests pass: `npm test`
4. Ensure TypeScript compiles: `npx tsc --noEmit`
5. Ensure linting passes: `npm run lint`
6. Update README.md if adding new commands or options
7. Add a changeset: `npm run changeset`
8. Open a PR against `main`

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `test:` Adding or updating tests
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `chore:` Build process or auxiliary tool changes

## Adding a New Lint Rule

1. Define the rule in `src/core/linter.ts` as a `LintRule` object
2. Add it to the `BUILT_IN_RULES` array
3. Write unit tests in `tests/unit/linter.test.ts`
4. Document it in the README

## Adding a New MCP Endpoint

1. Create a Zod schema in `src/mcp/schemas.ts`
2. Create a route handler in `src/mcp/routes/`
3. Register the route in `src/mcp/app.ts`
4. Add the endpoint to the OpenAPI spec in `app.ts`
5. Write integration tests in `tests/integration/mcp/`

## Code of Conduct

Be kind, be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
