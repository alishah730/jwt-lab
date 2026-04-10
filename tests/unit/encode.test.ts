import { describe, it, expect } from "vitest";
import { encodeToken } from "../../src/core/encode.js";
import { decodeToken } from "../../src/core/decode.js";

describe("encodeToken", () => {
  const fixedNow = new Date("2024-06-15T12:00:00Z");

  it("encodes with HMAC secret", async () => {
    const result = await encodeToken({
      payload: { sub: "user1", role: "admin" },
      secret: "test-secret-key-123",
      alg: "HS256",
      now: fixedNow,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value).toBe("string");
      const parts = result.value.split(".");
      expect(parts).toHaveLength(3);
    }
  });

  it("round-trip: encode then decode preserves payload", async () => {
    const originalPayload = { sub: "user1", role: "admin", count: 42 };
    const encResult = await encodeToken({
      payload: originalPayload,
      secret: "test-secret",
      alg: "HS256",
      now: fixedNow,
    });

    expect(encResult.ok).toBe(true);
    if (!encResult.ok) return;

    const decResult = decodeToken(encResult.value);
    expect(decResult.ok).toBe(true);
    if (!decResult.ok) return;

    expect(decResult.value.payload["sub"]).toBe("user1");
    expect(decResult.value.payload["role"]).toBe("admin");
    expect(decResult.value.payload["count"]).toBe(42);
    expect(decResult.value.payload["iat"]).toBe(Math.floor(fixedNow.getTime() / 1000));
  });

  it("generates UUID for jti: true", async () => {
    const result = await encodeToken({
      payload: { sub: "test", jti: true },
      secret: "secret",
      alg: "HS256",
      now: fixedNow,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decoded = decodeToken(result.value);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.value.payload["jti"]).toBeDefined();
    expect(typeof decoded.value.payload["jti"]).toBe("string");
    expect(decoded.value.payload["jti"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("sets kid in header", async () => {
    const result = await encodeToken({
      payload: { sub: "test" },
      secret: "secret",
      alg: "HS256",
      kid: "my-key-id",
      now: fixedNow,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decoded = decodeToken(result.value);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.header["kid"]).toBe("my-key-id");
    }
  });

  it("returns Err for algorithm none", async () => {
    const result = await encodeToken({
      payload: { sub: "test" },
      secret: "secret",
      alg: "none" as Parameters<typeof encodeToken>[0]["alg"],
      now: fixedNow,
    });

    expect(result.ok).toBe(false);
  });

  it("returns Err when no key is provided", async () => {
    const result = await encodeToken({
      payload: { sub: "test" },
      alg: "HS256",
      now: fixedNow,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_KEY");
    }
  });

  it("uses fake time for iat", async () => {
    const fakeTime = new Date("2020-01-01T00:00:00Z");
    const result = await encodeToken({
      payload: { sub: "test" },
      secret: "secret",
      alg: "HS256",
      now: fakeTime,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const decoded = decodeToken(result.value);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.payload["iat"]).toBe(
        Math.floor(fakeTime.getTime() / 1000)
      );
    }
  });
});
