/**
 * jwt-lab CLI entry point.
 * Wires all subcommands together using commander.
 */
import { Command } from "commander";
import { EXIT_CODES } from "./core/types.js";
import pc from "picocolors";
import gradient from "gradient-string";
import { buildEncodeCommand } from "./cli/commands/encode.js";
import { buildDecodeCommand } from "./cli/commands/decode.js";
import { buildVerifyCommand } from "./cli/commands/verify.js";
import { buildInspectCommand } from "./cli/commands/inspect.js";
import { buildKeygenCommand } from "./cli/commands/keygen.js";
import { buildExplainCommand } from "./cli/commands/explain.js";
import { buildMcpCommand } from "./cli/commands/mcp.js";
import { buildCompletionsCommand } from "./cli/commands/completions.js";

// Read version from package.json
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const LOGO = [
  "     ██╗██╗    ██╗████████╗   ██╗      █████╗ ██████╗ ",
  "     ██║██║    ██║╚══██╔══╝   ██║     ██╔══██╗██╔══██╗",
  "     ██║██║ █╗ ██║   ██║█████╗██║     ███████║██████╔╝",
  "██   ██║██║███╗██║   ██║╚════╝██║     ██╔══██║██╔══██╗",
  "╚█████╔╝╚███╔███╔╝   ██║      ███████╗██║  ██║██████╔╝",
  " ╚════╝  ╚══╝╚══╝    ╚═╝      ╚══════╝╚═╝  ╚═╝╚═════╝",
].join("\n");

const jwtGradient = gradient(["#00d4ff", "#7b2ff7", "#ff2d95"]);
const BANNER = `
${jwtGradient.multiline(LOGO)}
${pc.dim("─".repeat(56))}
${pc.dim(`v${pkg.version}`)} ${pc.dim("·")} ${pc.italic(pc.dim("JWT toolkit for developers & AI agents"))}
`;

const program = new Command("jwt");

program
  .version(BANNER.trimStart(), "-v, --version", "output the version number")
  .description("jwt-lab – Modern JWT CLI, inspector, and MCP server for AI agents")
  .option("--fake-time <iso8601>", "override system clock for time-sensitive operations")
  .option("--config <path>", "path to .jwt-cli.toml config file")
  .option("--json", "output machine-readable JSON instead of pretty-printed text")
  .addHelpText("before", BANNER);

// Register subcommands
program.addCommand(buildEncodeCommand());
program.addCommand(buildDecodeCommand());
program.addCommand(buildVerifyCommand());
program.addCommand(buildInspectCommand());
program.addCommand(buildKeygenCommand());
program.addCommand(buildExplainCommand());
program.addCommand(buildMcpCommand());
program.addCommand(buildCompletionsCommand());

// Global error handler for unhandled rejections
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(pc.red(`Internal error: ${message}`));
  process.exit(EXIT_CODES.INTERNAL_ERROR);
});

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(`Error: ${message}`));
  process.exit(EXIT_CODES.INTERNAL_ERROR);
});
