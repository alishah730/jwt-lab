import { describe, it, expect } from "vitest";
import { decodeToken } from "../../src/core/decode.js";

/** Helper to create a base64url-encoded segment from a plain object. */
function b64url(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

describe("decodeToken", () => {
  it("decodes a well-formed JWT with 3 parts", () => {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = { sub: "user123", name: "Alice" };
    const token = `${b64url(header)}.${b64url(payload)}.fakesignature`;

    const result = decodeToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.header).toEqual(header);
      expect(result.value.payload).toEqual(payload);
      expect(result.value.signaturePresent).toBe(true);
    }
  });

  it("detects absent signature", () => {
    const header = { alg: "none" };
    const payload = { sub: "test" };
    const token = `${b64url(header)}.${b64url(payload)}.`;

    const result = decodeToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.signaturePresent).toBe(false);
    }
  });

  it("returns Err for a 2-part token", () => {
    const result = decodeToken("abc.def");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MALFORMED");
  });

  it("returns Err for a single string", () => {
    const result = decodeToken("not-a-jwt");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MALFORMED");
  });

  it("returns Err when header is not valid JSON", () => {
    const badHeader = Buffer.from("not-json").toString("base64url");
    const payload = b64url({ sub: "test" });
    const result = decodeToken(`${badHeader}.${payload}.sig`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_JSON");
  });

  it("returns Err when payload is not valid JSON", () => {
    const header = b64url({ alg: "HS256" });
    const badPayload = Buffer.from("not-json").toString("base64url");
    const result = decodeToken(`${header}.${badPayload}.sig`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_JSON");
  });

  it("returns Err for empty string", () => {
    const result = decodeToken("");
    expect(result.ok).toBe(false);
  });
});
