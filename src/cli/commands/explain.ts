/**
 * CLI command for static JWT security audit — analyzes token structure
 * and claims without requiring signing keys.
 */
import { Command } from "commander";
import { decodeToken } from "../../core/decode.js";
import { lintToken } from "../../core/linter.js";
import { EXIT_CODES, type LintConfig } from "../../core/types.js";
import { resolveTokenInput, resolveConfig, exitWithError } from "../helpers.js";
import { formatLintFindings } from "../../ui/format.js";
import { buildFindingsTable } from "../../ui/table.js";
import { mergeConfig } from "../../config/index.js";
import pc from "picocolors";

/** Options accepted by the explain subcommand. */
interface ExplainOptions {
  json?: boolean;
  table?: boolean;
}

/** Global options inherited from the root program. */
interface GlobalOptions {
  json?: boolean;
  config?: string;
}

/**
 * Builds and returns the `explain` subcommand.
 *
 * @returns A configured Commander `Command` instance for `jwt explain`.
 */
export function buildExplainCommand(): Command {
  return new Command("explain")
    .description("Static security audit of a JWT — no signing keys required")
    .argument("<token>", "JWT string or - to read from stdin")
    .option("--json", "output machine-readable JSON array of findings")
    .option("--table", "output findings in a table format")
    .action(async (tokenArg: string, opts: ExplainOptions, cmd: Command) => {
      const globalOpts = (cmd.parent?.opts() ?? {}) as GlobalOptions;
      const useJson = opts.json === true || globalOpts.json === true;

      // Load config for lint settings
      const fileConfig = await resolveConfig(globalOpts.config);
      const config = mergeConfig(fileConfig, {});
      const lintConfig: LintConfig = config.lint ?? {};

      const token = await resolveTokenInput(tokenArg);
      const decodeResult = decodeToken(token);

      if (!decodeResult.ok) {
        exitWithError(decodeResult.error.message);
      }

      const decoded = decodeResult.value;
      const findings = lintToken(decoded, lintConfig);

      if (useJson) {
        console.log(JSON.stringify(findings, null, 2));
      } else if (opts.table === true) {
        if (findings.length === 0) {
          console.log(pc.green("✅ No security issues detected."));
        } else {
          console.log(buildFindingsTable(findings));
        }
      } else {
        if (findings.length === 0) {
          console.log(pc.green("✅ No security issues detected."));
        } else {
          console.log(pc.bold("\n🔍 JWT Security Audit\n"));
          console.log(formatLintFindings(findings));
          console.log();
        }
      }

      const hasError = findings.some((f) => f.severity === "error");
      process.exit(hasError ? EXIT_CODES.USER_ERROR : EXIT_CODES.SUCCESS);
    });
}
