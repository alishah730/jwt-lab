/**
 * Zod schemas for all MCP endpoint request/response validation.
 */
import { z } from "zod";

export const EncodeRequestSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  alg: z.string().default("HS256"),
  secret: z.string().optional(),
  privateKeyPem: z.string().optional(),
  privateKeyJwk: z.record(z.string(), z.unknown()).optional(),
  exp: z.string().optional(),
  iss: z.string().optional(),
  sub: z.string().optional(),
  aud: z.string().optional(),
  kid: z.string().optional(),
  header: z.record(z.string(), z.unknown()).optional(),
  jti: z.boolean().optional(),
  fakeTime: z.string().datetime().optional(),
});

export const DecodeRequestSchema = z.object({
  token: z.string().min(1),
});

export const VerifyRequestSchema = z.object({
  token: z.string().min(1),
  secret: z.string().optional(),
  publicKeyPem: z.string().optional(),
  publicKeyJwk: z.record(z.string(), z.unknown()).optional(),
  jwksUri: z.string().url().optional(),
  alg: z.string().optional(),
  requiredClaims: z.array(z.string()).optional(),
  leewaySeconds: z.number().int().nonnegative().optional(),
  fakeTime: z.string().datetime().optional(),
});

export const InspectRequestSchema = z.object({
  token: z.string().min(1),
  secret: z.string().optional(),
  publicKeyPem: z.string().optional(),
  publicKeyJwk: z.record(z.string(), z.unknown()).optional(),
  jwksUri: z.string().url().optional(),
  alg: z.string().optional(),
  fakeTime: z.string().datetime().optional(),
});

export const KeygenRequestSchema = z.object({
  type: z.enum(["rsa", "ec", "ed25519"]),
  format: z.enum(["jwk", "pem"]).default("jwk"),
  kid: z.string().optional(),
  rsaBits: z.number().int().min(2048).optional(),
  ecCurve: z.string().optional(),
});

export const ExplainRequestSchema = z.object({
  token: z.string().min(1),
});
