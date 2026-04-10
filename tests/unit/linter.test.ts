import { describe, it, expect } from "vitest";
import { lintToken, BUILT_IN_RULES } from "../../src/core/linter.js";
import type { DecodedToken, LintConfig } from "../../src/core/types.js";

function makeToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): DecodedToken {
  return { header, payload, signaturePresent: true };
}

describe("lintToken", () => {
  const emptyConfig: LintConfig = {};

  it("flags missing exp", () => {
    const token = makeToken({ alg: "RS256" }, { sub: "user" });
    const findings = lintToken(token, emptyConfig);
    expect(findings.some((f) => f.ruleId === "missing-exp")).toBe(true);
  });

  it("flags long-lived tokens (>24h)", () => {
    const iat = 1000000;
    const token = makeToken(
      { alg: "RS256" },
      { sub: "user", iat, exp: iat + 90000 },
    );
    const findings = lintToken(token, emptyConfig);
    expect(findings.some((f) => f.ruleId === "long-lived-token")).toBe(true);
  });

  it("flags missing nbf for long-lived tokens (>1h)", () => {
    const iat = 1000000;
    const token = makeToken(
      { alg: "RS256" },
      { sub: "user", iat, exp: iat + 7200 },
    );
    const findings = lintToken(token, emptyConfig);
    expect(findings.some((f) => f.ruleId === "missing-nbf-long-lived")).toBe(true);
  });

  it("flags none algorithm", () => {
    const token = makeToken({ alg: "none" }, { sub: "user" });
    const findings = lintToken(token, emptyConfig);
    const noneFinding = findings.find((f) => f.ruleId === "none-algorithm");
    expect(noneFinding).toBeDefined();
    expect(noneFinding?.severity).toBe("error");
  });

  it("flags HMAC algorithms", () => {
    const token = makeToken({ alg: "HS256" }, { sub: "user", exp: 9999999999 });
    const findings = lintToken(token, emptyConfig);
    expect(findings.some((f) => f.ruleId === "hmac-preferred-asymmetric")).toBe(true);
  });

  it("flags PII claims", () => {
    const token = makeToken(
      { alg: "RS256" },
      { sub: "user", email: "test@example.com", exp: 9999999999 },
    );
    const findings = lintToken(token, emptyConfig);
    expect(findings.some((f) => f.ruleId === "pii-claims")).toBe(true);
  });

  it("does not flag PII claims with custom patterns", () => {
    const token = makeToken(
      { alg: "RS256" },
      { sub: "user", custom_field: "value", exp: 9999999999 },
    );
    const config: LintConfig = { piiClaimPatterns: ["secret_data"] };
    const findings = lintToken(token, config);
    expect(findings.some((f) => f.ruleId === "pii-claims")).toBe(false);
  });

  it("respects disabled rules", () => {
    const token = makeToken({ alg: "none" }, { sub: "user" });
    const config: LintConfig = { disabledRules: ["none-algorithm"] };
    const findings = lintToken(token, config);
    expect(findings.some((f) => f.ruleId === "none-algorithm")).toBe(false);
  });

  it("respects severity overrides", () => {
    const token = makeToken({ alg: "HS256" }, { sub: "user", exp: 9999999999 });
    const config: LintConfig = {
      severityOverrides: { "hmac-preferred-asymmetric": "error" },
    };
    const findings = lintToken(token, config);
    const hmacFinding = findings.find(
      (f) => f.ruleId === "hmac-preferred-asymmetric",
    );
    expect(hmacFinding?.severity).toBe("error");
  });

  it("sorts findings by severity (error > warn > info)", () => {
    const token = makeToken({ alg: "none" }, { email: "test@example.com" });
    const findings = lintToken(token, emptyConfig);
    const severityOrder = { error: 2, warn: 1, info: 0 };

    for (let i = 1; i < findings.length; i++) {
      expect(severityOrder[findings[i].severity]).toBeLessThanOrEqual(
        severityOrder[findings[i - 1].severity],
      );
    }
  });

  it("returns no findings for a clean token", () => {
    const iat = 1000000;
    const token = makeToken(
      { alg: "RS256" },
      { sub: "user", iat, exp: iat + 900, nbf: iat },
    );
    const findings = lintToken(token, emptyConfig);
    // No missing-exp, no long-lived, no none, no HMAC, no PII
    expect(findings.length).toBe(0);
  });

  it("has 6 built-in rules", () => {
    expect(BUILT_IN_RULES.length).toBe(6);
  });
});
