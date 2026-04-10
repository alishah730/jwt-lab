/**
 * MCP Hono application factory.
 * Creates the fully configured Hono app with middleware and routes.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Config } from "../config/schema.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { encodeRoute } from "./routes/encode.js";
import { createDecodeRoute } from "./routes/decode.js";
import { createVerifyRoute } from "./routes/verify.js";
import { createInspectRoute } from "./routes/inspect.js";
import { keygenRoute } from "./routes/keygen.js";
import { createExplainRoute } from "./routes/explain.js";

/**
 * Creates the OpenAPI 3.1 spec document for the MCP server.
 */
function buildOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "jwt-lab MCP Server",
      description: "Model Context Protocol HTTP/JSON server for JWT operations. All JWT logic is shared with the jwt-lab CLI.",
      version: "0.1.0",
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
    },
    paths: {
      "/encode": {
        post: {
          summary: "Encode a JWT token",
          description: "Sign a payload and return a JWT token string.",
          requestBody: { content: { "application/json": { schema: { "$ref": "#/components/schemas/EncodeRequest" } } }, required: true },
          responses: {
            "200": { description: "Encoded token", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } } },
            "400": { description: "Encoding error" },
            "422": { description: "Validation error" },
          },
        },
      },
      "/decode": {
        post: {
          summary: "Decode a JWT without verification",
          requestBody: { content: { "application/json": { schema: { "$ref": "#/components/schemas/DecodeRequest" } } }, required: true },
          responses: {
            "200": { description: "Decoded token parts" },
            "400": { description: "Malformed token" },
            "422": { description: "Validation error" },
          },
        },
      },
      "/verify": {
        post: {
          summary: "Verify a JWT signature and claims",
          requestBody: { content: { "application/json": { schema: { "$ref": "#/components/schemas/VerifyRequest" } } }, required: true },
          responses: {
            "200": { description: "Verification result" },
            "400": { description: "Verification failed" },
            "422": { description: "Validation error" },
          },
        },
      },
      "/inspect": {
        post: {
          summary: "Inspect a JWT — status, metadata, security posture",
          requestBody: { content: { "application/json": { schema: { "$ref": "#/components/schemas/InspectRequest" } } }, required: true },
          responses: {
            "200": { description: "Inspection result" },
            "400": { description: "Invalid token" },
            "422": { description: "Validation error" },
          },
        },
      },
      "/keygen": {
        post: {
          summary: "Generate a cryptographic key pair",
          requestBody: { content: { "application/json": { schema: { "$ref": "#/components/schemas/KeygenRequest" } } }, required: true },
          responses: {
            "200": { description: "Generated key pair" },
            "400": { description: "Generation error" },
            "422": { description: "Validation error" },
          },
        },
      },
      "/explain": {
        post: {
          summary: "Static security audit of a JWT",
          requestBody: { content: { "application/json": { schema: { "$ref": "#/components/schemas/ExplainRequest" } } }, required: true },
          responses: {
            "200": { description: "Lint findings" },
            "400": { description: "Malformed token" },
            "422": { description: "Validation error" },
          },
        },
      },
      "/docs": {
        get: {
          summary: "OpenAPI specification",
          responses: { "200": { description: "OpenAPI 3.1 JSON document" } },
        },
      },
    },
    components: {
      schemas: {
        EncodeRequest: {
          type: "object",
          required: ["payload"],
          properties: {
            payload: { type: "object", additionalProperties: true },
            alg: { type: "string", default: "HS256" },
            secret: { type: "string" },
            privateKeyPem: { type: "string" },
            privateKeyJwk: { type: "object" },
            exp: { type: "string", description: "Duration string, e.g. '1h'" },
            iss: { type: "string" },
            sub: { type: "string" },
            aud: { type: "string" },
            kid: { type: "string" },
            header: { type: "object" },
            jti: { type: "boolean" },
            fakeTime: { type: "string", format: "date-time" },
          },
        },
        DecodeRequest: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string", minLength: 1 } },
        },
        VerifyRequest: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
            secret: { type: "string" },
            publicKeyPem: { type: "string" },
            publicKeyJwk: { type: "object" },
            jwksUri: { type: "string", format: "uri" },
            alg: { type: "string" },
            requiredClaims: { type: "array", items: { type: "string" } },
            leewaySeconds: { type: "integer", minimum: 0 },
            fakeTime: { type: "string", format: "date-time" },
          },
        },
        InspectRequest: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
            secret: { type: "string" },
            publicKeyPem: { type: "string" },
            publicKeyJwk: { type: "object" },
            jwksUri: { type: "string", format: "uri" },
            alg: { type: "string" },
            fakeTime: { type: "string", format: "date-time" },
          },
        },
        KeygenRequest: {
          type: "object",
          required: ["type"],
          properties: {
            type: { type: "string", enum: ["rsa", "ec", "ed25519"] },
            format: { type: "string", enum: ["jwk", "pem"], default: "jwk" },
            kid: { type: "string" },
            rsaBits: { type: "integer", minimum: 2048 },
            ecCurve: { type: "string" },
          },
        },
        ExplainRequest: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string", minLength: 1 } },
        },
      },
    },
  };
}

/**
 * Creates and configures the Hono MCP application.
 *
 * @param config - The loaded jwt-lab configuration.
 * @returns A configured Hono application.
 */
export function createApp(config: Config): Hono {
  const app = new Hono();

  // 1. CORS
  const allowedOrigins = config.mcp?.allowedOrigins ?? ["*"];
  app.use("*", cors({ origin: allowedOrigins }));

  // 2. Rate limiting
  const rlOpts = config.mcp?.rateLimit;
  app.use("*", rateLimitMiddleware({
    windowSeconds: rlOpts?.windowSeconds,
    maxRequests: rlOpts?.maxRequests,
  }));

  // 3. Auth (skips /docs)
  const apiKey = process.env["MCP_API_KEY"];
  app.use("/encode", authMiddleware(apiKey));
  app.use("/decode", authMiddleware(apiKey));
  app.use("/verify", authMiddleware(apiKey));
  app.use("/inspect", authMiddleware(apiKey));
  app.use("/keygen", authMiddleware(apiKey));
  app.use("/explain", authMiddleware(apiKey));

  // 4. Routes
  app.route("/", encodeRoute);
  app.route("/", createDecodeRoute(config));
  app.route("/", createVerifyRoute(config));
  app.route("/", createInspectRoute(config));
  app.route("/", keygenRoute);
  app.route("/", createExplainRoute(config));

  // 5. OpenAPI docs
  app.get("/docs", (c) => c.json(buildOpenApiSpec()));

  // 6. Health check
  app.get("/health", (c) => c.json({ status: "ok", service: "jwt-lab-mcp" }));

  // 7. Global error handler
  app.onError((error, c) => {
    console.error(`[MCP] Internal error: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}
