import { z } from "zod";
import { SUPPORTED_ALGORITHMS } from "../core/types.js";

export const SupportedAlgorithmSchema = z.enum(SUPPORTED_ALGORITHMS);

export const ConfigSchema = z.object({
  defaults: z.object({
    iss: z.string().optional(),
    aud: z.string().optional(),
    alg: SupportedAlgorithmSchema.optional(),
    jwks: z.string().url().optional(),
  }).optional(),
  keys: z.record(z.string(), z.object({
    type: z.enum(["rsa", "ec", "ed25519"]).optional(),
    privateKeyPath: z.string().optional(),
    publicKeyPath: z.string().optional(),
  })).optional(),
  profiles: z.record(z.string(), z.object({
    ttl: z.string().optional(),
    scopes: z.array(z.string()).optional(),
    aud: z.string().optional(),
  })).optional(),
  lint: z.object({
    disabledRules: z.array(z.string()).optional(),
    severityOverrides: z.record(z.string(), z.enum(["info", "warn", "error"])).optional(),
    piiClaimPatterns: z.array(z.string()).optional(),
  }).optional(),
  mcp: z.object({
    port: z.number().int().positive().optional(),
    host: z.string().optional(),
    allowedOrigins: z.array(z.string()).optional(),
    redactClaims: z.array(z.string()).optional(),
    rateLimit: z.object({
      windowSeconds: z.number().int().positive().optional(),
      maxRequests: z.number().int().positive().optional(),
    }).optional(),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
