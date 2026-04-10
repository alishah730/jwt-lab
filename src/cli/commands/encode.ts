/**
 * Encode subcommand — builds a signed JWT from a JSON payload,
 * natural language description, or stdin.
 */
import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { encodeToken } from "../../core/encode.js";
import { parseNaturalLanguagePayload } from "../../core/nlp.js";
import { parseDuration } from "../../core/duration.js";
import { EXIT_CODES } from "../../core/types.js";
import { resolveConfig, exitWithError, copyToClipboard } from "../helpers.js";
import pc from "picocolors";

/** Options accepted by the encode command. */
interface EncodeOpts {
  secret?: string;
  key?: string;
  alg?: string;
  header?: string;
  kid?: string;
  exp?: string;
  iat?: string;
  nbf?: string;
  iss?: string;
  sub?: string;
  aud?: string;
  jti?: boolean;
  copy?: boolean;
  profile?: string;
}

/** Global options inherited from the root program. */
interface GlobalOpts {
  json?: boolean;
  fakeTime?: string;
  config?: string;
}

/**
 * Reads all of stdin and returns it as a trimmed string.
 */
async function readStdin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8").trim()),
    );
    process.stdin.on("error", reject);
  });
}

/**
 * Builds the `encode` subcommand for the jwt-lab CLI.
 *
 * Encodes a JWT from a JSON payload string, a natural language description,
 * or piped stdin. Supports HMAC secrets and asymmetric PEM/JWK private keys.
 *
 * @returns A configured `Command` instance ready to be added to the program.
 */
