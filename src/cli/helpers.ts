import * as readline from "node:readline";
import { execFile, execSync } from "node:child_process";
import pc from "picocolors";
import { EXIT_CODES } from "../core/types.js";
import { findConfigFile, loadConfig, type Config } from "../config/index.js";

/**
 * Reads a token from stdin when `arg` is `"-"`, otherwise returns `arg` as-is.
 *
 * @param arg - Either `"-"` to signal stdin reading, or a literal token string.
 * @returns The resolved token string.
 */
export async function resolveTokenInput(arg: string): Promise<string> {
  if (arg !== "-") {
    return arg;
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8").trim()));
    process.stdin.on("error", reject);
  });
}

/**
 * Reads all non-empty lines from stdin for batch mode processing.
 *
 * @returns An array of trimmed, non-empty lines read from stdin.
 */
export async function readStdinLines(): Promise<string[]> {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  const lines: string[] = [];
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      lines.push(trimmed);
    }
  }

  return lines;
}

/**
 * Loads config from a file path or auto-discovers `.jwt-cli.toml` from the
 * current working directory. Returns an empty config object on failure,
 * printing a warning to stderr.
 *
 * @param configPath - Optional explicit path to a config file.
 * @returns The loaded `Config`, or `{}` if loading fails.
 */
export async function resolveConfig(configPath?: string): Promise<Config> {
  const filePath = configPath ?? findConfigFile(process.cwd());

  if (filePath === null) {
    return {};
  }

  const result = loadConfig(filePath);

  if (!result.ok) {
    console.warn(pc.yellow(`Warning: could not load config (${result.error.message})`));
    if (result.error.issues && result.error.issues.length > 0) {
      for (const issue of result.error.issues) {
        console.warn(pc.yellow(`  • ${issue}`));
      }
    }
    return {};
  }

  return result.value;
}

/**
 * Prints a formatted error message (and optional suggestion) to stderr, then
 * exits the process with `EXIT_CODES.USER_ERROR`.
 *
 * @param message    - The primary error description shown to the user.
 * @param suggestion - Optional hint on how to fix the problem.
 * @returns Never returns; always exits.
 */
export function exitWithError(message: string, suggestion?: string): never {
  console.error(pc.red(`Error: ${message}`));
  if (suggestion !== undefined) {
    console.error(pc.dim(`Hint: ${suggestion}`));
  }
  process.exit(EXIT_CODES.USER_ERROR);
}

/**
 * Copies `text` to the system clipboard using platform-specific commands.
 * Silently does nothing if the clipboard utility is unavailable or the
 * operation fails.
 *
 * Supported platforms:
 * - macOS  – `pbcopy`
 * - Linux  – `xclip -selection clipboard` or `xsel --clipboard --input`
 * - Windows – `clip`
 *
 * @param text - The text to place on the clipboard.
 */
export async function copyToClipboard(text: string): Promise<void> {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      const proc = execFile("pbcopy");
      proc.stdin?.write(text);
      proc.stdin?.end();
      await new Promise<void>((resolve, reject) => {
        proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited ${code}`))));
        proc.on("error", reject);
      });
    } else if (platform === "win32") {
      const proc = execFile("clip");
      proc.stdin?.write(text);
      proc.stdin?.end();
      await new Promise<void>((resolve, reject) => {
        proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`clip exited ${code}`))));
        proc.on("error", reject);
      });
    } else {
      // Linux – try xclip first, fall back to xsel
      try {
        execSync("xclip -selection clipboard", { input: text });
      } catch {
        try {
          execSync("xsel --clipboard --input", { input: text });
        } catch {
          // Neither xclip nor xsel available
        }
      }
    }
  } catch {
    // Clipboard unavailable – silently ignore
  }
}
