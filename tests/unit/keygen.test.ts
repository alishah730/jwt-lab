import { describe, it, expect } from "vitest";
import { generateKeyPair } from "../../src/core/keygen.js";
import { encodeToken } from "../../src/core/encode.js";
import { verifyToken } from "../../src/core/verify.js";

describe("generateKeyPair", () => {
  it("generates RSA key pair in JWK format", async () => {
    const result = await generateKeyPair({ type: "rsa", format: "jwk" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.value.privateKey)).toHaveProperty("kty", "RSA");
      expect(JSON.parse(result.value.publicKey)).toHaveProperty("kty", "RSA");
    }
  });

  it("generates EC key pair in PEM format", async () => {
    const result = await generateKeyPair({ type: "ec", format: "pem" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.privateKey).toContain("BEGIN PRIVATE KEY");
      expect(result.value.publicKey).toContain("BEGIN PUBLIC KEY");
    }
  });

  it("generates Ed25519 key pair", async () => {
    const result = await generateKeyPair({ type: "ed25519", format: "jwk" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.value.privateKey)).toHaveProperty("kty", "OKP");
    }
  });

  it("embeds kid in JWK output", async () => {
    const result = await generateKeyPair({ type: "ec", format: "jwk", kid: "test-kid-123" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const privJwk = JSON.parse(result.value.privateKey);
      const pubJwk = JSON.parse(result.value.publicKey);
      expect(privJwk.kid).toBe("test-kid-123");
      expect(pubJwk.kid).toBe("test-kid-123");
      expect(result.value.kid).toBe("test-kid-123");
    }
  });

  it("RSA sign + verify round trip", async () => {
    const now = new Date("2024-01-01T00:00:00Z");
    const keyResult = await generateKeyPair({ type: "rsa", format: "pem" });
    expect(keyResult.ok).toBe(true);
    if (!keyResult.ok) return;

    const encResult = await encodeToken({
      payload: { sub: "test", exp: Math.floor(now.getTime() / 1000) + 3600 },
      privateKeyPem: keyResult.value.privateKey,
      alg: "RS256",
      now,
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const verResult = await verifyToken({
      token: encResult.value,
      publicKeyPem: keyResult.value.publicKey,
      alg: "RS256",
      now,
    });
    expect(verResult.ok).toBe(true);
  });

  it("EC sign + verify round trip", async () => {
    const now = new Date("2024-01-01T00:00:00Z");
    const keyResult = await generateKeyPair({ type: "ec", format: "pem" });
    expect(keyResult.ok).toBe(true);
    if (!keyResult.ok) return;

    const encResult = await encodeToken({
      payload: { sub: "test", exp: Math.floor(now.getTime() / 1000) + 3600 },
      privateKeyPem: keyResult.value.privateKey,
      alg: "ES256",
      now,
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const verResult = await verifyToken({
      token: encResult.value,
      publicKeyPem: keyResult.value.publicKey,
      alg: "ES256",
      now,
    });
    expect(verResult.ok).toBe(true);
  });
});
