/**
 * MCP server standalone entry point.
 * Used by `npm run mcp:serve` to start the server directly.
 */
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import type { Config } from "../config/schema.js";

const config: Config = {};
const app = createApp(config);

const port = parseInt(process.env["MCP_PORT"] ?? "3000", 10);
const host = process.env["MCP_HOST"] ?? "0.0.0.0";

console.log(`jwt-lab MCP server listening on http://${host}:${port}`);
console.log(`Docs: http://${host}:${port}/docs`);

serve({ fetch: app.fetch, port, hostname: host });
