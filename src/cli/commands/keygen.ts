/**
 * CLI command for generating cryptographic key pairs for JWT signing.
 */
import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { generateKeyPair } from "../../core/keygen.js";
import type { KeyType, KeyFormat } from "../../core/keygen.js";
import { exitWithError } from "../helpers.js";
import { formatKeyPair } from "../../ui/format.js";
import pc from "picocolors";

const VALID_KEY_TYPES: KeyType[] = ["rsa", "ec", "ed25519"];

/**
 * Builds the `keygen` subcommand for generating JWT signing key pairs.
 *
 * @returns A configured Commander `Command` instance.
 */
export function buildKeygenCommand(): Command {
  return new Command("keygen")
    .description("Generate a cryptographic key pair for JWT signing")
    .argument("<type>", "key type: rsa, ec, or ed25519")
    .option("--jwk", "output in JWK format (default)")
    .option("--pem", "output in PEM format")
    .option("--kid <string>", "key ID to embed in JWK")
    .option("--out-dir <path>", "write key files to directory instead of stdout")
    .option("--bits <number>", "RSA key size in bits (default: 2048)")
    .option("--curve <string>", "EC curve (default: P-256)")
    .action(async (typeArg: string, opts: {
      jwk?: boolean;
      pem?: boolean;
      kid?: string;
      outDir?: string;
      bits?: string;
      curve?: string;
    }) => {
      // Validate key type
      if (!VALID_KEY_TYPES.includes(typeArg as KeyType)) {
        exitWithError(
          `Invalid key type: "${typeArg}"`,
          `Valid types are: ${VALID_KEY_TYPES.join(", ")}`
        );
      }
      const type = typeArg as KeyType;

      // Determine output format
      const format: KeyFormat = opts.pem ? "pem" : "jwk";

      // Parse RSA bits if provided
      const rsaBits = opts.bits !== undefined ? parseInt(opts.bits, 10) : undefined;
      if (rsaBits !== undefined && (isNaN(rsaBits) || rsaBits < 1)) {
        exitWithError(
          `Invalid --bits value: "${opts.bits}"`,
          "Provide a positive integer, e.g. --bits 2048"
        );
      }

      // Generate the key pair
      const result = await generateKeyPair({
        type,
        format,
        kid: opts.kid,
        rsaBits,
        ecCurve: opts.curve,
      });

      if (!result.ok) {
        exitWithError(result.error.message);
      }

      const pair = result.value;

      if (opts.outDir !== undefined) {
        // Write key files to directory
        fs.mkdirSync(opts.outDir, { recursive: true });

        const privateFileName = format === "pem" ? "private.pem" : "private.jwk.json";
        const publicFileName = format === "pem" ? "public.pem" : "public.jwk.json";

        const privatePath = path.join(opts.outDir, privateFileName);
        const publicPath = path.join(opts.outDir, publicFileName);

        fs.writeFileSync(privatePath, pair.privateKey, "utf8");
        fs.writeFileSync(publicPath, pair.publicKey, "utf8");

        console.log(pc.green("✅ Key pair written:"));
        console.log(pc.dim("  Private: ") + pc.cyan(privatePath));
        console.log(pc.dim("  Public:  ") + pc.cyan(publicPath));
      } else {
        // Print to stdout
        console.log(formatKeyPair(pair, format));
      }
    });
}
