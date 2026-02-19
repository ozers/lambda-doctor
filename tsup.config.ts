import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node18',
  },
  {
    entry: ['src/bin/cli.ts'],
    format: ['esm'],
    sourcemap: true,
    target: 'node18',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
