import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseToml } from "smol-toml";
import { ConfigSchema, type Config } from "./schema.js";
import { type Result, type ConfigError, ok, err } from "../core/types.js";

/**
 * Walks upward from startDir looking for `.jwt-cli.toml`.
 * Returns the absolute path if found, or `null` if not found before the filesystem root.
 */
export function findConfigFile(startDir: string): string | null {
  const candidate = path.join(startDir, ".jwt-cli.toml");
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  const parent = path.dirname(startDir);
  if (parent === startDir) {
    // Reached filesystem root
    return null;
  }
  return findConfigFile(parent);
}

/**
 * Loads and validates a `.jwt-cli.toml` config file.
 * Returns `Err` with descriptive messages on parse or validation failure.
 */
export function loadConfig(filePath: string): Result<Config, ConfigError> {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return err({
      code: "NOT_FOUND",
      message: `Could not read config file at ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  let parsed: unknown;
  try {
    parsed = parseToml(content);
  } catch (e) {
    return err({
      code: "PARSE_ERROR",
      message: `Failed to parse TOML in ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    return err({
      code: "VALIDATION_ERROR",
      message: `Config validation failed in ${filePath}`,
      issues: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    });
  }

  return ok(result.data);
}

/**
 * Merges a file config with CLI flag overrides.
 * CLI flags always win. Deep merges `defaults` and `lint` sections.
 */
export function mergeConfig(fileConfig: Config, cliFlags: Partial<Config>): Config {
  return {
    ...fileConfig,
    ...cliFlags,
    defaults:
      fileConfig.defaults !== undefined || cliFlags.defaults !== undefined
        ? { ...fileConfig.defaults, ...cliFlags.defaults }
        : undefined,
    lint:
      fileConfig.lint !== undefined || cliFlags.lint !== undefined
        ? { ...fileConfig.lint, ...cliFlags.lint }
        : undefined,
  };
}
