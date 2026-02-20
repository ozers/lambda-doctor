<div align="center">

# 🩺 Lambda Doctor

**Diagnose and fix AWS Lambda cold start performance issues.**

Static analysis CLI that scans your Node.js Lambda project and tells you exactly what's slowing down your cold starts — and how to fix it.

[![npm](https://img.shields.io/npm/v/lambda-doctor)](https://www.npmjs.com/package/lambda-doctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

[Quick Start](#quick-start) · [What It Checks](#what-it-checks) · [Real-World Results](#real-world-results) · [CLI Options](#cli-options)

</div>

---

## The Problem

Your Lambda cold starts take 3+ seconds. You've read every blog post. You know you should "use smaller packages" and "bundle your code" — but which packages are actually heavy? Are your imports tree-shakeable? Is your AWS SDK setup optimal?

**Lambda Doctor** runs a single command and gives you a prioritized, actionable report with estimated millisecond savings for each issue.

## Quick Start

```bash
npm install -g lambda-doctor
```

```bash
lambda-doctor analyze ./my-lambda
```

That's it. You get a full diagnosis in seconds.

## What It Checks

| Analyzer | What it does | Severity |
|---|---|---|
| **Bundle Size** | Scans `node_modules`, reports total size and top 10 largest packages | 🔴 >50MB, ⚠️ >10MB |
| **Heavy Dependencies** | Flags known heavy packages (moment, lodash, axios, mongoose, etc.) and dev tools in production | 🔴 dev tools in prod, ⚠️ heavy deps |
| **Import Analysis** | Detects `import *` (tree-shaking blocker) and top-level heavy imports | ⚠️ per pattern |
| **AWS SDK** | Detects v2 usage, incomplete v2→v3 migration, unnecessary clients (e.g. SSO in Lambda) | 🔴 v2, ⚠️ mixed |
| **Bundler Detection** | Checks for esbuild/webpack/rollup/tsup — no bundler = biggest improvement opportunity | 🔴 no bundler |

## Real-World Results

We tested Lambda Doctor against popular open-source serverless projects:

| Project | ⭐ Stars | Critical | Warnings | Est. Improvement |
|---|---|---|---|---|
| [webiny/webiny-js](https://github.com/webiny/webiny-js) | 7.9k | 1 | 132 | **~2.7s** |
| [aws-powertools/powertools-lambda-typescript](https://github.com/aws-powertools/powertools-lambda-typescript) | 1.8k | 1 | 3 | ~920ms |
| [anomalyco/demo-notes-app](https://github.com/anomalyco/demo-notes-app) (SST Guide) | 195 | 1 | 2 | ~542ms |
| [adamjq/production-ready-serverless-nestjs](https://github.com/adamjq/production-ready-serverless-nestjs) | 40 | 0 | 5 | ~350ms |

### Example: NestJS Lambda API

Running against [adamjq/production-ready-serverless-nestjs](https://github.com/adamjq/production-ready-serverless-nestjs) — a production-ready NestJS GraphQL API on AWS Lambda with Prisma and Webpack:

```
🩺 Lambda Doctor — Diagnosis Report
   Target: ./production-ready-serverless-nestjs

🔍 Diagnostics

⚠️ WARNING Heavy dependency: @nestjs/core (package.json)
   NestJS is a heavy framework (5MB+). Decorator metadata and DI container add cold start overhead.
   → Use lighter patterns for Lambda: plain handlers or lambda-api.
   ⏱  Est. improvement: ~150ms

⚠️ WARNING Heavy dependency: express (package.json)
   Express has 30+ dependencies. Heavy for a single Lambda function.
   → Use lambda-api (zero deps) or direct API Gateway event parsing.
   ⏱  Est. improvement: ~20ms

⚠️ WARNING Top-level import of heavy package "@nestjs/core" (src/lambda.ts:1)
   "@nestjs/core" is imported at the top level in src/lambda.ts.
   → Consider lazy-loading: move the import inside the function that uses it.
   ⏱  Est. improvement: ~75ms

💡 INFO Bundler detected: webpack
   Found bundler setup: packages=[webpack], configs=[webpack.config.js].
   → Ensure your bundler is configured for tree-shaking and minification.

💡 INFO Project is not using ESM
   → Consider setting "type": "module" in package.json for better tree-shaking support.
   ⏱  Est. improvement: ~20ms

────────────────────────────────────────────────────────────
Summary: 0 critical | 5 warnings | 2 info

🚀 Total estimated cold start improvement: ~350ms
```

### Example: SST Demo Notes App

Running against [anomalyco/demo-notes-app](https://github.com/anomalyco/demo-notes-app) — the official SST Guide demo app:

```
🩺 Lambda Doctor — Diagnosis Report
   Target: ./demo-notes-app

🔍 Diagnostics

🔴 CRITICAL No bundler detected
   No bundler (esbuild, webpack, rollup, etc.) was found in this project.
   → Add esbuild (fastest) or webpack to bundle your Lambda function.
   ⏱  Est. improvement: ~500ms

⚠️ WARNING Wildcard import of "uuid" prevents tree-shaking (packages/functions/src/create.ts:1)
   → Use named imports: import { specificFunction } from "uuid"
   ⏱  Est. improvement: ~20ms

⚠️ WARNING Top-level import of heavy package "uuid" (packages/functions/src/create.ts:1)
   → Use crypto.randomUUID() (built-in Node 18+).
   ⏱  Est. improvement: ~2.5ms

────────────────────────────────────────────────────────────
Summary: 1 critical | 2 warnings | 1 info

🚀 Total estimated cold start improvement: ~542.5ms
```

## How It Works

```
lambda-doctor analyze ./my-lambda
         │
         ▼
┌─────────────────────┐
│   Read package.json  │
│   Scan node_modules  │
│   Parse source files │
└────────┬────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  5 Analyzers (run in parallel)  │
│  ├─ Bundle Size                 │
│  ├─ Heavy Dependencies          │
│  ├─ Import Analysis             │
│  ├─ AWS SDK                     │
│  └─ Bundler Detection           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Diagnosis Report               │
│  ├─ Prioritized by severity     │
│  ├─ Actionable recommendations  │
│  └─ Estimated ms savings each   │
└─────────────────────────────────┘
```

All analyzers run in parallel and never crash — if one fails, you still get results from the others.

## CLI Options

```bash
# Console output (default)
lambda-doctor analyze ./my-lambda

# JSON output (for CI/CD pipelines)
lambda-doctor analyze ./my-lambda --format json

# Add custom exclude patterns
lambda-doctor analyze ./my-lambda --exclude "scripts/**,packages/frontend/**"

# Disable default excludes (scan everything including tests)
lambda-doctor analyze ./my-lambda --no-default-excludes
```

### Smart Defaults

Lambda Doctor automatically excludes test and build files that don't run in Lambda:

```
__tests__/  *.test.*  *.spec.*  test/  tests/
cypress/  coverage/  dist/  build/  cdk.out/  .serverless/
```

You can override this with `--no-default-excludes` or add more patterns with `--exclude`.

### Exit Codes

- `0` — No critical issues found
- `1` — Critical issues detected (useful for CI gates)

### Programmatic API

```typescript
import { analyze } from 'lambda-doctor';

const report = await analyze({
  targetPath: './my-lambda',
  format: 'json',
  exclude: ['scripts/**', 'frontend/**'],
});

console.log(report.summary);
// { totalIssues: 7, critical: 1, warnings: 5, info: 1, estimatedTotalImpactMs: 820 }
```

## Requirements

- Node.js >= 18

## Contributing

Contributions are welcome! Please check out the [issues](https://github.com/ozers/lambda-doctor/issues) page.

```bash
git clone https://github.com/ozers/lambda-doctor.git
cd lambda-doctor
npm install
npm run build
npm test
```

## License

[MIT](LICENSE)

---

<div align="center">

Built by [Ozer](https://github.com/ozers) — because staring at CloudWatch cold start metrics at 2am shouldn't be a regular thing.

</div>