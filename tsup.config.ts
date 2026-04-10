import { defineConfig } from 'tsup';

export default defineConfig([
  // Library API — importable by TypeScript projects
  {
    entry: { index: 'src/core/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    shims: true,
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: { mcp: 'src/mcp/server.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    shims: true,
  },
]);
