/**
 * CLI command for verifying JWT signatures and validating claims.
 */
import { Command } from "commander";
import * as fs from "node:fs";
import { verifyToken } from "../../core/verify.js";
import { EXIT_CODES, type SupportedAlgorithm } from "../../core/types.js";
import {
  resolveTokenInput,
  readStdinLines,
  resolveConfig,
  exitWithError,
} from "../helpers.js";
import { formatVerifyResult, type VerifyResult } from "../../ui/format.js";
import { mergeConfig } from "../../config/index.js";
import { resolveOidcJwksUri } from "../../core/jwks.js";
import pc from "picocolors";

/** Options accepted by the verify subcommand. */
interface VerifyOptions {
  secret?: string;
  key?: string;
  jwks?: string;
  oidcDiscovery?: string;
  alg?: string;
  require?: string;
  leeway?: string;
  json?: boolean;
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
 * @throws If the file cannot be read.
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
 * Returns an object with either `publicKeyJwk` or `publicKeyPem` set.
 *
 * @param contents - Raw file contents.
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
 * Builds a suggestion string for a given verify failure reason.
 *
 * @param reason - The failure reason from VerifyError.
 * @param opts   - The CLI options (used to show expected alg).
 * @param actualAlg - The algorithm found in the token header, if known.
 * @returns A hint string, or undefined if no specific hint applies.
 */
function buildSuggestion(
  reason: string,
  opts: VerifyOptions,
  actualAlg?: string,
): string | undefined {
  switch (reason) {
    case "expired":
      return "Use --fake-time to test with a different clock value.";
    case "algorithm_mismatch":
      if (opts.alg !== undefined && actualAlg !== undefined) {
        return `Expected algorithm ${opts.alg} but token uses ${actualAlg}.`;
      }
      return "Use --alg to specify the expected algorithm.";
    case "missing_claim":
      return "Add the required claim to the token payload or remove it from --require.";
    default:
      return undefined;
  }
}

/**
 * Builds an additional hint when the verify error mentions JWKS key-not-found.
 *
 * @param message - The error message from the jose library.
 * @param opts    - CLI options to determine JWKS source.
 * @returns An extra hint string, or undefined.
 */
function buildJwksHint(
  message: string,
  opts: VerifyOptions,
): string | undefined {
  if (
    message.includes("no applicable key found") &&
    (opts.jwks !== undefined || opts.oidcDiscovery !== undefined)
  ) {
    return "The JWKS endpoint did not contain a key matching this token's kid. Verify the token was issued by the same provider.";
  }
  return undefined;
}

/**
 * Builds and returns the `verify` subcommand.
 *
 * @returns A configured Commander `Command` instance for `jwt verify`.
 */
export function buildVerifyCommand(): Command {
  return new Command("verify")
    .description("Verify a JWT signature and validate its claims")
    .argument("<token>", "JWT string or - to read from stdin")
    .option("--secret <string>", "HMAC secret")
    .option("--key <path>", "path to PEM or JWK public key file")
    .option("--jwks <url>", "JWKS endpoint URL")
    .option("--oidc-discovery <url>", "OpenID Connect discovery URL to auto-resolve JWKS")
    .option("--alg <algorithm>", "expected algorithm")
    .option("--require <claims>", "comma-separated list of required claims")
    .option("--leeway <seconds>", "clock skew tolerance in seconds", "0")
    .option("--json", "output machine-readable JSON")
    .option("--batch", "read newline-separated tokens from stdin")
    .action(async (tokenArg: string, opts: VerifyOptions, cmd: Command) => {
      const globalOpts = (cmd.parent?.opts() ?? {}) as GlobalOptions;
      const useJson = opts.json === true || globalOpts.json === true;

      // Load and merge config
      const fileConfig = await resolveConfig(globalOpts.config);
      const config = mergeConfig(fileConfig, {});

      // Resolve --fake-time
      let now: Date | undefined;
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

      // Resolve key material
      let keyMaterial: ReturnType<typeof parseKeyContents> | undefined;
      if (opts.key !== undefined) {
        const contents = readKeyFile(opts.key);
        keyMaterial = parseKeyContents(contents);
      }

      // Resolve effective secret (CLI flag wins over config default)
      const secret = opts.secret;

      // Resolve effective JWKS URL (CLI flag wins over config default)
      let jwksUri = opts.jwks ?? config.defaults?.jwks;

      // Resolve OIDC discovery → JWKS URI
      if (jwksUri === undefined && opts.oidcDiscovery !== undefined) {
        const oidcResult = await resolveOidcJwksUri(opts.oidcDiscovery);
        if (!oidcResult.ok) {
          exitWithError(
            oidcResult.error.message,
            "Check that the OpenID Connect discovery URL is correct and accessible.",
          );
        }
        jwksUri = oidcResult.value;
      }

      // Resolve effective algorithm (CLI flag wins over config default)
      const alg = (opts.alg ?? config.defaults?.alg) as SupportedAlgorithm | undefined;

      // Parse --require
      const requiredClaims =
        opts.require !== undefined && opts.require.trim().length > 0
          ? opts.require.split(",").map((c) => c.trim()).filter((c) => c.length > 0)
          : undefined;

      // Parse --leeway
      const leewaySeconds = parseInt(opts.leeway ?? "0", 10);
      if (isNaN(leewaySeconds)) {
        exitWithError(
          `Invalid --leeway value: ${opts.leeway}`,
          "Provide an integer number of seconds.",
        );
      }

      if (opts.batch === true) {
        const lines = await readStdinLines();
        let hasFailure = false;

        for (const line of lines) {
          const result = await verifyToken({
            token: line,
            secret,
            ...(keyMaterial ?? {}),
            jwksUri,
            alg,
            requiredClaims,
            leewaySeconds,
            now,
          });

          if (result.ok) {
            const verifyResult: VerifyResult = { valid: true, token: result.value };
            if (useJson) {
              console.log(
                JSON.stringify({
                  valid: true,
                  header: result.value.header,
                  payload: result.value.payload,
                }),
              );
            } else {
              console.log(formatVerifyResult(verifyResult));
              console.log("---");
            }
          } else {
            hasFailure = true;
            const verifyResult: VerifyResult = {
              valid: false,
              token: { header: {}, payload: {}, signaturePresent: false },
              error: result.error,
            };
            if (useJson) {
              console.log(
                JSON.stringify({
                  valid: false,
                  reason: result.error.reason,
                  message: result.error.message,
                }),
              );
            } else {
              console.log(formatVerifyResult(verifyResult));
              const hint = buildSuggestion(result.error.reason, opts);
              if (hint !== undefined) {
                console.error(pc.dim(`Hint: ${hint}`));
              }
              const jwksHint = buildJwksHint(result.error.message, opts);
              if (jwksHint !== undefined) {
                console.error(pc.dim(`Hint: ${jwksHint}`));
              }
              console.log("---");
            }
          }
        }

        process.exit(hasFailure ? EXIT_CODES.USER_ERROR : EXIT_CODES.SUCCESS);
      }

      // Single token mode
      const token = await resolveTokenInput(tokenArg);

      const result = await verifyToken({
        token,
        secret,
        ...(keyMaterial ?? {}),
        jwksUri,
        alg,
        requiredClaims,
        leewaySeconds,
        now,
      });

      if (result.ok) {
        const verifyResult: VerifyResult = { valid: true, token: result.value };
        if (useJson) {
          console.log(
            JSON.stringify({
              valid: true,
              header: result.value.header,
              payload: result.value.payload,
            }),
          );
        } else {
          console.log(formatVerifyResult(verifyResult));
        }
        process.exit(EXIT_CODES.SUCCESS);
      }

      // Failure path
      const actualAlg = undefined; // token header not available on verify failure
      const verifyResult: VerifyResult = {
        valid: false,
        token: { header: {}, payload: {}, signaturePresent: false },
        error: result.error,
      };

      if (useJson) {
        console.log(
          JSON.stringify({
            valid: false,
            reason: result.error.reason,
            message: result.error.message,
          }),
        );
        process.exit(EXIT_CODES.USER_ERROR);
      }

      console.error(formatVerifyResult(verifyResult));
      const hint = buildSuggestion(result.error.reason, opts, actualAlg);
      if (hint !== undefined) {
        console.error(pc.dim(`Hint: ${hint}`));
      }
      const jwksHint = buildJwksHint(result.error.message, opts);
      if (jwksHint !== undefined) {
        console.error(pc.dim(`Hint: ${jwksHint}`));
      }
      process.exit(EXIT_CODES.USER_ERROR);
    });
}
