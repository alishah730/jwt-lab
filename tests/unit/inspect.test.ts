import { describe, it, expect } from "vitest";
import { encodeToken } from "../../src/core/encode.js";
import { generateKeyPair } from "../../src/core/keygen.js";
import { inspectToken } from "../../src/core/inspect.js";

describe("inspectToken", () => {
  const fixedNow = new Date("2024-06-15T12:00:00Z");
  const secret = "inspect-test-secret";

  it("decodes and lints without verification when no key is provided", async () => {
    const enc = await encodeToken({
      payload: { sub: "user1", iss: "test", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({ token: enc.value, now: fixedNow });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe("unverified");
    expect(result.value.algorithm).toBe("HS256");
    expect(result.value.subject).toBe("user1");
    expect(result.value.issuer).toBe("test");
    expect(result.value.verificationResult).toBeUndefined();
    expect(result.value.lintFindings.length).toBeGreaterThan(0);
  });

  it("verifies and returns valid status with HMAC secret", async () => {
    const enc = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({ token: enc.value, secret, now: fixedNow });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe("valid");
    expect(result.value.verificationResult?.ok).toBe(true);
  });

  it("records verification failure without returning Err", async () => {
    const enc = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({
      token: enc.value,
      secret: "wrong-secret",
      now: fixedNow,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Verification failed → status stays "unverified", but result is still Ok
    expect(result.value.status).toBe("unverified");
    expect(result.value.verificationResult?.ok).toBe(false);
    if (!result.value.verificationResult?.ok) {
      expect(result.value.verificationResult.error.reason).toBe("signature_mismatch");
    }
  });

  it("returns expired status for an expired token", async () => {
    const pastTime = new Date("2020-01-01T00:00:00Z");
    const enc = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(pastTime.getTime() / 1000) + 60 },
      secret,
      alg: "HS256",
      now: pastTime,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({ token: enc.value, now: fixedNow });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe("expired");
    expect(result.value.timeUntilExpiry).toBeLessThan(0);
  });

  it("returns not_yet_valid for a future-nbf token", async () => {
    const futureNbf = Math.floor(fixedNow.getTime() / 1000) + 99999;
    const enc = await encodeToken({
      payload: {
        sub: "user1",
        exp: futureNbf + 3600,
        nbf: futureNbf,
      },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({ token: enc.value, now: fixedNow });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe("not_yet_valid");
  });

  it("returns DECODE_FAILED for a malformed token", async () => {
    const result = await inspectToken({ token: "not.a.valid-token" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("DECODE_FAILED");
  });

  it("extracts all standard claims correctly", async () => {
    const iat = Math.floor(fixedNow.getTime() / 1000);
    const exp = iat + 3600;
    const nbf = iat;
    const enc = await encodeToken({
      payload: {
        sub: "user42",
        iss: "https://auth.example.com",
        aud: "my-app",
        exp,
        iat,
        nbf,
        jti: "abc-123",
        role: "admin",
      },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({ token: enc.value, secret, now: fixedNow });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const r = result.value;
    expect(r.subject).toBe("user42");
    expect(r.issuer).toBe("https://auth.example.com");
    expect(r.audience).toBe("my-app");
    expect(r.issuedAt).toEqual(new Date(iat * 1000));
    expect(r.expiresAt).toEqual(new Date(exp * 1000));
    expect(r.notBefore).toEqual(new Date(nbf * 1000));
    expect(r.customClaims).toEqual({ role: "admin" });
    expect(r.kid).toBeUndefined(); // HS256 has no kid
  });

  it("works with asymmetric keys (ES256)", async () => {
    const keyResult = await generateKeyPair({ type: "ec", format: "pem" });
    expect(keyResult.ok).toBe(true);
    if (!keyResult.ok) return;

    const enc = await encodeToken({
      payload: { sub: "ec-user", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      privateKeyPem: keyResult.value.privateKey,
      alg: "ES256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({
      token: enc.value,
      publicKeyPem: keyResult.value.publicKey,
      now: fixedNow,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe("valid");
    expect(result.value.algorithm).toBe("ES256");
    expect(result.value.verificationResult?.ok).toBe(true);
  });

  it("respects custom lint config", async () => {
    const enc = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    // Disable all rules
    const result = await inspectToken({
      token: enc.value,
      now: fixedNow,
      lintConfig: {
        disabledRules: [
          "missing-exp",
          "long-lived-token",
          "missing-nbf-long-lived",
          "none-algorithm",
          "hmac-preferred-asymmetric",
          "pii-claims",
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.lintFindings).toHaveLength(0);
  });

  it("handles audience array", async () => {
    const enc = await encodeToken({
      payload: {
        sub: "user1",
        aud: ["app1", "app2"],
        exp: Math.floor(fixedNow.getTime() / 1000) + 3600,
      },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({ token: enc.value, now: fixedNow });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.audience).toEqual(["app1", "app2"]);
  });

  it("returns OIDC_DISCOVERY_FAILED for unreachable discovery URL", async () => {
    const enc = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;

    const result = await inspectToken({
      token: enc.value,
      oidcDiscoveryUrl: "http://localhost:1/.well-known/openid-configuration",
      now: fixedNow,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("OIDC_DISCOVERY_FAILED");
  });
});
