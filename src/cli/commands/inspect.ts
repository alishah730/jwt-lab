/**
 * CLI command for inspecting JWT tokens — provides a high-level breakdown
 * of a token's status, metadata, and security posture.
 *
 * Delegates to the core `inspectToken` function so the CLI and library
 * produce identical results.
 */
import { Command } from "commander";
import * as fs from "node:fs";
import {
  EXIT_CODES,
  type InspectResult,
  type SupportedAlgorithm,
} from "../../core/types.js";
import { inspectToken, type InspectTokenOptions } from "../../core/inspect.js";
import {
  resolveTokenInput,
  readStdinLines,
  resolveConfig,
  exitWithError,
} from "../helpers.js";
import { formatInspectResult } from "../../ui/format.js";
import { buildInspectTable } from "../../ui/table.js";
import { mergeConfig } from "../../config/index.js";
import pc from "picocolors";

/** Options accepted by the inspect subcommand. */
interface InspectOptions {
  secret?: string;
  key?: string;
  jwks?: string;
  oidcDiscovery?: string;
  alg?: string;
  json?: boolean;
  table?: boolean;
  batch?: boolean;
}

/** Global options inherited from the root program. */
interface GlobalOptions {
  json?: boolean;
  fakeTime?: string;
  config?: string;
}

/**
 * Reads a PEM or JWK key file from disk.
 *
 * @param keyPath - Path to the key file.
 * @returns The file contents as a string.
 */
function readKeyFile(keyPath: string): string {
  try {
    return fs.readFileSync(keyPath, "utf8");
  } catch {
    exitWithError(
      `Cannot read key file: ${keyPath}`,
      "Check that the file exists and is readable.",
    );
  }
}

/**
 * Parses a key file string as either a JWK (JSON) or PEM.
 *
 * @param contents - Raw file contents.
 * @returns An object with either `publicKeyJwk` or `publicKeyPem` set.
 */
function parseKeyContents(
  contents: string,
): { publicKeyJwk: Record<string, unknown> } | { publicKeyPem: string } {
  const trimmed = contents.trim();
  if (trimmed.startsWith("{")) {
    try {
      return { publicKeyJwk: JSON.parse(trimmed) as Record<string, unknown> };
    } catch {
      exitWithError("Key file looks like JSON but could not be parsed as JWK.");
    }
  }
  return { publicKeyPem: trimmed };
}

/**
 * Serializes an InspectResult to a JSON-safe object with ISO date strings.
 *
 * @param result - The inspection result to serialize.
 * @returns A plain object suitable for JSON.stringify.
 */
function serializeInspectResult(result: InspectResult): Record<string, unknown> {
  return {
    status: result.status,
    algorithm: result.algorithm,
    ...(result.kid !== undefined ? { kid: result.kid } : {}),
    ...(result.issuer !== undefined ? { issuer: result.issuer } : {}),
    ...(result.subject !== undefined ? { subject: result.subject } : {}),
    ...(result.audience !== undefined ? { audience: result.audience } : {}),
    ...(result.issuedAt !== undefined
      ? { issuedAt: result.issuedAt.toISOString() }
      : {}),
    ...(result.expiresAt !== undefined
      ? { expiresAt: result.expiresAt.toISOString() }
      : {}),
    ...(result.notBefore !== undefined
      ? { notBefore: result.notBefore.toISOString() }
      : {}),
    ...(result.timeUntilExpiry !== undefined
      ? { timeUntilExpiry: result.timeUntilExpiry }
      : {}),
    customClaims: result.customClaims,
    lintFindings: result.lintFindings,
    ...(result.verificationResult !== undefined
      ? {
          verificationResult: result.verificationResult.ok
            ? { ok: true }
            : { ok: false, error: result.verificationResult.error },
        }
      : {}),
  };
}

/**
 * Builds and returns the `inspect` subcommand.
 *
 * @returns A configured Commander `Command` instance for `jwt inspect`.
 */
