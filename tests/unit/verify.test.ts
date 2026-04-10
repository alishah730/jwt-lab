import { describe, it, expect } from "vitest";
import { encodeToken } from "../../src/core/encode.js";
import { verifyToken } from "../../src/core/verify.js";

describe("verifyToken", () => {
  const fixedNow = new Date("2024-06-15T12:00:00Z");
  const secret = "test-verification-secret";

  it("verifies a valid HMAC token", async () => {
    const encResult = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const verifyResult = await verifyToken({
      token: encResult.value,
      secret,
      now: fixedNow,
    });

    expect(verifyResult.ok).toBe(true);
    if (verifyResult.ok) {
      expect(verifyResult.value.payload["sub"]).toBe("user1");
    }
  });

  it("fails with wrong secret", async () => {
    const encResult = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const verifyResult = await verifyToken({
      token: encResult.value,
      secret: "wrong-secret",
      now: fixedNow,
    });

    expect(verifyResult.ok).toBe(false);
    if (!verifyResult.ok) {
      expect(verifyResult.error.reason).toBe("signature_mismatch");
    }
  });

  it("fails for expired token", async () => {
    const pastTime = new Date("2024-01-01T00:00:00Z");
    const encResult = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(pastTime.getTime() / 1000) + 60 },
      secret,
      alg: "HS256",
      now: pastTime,
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const verifyResult = await verifyToken({
      token: encResult.value,
      secret,
      now: fixedNow, // way after expiry
    });

    expect(verifyResult.ok).toBe(false);
    if (!verifyResult.ok) {
      expect(verifyResult.error.reason).toBe("expired");
    }
  });

  it("applies leeway tolerance", async () => {
    const nowSec = Math.floor(fixedNow.getTime() / 1000);
    const encResult = await encodeToken({
      payload: { sub: "user1", exp: nowSec - 5 },  // expired 5 seconds ago
      secret,
      alg: "HS256",
      now: new Date((nowSec - 100) * 1000),
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    // With leeway of 10s, should pass
    const withLeeway = await verifyToken({
      token: encResult.value,
      secret,
      leewaySeconds: 10,
      now: fixedNow,
    });
    expect(withLeeway.ok).toBe(true);

    // Without leeway, should fail
    const withoutLeeway = await verifyToken({
      token: encResult.value,
      secret,
      leewaySeconds: 0,
      now: fixedNow,
    });
    expect(withoutLeeway.ok).toBe(false);
  });

  it("rejects algorithm mismatch", async () => {
    const encResult = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const verifyResult = await verifyToken({
      token: encResult.value,
      secret,
      alg: "HS384",
      now: fixedNow,
    });

    expect(verifyResult.ok).toBe(false);
    if (!verifyResult.ok) {
      expect(verifyResult.error.reason).toBe("algorithm_mismatch");
    }
  });

  it("rejects missing required claims", async () => {
    const encResult = await encodeToken({
      payload: { sub: "user1", exp: Math.floor(fixedNow.getTime() / 1000) + 3600 },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const verifyResult = await verifyToken({
      token: encResult.value,
      secret,
      requiredClaims: ["email", "role"],
      now: fixedNow,
    });

    expect(verifyResult.ok).toBe(false);
    if (!verifyResult.ok) {
      expect(verifyResult.error.reason).toBe("missing_claim");
    }
  });

  it("returns Err when no key is provided", async () => {
    const encResult = await encodeToken({
      payload: { sub: "user1" },
      secret,
      alg: "HS256",
      now: fixedNow,
    });
    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const verifyResult = await verifyToken({
      token: encResult.value,
    });

    expect(verifyResult.ok).toBe(false);
    if (!verifyResult.ok) {
      expect(verifyResult.error.reason).toBe("malformed");
    }
  });
});