export function buildEncodeCommand(): Command {
  return new Command("encode")
    .description(
      "Encode a JWT from a JSON payload or natural language description",
    )
    .argument(
      "<payload>",
      "JSON payload string, natural language description, or - for stdin",
    )
    .option("--secret <string>", "HMAC secret for HS256/384/512")
    .option("--key <path>", "path to PEM or JWK private key file")
    .option(
      "--alg <algorithm>",
      "signing algorithm (default: HS256 with secret, RS256 with key)",
    )
    .option("--header <json>", "additional header fields as JSON")
    .option("--kid <string>", "key ID to set in header")
    .option("--exp <duration>", "expiration time (e.g. 1h, 30m, 7d)")
    .option("--iat <iso8601>", "issued-at time override")
    .option("--nbf <duration>", "not-before time (e.g. 5m)")
    .option("--iss <string>", "issuer claim")
    .option("--sub <string>", "subject claim")
    .option("--aud <string>", "audience claim")
    .option("--jti", "generate a random JTI claim")
    .option("--copy", "copy the token to clipboard")
    .option("--profile <name>", "use a named profile from config")
    .action(
      async (payloadArg: string, opts: EncodeOpts, cmd: Command) => {
        // 1. Resolve global options from the parent program.
        const globalOpts = cmd.parent?.opts<GlobalOpts>() ?? {};

        // 2. Determine the effective clock (--fake-time support).
        const now = globalOpts.fakeTime
          ? new Date(globalOpts.fakeTime)
          : new Date();

        // 3. Load config file.
        const config = await resolveConfig(globalOpts.config);

        // 4. Apply profile defaults (CLI opts win over profile).
        if (opts.profile !== undefined) {
          const profile = config.profiles?.[opts.profile];
          if (profile === undefined) {
            exitWithError(
              `Profile "${opts.profile}" not found in config.`,
              "Check your .jwt-cli.toml for available profiles.",
            );
          }
          // Apply profile TTL as --exp default when not already set.
          if (opts.exp === undefined && profile.ttl !== undefined) {
            opts.exp = profile.ttl;
          }
          // Apply profile aud as default when not already set.
          if (opts.aud === undefined && profile.aud !== undefined) {
            opts.aud = profile.aud;
          }
        }

        // 5. Merge config defaults (CLI opts win).
        const configDefaults = config.defaults ?? {};
        const effectiveAlg =
          opts.alg ??
          configDefaults.alg ??
          (opts.secret !== undefined ? "HS256" : "RS256");
        const effectiveIss = opts.iss ?? configDefaults.iss;
        const effectiveAud = opts.aud ?? configDefaults.aud;

        // 6. Resolve the raw payload string.
        let rawPayload: string;
        if (payloadArg === "-") {
          rawPayload = await readStdin();
        } else {
          rawPayload = payloadArg;
        }

        // 7. Parse the payload — JSON first, then NLP fallback.
        let payload: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(rawPayload);
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            exitWithError(
              "Payload must be a JSON object, not an array or primitive.",
            );
          }
          payload = parsed as Record<string, unknown>;
        } catch {
          // Not valid JSON — treat as natural language description.
          const nlpResult = parseNaturalLanguagePayload(rawPayload, now);
          // parseNaturalLanguagePayload never returns Err, but handle defensively.
          if (!nlpResult.ok) {
            exitWithError(nlpResult.error.message);
          }
          payload = nlpResult.value;
        }

        // 8. Apply standard claim overrides from CLI options.
        if (effectiveIss !== undefined) payload["iss"] = effectiveIss;
        if (effectiveAud !== undefined) payload["aud"] = effectiveAud;
        if (opts.sub !== undefined) payload["sub"] = opts.sub;

        if (opts.exp !== undefined) {
          const expResult = parseDuration(opts.exp);
          if (!expResult.ok) {
            exitWithError(expResult.error.message, "Use formats like 1h, 30m, 7d.");
          }
          payload["exp"] = Math.floor(now.getTime() / 1000) + expResult.value;
        }

        if (opts.nbf !== undefined) {
          const nbfResult = parseDuration(opts.nbf);
          if (!nbfResult.ok) {
            exitWithError(nbfResult.error.message, "Use formats like 5m, 1h.");
          }
          payload["nbf"] = Math.floor(now.getTime() / 1000) + nbfResult.value;
        }

        if (opts.iat !== undefined) {
          const iatDate = new Date(opts.iat);
          if (isNaN(iatDate.getTime())) {
            exitWithError(
              `Invalid --iat value: "${opts.iat}". Expected an ISO 8601 date string.`,
            );
          }
          payload["iat"] = Math.floor(iatDate.getTime() / 1000);
        }

        if (opts.jti === true) {
          // encodeToken replaces jti: true with a UUID v4.
          payload["jti"] = true;
        }

        // 9. Parse additional header fields.
        let extraHeader: Record<string, unknown> | undefined;
        if (opts.header !== undefined) {
          try {
            const parsed: unknown = JSON.parse(opts.header);
            if (
              typeof parsed !== "object" ||
              parsed === null ||
              Array.isArray(parsed)
            ) {
              exitWithError("--header must be a JSON object.");
            }
            extraHeader = parsed as Record<string, unknown>;
          } catch {
            exitWithError(
              `Invalid JSON for --header: ${opts.header}`,
              "Wrap the JSON in single quotes to avoid shell escaping issues.",
            );
          }
        }

        // 10. Load private key file if --key is provided.
        let privateKeyPem: string | undefined;
        if (opts.key !== undefined) {
          // Sanitize the path: check for null bytes and resolve to an absolute
          // normalized path to prevent path traversal via sequences like "../../../".
          if (opts.key.includes("\0")) {
            exitWithError("Invalid key file path: null bytes are not allowed.");
          }
          const resolvedKeyPath = path.resolve(opts.key);
          const ext = path.extname(resolvedKeyPath).toLowerCase();
          const allowedExtensions = [".pem", ".key", ".jwk", ".json", ""];
          if (!allowedExtensions.includes(ext)) {
            exitWithError(
              `Invalid key file extension "${ext}". Allowed: .pem, .key, .jwk, .json`,
            );
          }
          try {
            privateKeyPem = fs.readFileSync(resolvedKeyPath, "utf8");
          } catch {
            exitWithError(`Could not read key file: "${path.basename(resolvedKeyPath)}"`);
          }
        }

        // 11. Encode the token.
        const result = await encodeToken({
          payload,
          secret: opts.secret,
          privateKeyPem,
          alg: effectiveAlg as Parameters<typeof encodeToken>[0]["alg"],
          kid: opts.kid,
          header: extraHeader,
          now,
        });

        if (!result.ok) {
          exitWithError(result.error.message);
        }

        const token = result.value;

        // 12. Output the result.
        if (globalOpts.json === true) {
          console.log(JSON.stringify({ token }));
        } else {
          console.log(token);

          // Print a brief summary line.
          const summaryParts: string[] = [pc.dim("alg:") + " " + pc.cyan(effectiveAlg)];
          if (typeof payload["exp"] === "number") {
            const expDate = new Date(payload["exp"] * 1000);
            summaryParts.push(pc.dim("exp:") + " " + pc.cyan(expDate.toISOString()));
          }
          if (typeof payload["sub"] === "string") {
            summaryParts.push(pc.dim("sub:") + " " + pc.cyan(payload["sub"]));
          }
          console.error(pc.dim("─".repeat(40)));
          console.error(summaryParts.join("  "));
        }

        // 13. Copy to clipboard if requested.
        if (opts.copy === true) {
          await copyToClipboard(token);
          if (globalOpts.json !== true) {
            console.error(pc.green("✔ Copied to clipboard"));
          }
        }

        process.exit(EXIT_CODES.SUCCESS);
      },
    );
}