export function buildInspectCommand(): Command {
  return new Command("inspect")
    .description(
      "Inspect a JWT token — show status, metadata, and security posture",
    )
    .argument("<token>", "JWT string or - to read from stdin")
    .option("--secret <string>", "HMAC secret for signature verification")
    .option("--key <path>", "path to PEM or JWK public key file")
    .option("--jwks <url>", "JWKS endpoint URL")
    .option("--oidc-discovery <url>", "OpenID Connect discovery URL to auto-resolve JWKS")
    .option("--alg <algorithm>", "expected algorithm")
    .option("--json", "output machine-readable JSON")
    .option("--table", "output as a table instead of boxed text")
    .option("--batch", "read newline-separated tokens from stdin")
    .action(async (tokenArg: string, opts: InspectOptions, cmd: Command) => {
      const globalOpts = (cmd.parent?.opts() ?? {}) as GlobalOptions;
      const useJson = opts.json === true || globalOpts.json === true;

      // Load config
      const fileConfig = await resolveConfig(globalOpts.config);
      const config = mergeConfig(fileConfig, {});

      // Resolve --fake-time
      let now = new Date();
      if (globalOpts.fakeTime !== undefined) {
        const parsed = new Date(globalOpts.fakeTime);
        if (isNaN(parsed.getTime())) {
          exitWithError(
            `Invalid --fake-time value: ${globalOpts.fakeTime}`,
            "Use an ISO 8601 date string, e.g. 2024-01-01T00:00:00Z",
          );
        }
        now = parsed;
      }

      // Resolve key material from file
      let keyMaterial:
        | { publicKeyJwk: Record<string, unknown> }
        | { publicKeyPem: string }
        | undefined;
      if (opts.key !== undefined) {
        const contents = readKeyFile(opts.key);
        keyMaterial = parseKeyContents(contents);
      }

      /**
       * Builds InspectTokenOptions from CLI flags.
       */
      function buildOpts(rawToken: string): InspectTokenOptions {
        return {
          token: rawToken,
          secret: opts.secret,
          ...(keyMaterial ?? {}),
          jwksUri: opts.jwks,
          oidcDiscoveryUrl: opts.oidcDiscovery,
          alg: opts.alg as SupportedAlgorithm | undefined,
          lintConfig: config.lint ?? {},
          now,
        };
      }

      /**
       * Processes a single token string and outputs the inspection result.
       *
       * @param rawToken - The raw JWT string to inspect.
       * @returns EXIT_CODES.SUCCESS or EXIT_CODES.USER_ERROR.
       */
      async function processToken(rawToken: string): Promise<number> {
        const result = await inspectToken(buildOpts(rawToken));

        if (!result.ok) {
          if (useJson) {
            console.log(
              JSON.stringify({ error: result.error.message, code: result.error.code }),
            );
          } else {
            console.error(pc.red(`Error: ${result.error.message}`));
          }
          return EXIT_CODES.USER_ERROR;
        }

        if (useJson) {
          console.log(JSON.stringify(serializeInspectResult(result.value)));
        } else if (opts.table === true) {
          console.log(buildInspectTable(result.value));
        } else {
          console.log(formatInspectResult(result.value));
        }

        return EXIT_CODES.SUCCESS;
      }

      // Batch mode
      if (opts.batch === true) {
        const lines = await readStdinLines();
        let hasFailure = false;

        for (const line of lines) {
          const code = await processToken(line);
          if (code !== EXIT_CODES.SUCCESS) {
            hasFailure = true;
          }
          if (!useJson) {
            console.log("---");
          }
        }

        process.exit(hasFailure ? EXIT_CODES.USER_ERROR : EXIT_CODES.SUCCESS);
      }

      // Single token mode
      const token = await resolveTokenInput(tokenArg);
      const code = await processToken(token);
      process.exit(code);
    });
}
