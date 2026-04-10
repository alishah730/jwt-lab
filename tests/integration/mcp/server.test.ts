import { describe, it, expect } from "vitest";
import { createApp } from "../../../src/mcp/app.js";
import type { Config } from "../../../src/config/schema.js";

describe("MCP Server", () => {
  const config: Config = {};
  const app = createApp(config);

  describe("GET /docs", () => {
    it("returns OpenAPI spec", async () => {
      const res = await app.request("/docs");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.openapi).toBe("3.1.0");
      expect(body.info.title).toBe("jwt-lab MCP Server");
      expect(body.paths).toHaveProperty("/encode");
      expect(body.paths).toHaveProperty("/decode");
      expect(body.paths).toHaveProperty("/verify");
    });
  });

  describe("GET /health", () => {
    it("returns health check", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
    });
  });

  describe("POST /encode", () => {
    it("encodes a token with HMAC secret", async () => {
      const res = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { sub: "user1", role: "admin" },
          secret: "test-secret",
          alg: "HS256",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe("string");
    });

    it("returns 422 for invalid body", async () => {
      const res = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invalid: true }),
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors).toBeDefined();
    });

    it("returns 400 when no key provided", async () => {
      const res = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { sub: "test" } }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /decode", () => {
    it("decodes a valid token", async () => {
      // First encode
      const encRes = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { sub: "user1" },
          secret: "test-secret",
          alg: "HS256",
        }),
      });
      const { token } = await encRes.json();

      const res = await app.request("/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.header.alg).toBe("HS256");
      expect(body.payload.sub).toBe("user1");
      expect(body.signaturePresent).toBe(true);
    });

    it("returns 422 for missing token", async () => {
      const res = await app.request("/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /verify", () => {
    it("verifies a valid token", async () => {
      const fakeTime = "2024-06-15T12:00:00Z";
      const encRes = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { sub: "user1" },
          secret: "test-secret",
          alg: "HS256",
          exp: "1h",
          fakeTime,
        }),
      });
      const { token } = await encRes.json();

      const res = await app.request("/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, secret: "test-secret", fakeTime }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(true);
    });

    it("returns 400 for wrong secret", async () => {
      const fakeTime = "2024-06-15T12:00:00Z";
      const encRes = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { sub: "user1" },
          secret: "correct-secret",
          alg: "HS256",
          exp: "1h",
          fakeTime,
        }),
      });
      const { token } = await encRes.json();

      const res = await app.request("/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, secret: "wrong-secret", fakeTime }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.valid).toBe(false);
    });
  });

  describe("POST /inspect", () => {
    it("inspects a valid token", async () => {
      const fakeTime = "2024-06-15T12:00:00Z";
      const encRes = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { sub: "user1", iss: "auth.example.com" },
          secret: "test-secret",
          alg: "HS256",
          exp: "1h",
          fakeTime,
        }),
      });
      const { token } = await encRes.json();

      const res = await app.request("/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fakeTime }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.algorithm).toBe("HS256");
      expect(body.issuer).toBe("auth.example.com");
      expect(body.subject).toBe("user1");
    });
  });

  describe("POST /keygen", () => {
    it("generates EC key pair", async () => {
      const res = await app.request("/keygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ec", format: "jwk" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.privateKey).toBeDefined();
      expect(body.publicKey).toBeDefined();
    });

    it("returns 422 for invalid type", async () => {
      const res = await app.request("/keygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invalid" }),
      });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /explain", () => {
    it("returns lint findings", async () => {
      const encRes = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: { sub: "test", email: "test@example.com" },
          secret: "test-secret",
          alg: "HS256",
        }),
      });
      const { token } = await encRes.json();

      const res = await app.request("/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.findings)).toBe(true);
      expect(body.findings.length).toBeGreaterThan(0);
    });
  });
});

describe("MCP Auth Middleware", () => {
  it("returns 401 when API key is required but missing", async () => {
    // Set env var
    const originalKey = process.env["MCP_API_KEY"];
    process.env["MCP_API_KEY"] = "test-api-key-12345";
    try {
      const app = createApp({});
      const res = await app.request("/encode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { sub: "test" }, secret: "s", alg: "HS256" }),
      });
      expect(res.status).toBe(401);
    } finally {
      if (originalKey) {
        process.env["MCP_API_KEY"] = originalKey;
      } else {
        delete process.env["MCP_API_KEY"];
      }
    }
  });

  it("allows request with correct API key", async () => {
    const originalKey = process.env["MCP_API_KEY"];
    process.env["MCP_API_KEY"] = "test-api-key-12345";
    try {
      const app = createApp({});
      const res = await app.request("/encode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-api-key-12345",
        },
        body: JSON.stringify({ payload: { sub: "test" }, secret: "s", alg: "HS256" }),
      });
      expect(res.status).toBe(200);
    } finally {
      if (originalKey) {
        process.env["MCP_API_KEY"] = originalKey;
      } else {
        delete process.env["MCP_API_KEY"];
      }
    }
  });
});

describe("MCP Claim Redaction", () => {
  it("redacts configured claims in decode response", async () => {
    const config: Config = { mcp: { redactClaims: ["email", "name"] } };
    const app = createApp(config);

    // Encode first
    const encRes = await app.request("/encode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: { sub: "test", email: "secret@example.com", name: "Secret Name" },
        secret: "test-secret",
        alg: "HS256",
      }),
    });
    const { token } = await encRes.json();

    // Decode
    const res = await app.request("/decode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload.email).toBe("[REDACTED]");
    expect(body.payload.name).toBe("[REDACTED]");
    expect(body.payload.sub).toBe("test");
  });
});
