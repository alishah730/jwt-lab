import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { findConfigFile, loadConfig, mergeConfig } from "../../src/config/loader.js";
import type { Config } from "../../src/config/schema.js";

describe("findConfigFile", () => {
  it("returns null when no config file exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwt-test-"));
    try {
      expect(findConfigFile(tmpDir)).toBeNull();
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("finds config file in current directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwt-test-"));
    const configPath = path.join(tmpDir, ".jwt-cli.toml");
    fs.writeFileSync(configPath, "");
    try {
      expect(findConfigFile(tmpDir)).toBe(configPath);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("finds config file in parent directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwt-test-"));
    const childDir = path.join(tmpDir, "sub", "nested");
    fs.mkdirSync(childDir, { recursive: true });
    const configPath = path.join(tmpDir, ".jwt-cli.toml");
    fs.writeFileSync(configPath, "");
    try {
      expect(findConfigFile(childDir)).toBe(configPath);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("loadConfig", () => {
  it("loads a valid config file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwt-test-"));
    const configPath = path.join(tmpDir, ".jwt-cli.toml");
    fs.writeFileSync(configPath, `
[defaults]
iss = "https://auth.example.com"
aud = "my-api"
alg = "ES256"
`);
    try {
      const result = loadConfig(configPath);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.defaults?.iss).toBe("https://auth.example.com");
        expect(result.value.defaults?.aud).toBe("my-api");
        expect(result.value.defaults?.alg).toBe("ES256");
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns Err for invalid TOML", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwt-test-"));
    const configPath = path.join(tmpDir, ".jwt-cli.toml");
    fs.writeFileSync(configPath, "this is not = valid [toml broken");
    try {
      const result = loadConfig(configPath);
      expect(result.ok).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("returns Err for non-existent file", () => {
    const result = loadConfig("/nonexistent/path/.jwt-cli.toml");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns Err for invalid schema values", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwt-test-"));
    const configPath = path.join(tmpDir, ".jwt-cli.toml");
    fs.writeFileSync(configPath, `
[defaults]
alg = "INVALID_ALG"
`);
    try {
      const result = loadConfig(configPath);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe("mergeConfig", () => {
  it("CLI flags override config file values", () => {
    const fileConfig: Config = {
      defaults: { iss: "from-file", aud: "from-file" },
    };
    const cliFlags: Partial<Config> = {
      defaults: { iss: "from-cli" },
    };
    const merged = mergeConfig(fileConfig, cliFlags);
    expect(merged.defaults?.iss).toBe("from-cli");
  });

  it("preserves file values when CLI flags are empty", () => {
    const fileConfig: Config = {
      defaults: { iss: "from-file", aud: "from-file" },
    };
    const merged = mergeConfig(fileConfig, {});
    expect(merged.defaults?.iss).toBe("from-file");
    expect(merged.defaults?.aud).toBe("from-file");
  });
});
