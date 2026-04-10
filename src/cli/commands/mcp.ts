/**
 * CLI command for starting the MCP (Model Context Protocol) HTTP/JSON server.
 */
import { Command } from "commander";
import { resolveConfig, exitWithError } from "../helpers.js";
import { mergeConfig } from "../../config/index.js";
import pc from "picocolors";
import gradient from "gradient-string";

/** Options accepted by the mcp serve subcommand. */
interface ServeOptions {
  port?: string;
  host?: string;
}

/** Global options inherited from the root program. */
interface GlobalOptions {
  config?: string;
}

/**
 * Builds the `mcp` subcommand group with a `serve` subcommand.
 */
export function buildMcpCommand(): Command {
  const mcp = new Command("mcp")
    .description("Model Context Protocol server for AI agents");

  mcp
    .command("serve")
    .description("Start the MCP HTTP/JSON server")
    .option("--port <number>", "server port", "3000")
    .option("--host <string>", "server host", "0.0.0.0")
    .action(async (opts: ServeOptions, cmd: Command) => {
      const globalOpts = (cmd.parent?.parent?.opts() ?? {}) as GlobalOptions;

      const fileConfig = await resolveConfig(globalOpts.config);
      const config = mergeConfig(fileConfig, {});

      const port = parseInt(opts.port ?? String(config.mcp?.port ?? 3000), 10);
      const host = opts.host ?? config.mcp?.host ?? "0.0.0.0";

      if (isNaN(port) || port < 1 || port > 65535) {
        exitWithError(
          `Invalid port: ${opts.port}`,
          "Use a number between 1 and 65535.",
        );
      }

      // Dynamic import to avoid loading Hono at CLI startup time
      const { createApp } = await import("../../mcp/app.js");
      const { serve } = await import("@hono/node-server");

      const app = createApp(config);

      const logo = [
        "     ██╗██╗    ██╗████████╗   ██╗      █████╗ ██████╗ ",
        "     ██║██║    ██║╚══██╔══╝   ██║     ██╔══██╗██╔══██╗",
        "     ██║██║ █╗ ██║   ██║█████╗██║     ███████║██████╔╝",
        "██   ██║██║███╗██║   ██║╚════╝██║     ██╔══██║██╔══██╗",
        "╚█████╔╝╚███╔███╔╝   ██║      ███████╗██║  ██║██████╔╝",
        " ╚════╝  ╚══╝╚══╝    ╚═╝      ╚══════╝╚═╝  ╚═╝╚═════╝",
      ].join("\n");
      const jwtGradient = gradient(["#00d4ff", "#7b2ff7", "#ff2d95"]);
      console.log(`\n${jwtGradient.multiline(logo)}`);
      console.log(pc.dim("─".repeat(56)));
      console.log(`${pc.dim("MCP Server · Model Context Protocol for AI agents")}\n`);
      console.log(pc.green(`  ● listening on ${pc.bold(`http://${host}:${port}`)}`));
      console.log(pc.dim(`    routes   POST /encode /decode /verify /inspect /keygen /explain`));
      console.log(pc.dim(`    docs     GET  /docs\n`));

      serve({ fetch: app.fetch, port, hostname: host });
    });

  return mcp;
}
