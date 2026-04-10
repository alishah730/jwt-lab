/**
 * CLI command for decoding JWTs without signature verification.
 */
import { Command } from "commander";
import { decodeToken } from "../../core/decode.js";
import { EXIT_CODES } from "../../core/types.js";
import { resolveTokenInput, readStdinLines, exitWithError } from "../helpers.js";
import { formatDecodedToken } from "../../ui/format.js";

/** Options accepted by the decode subcommand. */
interface DecodeOptions {
  json?: boolean;
  batch?: boolean;
}

/** Global options inherited from the root program. */
interface GlobalOptions {
  json?: boolean;
}

/**
 * Builds and returns the `decode` subcommand.
 *
 * @returns A configured Commander `Command` instance for `jwt decode`.
 */
export function buildDecodeCommand(): Command {
  return new Command("decode")
    .description("Decode a JWT without verifying its signature")
    .argument("<token>", "JWT string or - to read from stdin")
    .option("--json", "output machine-readable JSON")
    .option("--batch", "read newline-separated tokens from stdin")
    .action(async (tokenArg: string, opts: DecodeOptions, cmd: Command) => {
      const globalOpts = (cmd.parent?.opts() ?? {}) as GlobalOptions;
      const useJson = opts.json === true || globalOpts.json === true;

      if (opts.batch === true) {
        const lines = await readStdinLines();

        for (const line of lines) {
          const result = decodeToken(line);

          if (!result.ok) {
            if (useJson) {
              console.log(JSON.stringify({ error: result.error.message }));
            } else {
              console.error(`Error decoding token: ${result.error.message}`);
            }
            continue;
          }

          const { header, payload, signaturePresent } = result.value;

          if (useJson) {
            console.log(JSON.stringify({ header, payload, signaturePresent }));
          } else {
            console.log(formatDecodedToken(result.value));
            console.log("---");
          }
        }

        process.exit(EXIT_CODES.SUCCESS);
      }

      const token = await resolveTokenInput(tokenArg);
      const result = decodeToken(token);

      if (!result.ok) {
        exitWithError(result.error.message);
      }

      const { header, payload, signaturePresent } = result.value;

      if (useJson) {
        console.log(JSON.stringify({ header, payload, signaturePresent }));
      } else {
        console.log(formatDecodedToken(result.value));
      }

      process.exit(EXIT_CODES.SUCCESS);
    });
}
