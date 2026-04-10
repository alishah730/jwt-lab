import { describe, it, expect } from "vitest";
import { parseNaturalLanguagePayload } from "../../src/core/nlp.js";

describe("parseNaturalLanguagePayload", () => {
  const fixedNow = new Date("2024-06-15T12:00:00Z");
  const nowSec = Math.floor(fixedNow.getTime() / 1000);

  it("extracts expiry from 'expires in 1h'", () => {
    const result = parseNaturalLanguagePayload("token expires in 1h", fixedNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["exp"]).toBe(nowSec + 3600);
    }
  });

  it("extracts issuer from 'issued by auth.example.com'", () => {
    const result = parseNaturalLanguagePayload("token issued by auth.example.com", fixedNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["iss"]).toBe("auth.example.com");
    }
  });

  it("extracts subject from 'for user user@example.com'", () => {
    const result = parseNaturalLanguagePayload("token for user user@example.com", fixedNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["sub"]).toBe("user@example.com");
      expect(result.value["email"]).toBe("user@example.com");
    }
  });

  it("extracts admin role", () => {
    const result = parseNaturalLanguagePayload("admin token for testing", fixedNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["role"]).toBe("admin");
    }
  });

  it("extracts roles list", () => {
    const result = parseNaturalLanguagePayload("token with roles: admin, editor, viewer", fixedNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["roles"]).toEqual(["admin", "editor", "viewer"]);
    }
  });

  it("extracts scopes", () => {
    const result = parseNaturalLanguagePayload("token with scope: read, write", fixedNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["scope"]).toEqual(["read", "write"]);
    }
  });

  it("returns empty payload for unrecognized input", () => {
    const result = parseNaturalLanguagePayload("abcdef xyz 123", fixedNow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value).length).toBe(0);
    }
  });

  it("handles complex description", () => {
    const result = parseNaturalLanguagePayload(
      "admin token for user user@example.com that expires in 12h with roles: admin,editor issued by auth.myapp.com",
      fixedNow,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value["role"]).toBe("admin");
      expect(result.value["sub"]).toBe("user@example.com");
      expect(result.value["exp"]).toBe(nowSec + 43200);
      expect(result.value["roles"]).toEqual(["admin", "editor"]);
      expect(result.value["iss"]).toBe("auth.myapp.com");
    }
  });
});
