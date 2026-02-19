<div align="center">

# 🩺 Lambda Doctor

**Diagnose and fix AWS Lambda cold start performance issues.**

Static analysis CLI that scans your Node.js Lambda project and tells you exactly what's slowing down your cold starts — and how to fix it.

[![npm](https://img.shields.io/npm/v/lambda-doctor)](https://www.npmjs.com/package/lambda-doctor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

[Quick Start](#quick-start) · [What It Checks](#what-it-checks) · [Example Output](#example-output) · [How It Works](#how-it-works)

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
| **Heavy Dependencies** | Flags known heavy packages (moment, lodash, axios, etc.) and dev tools in production | 🔴 dev tools in prod, ⚠️ heavy deps |
| **Import Analysis** | Detects `import *` (tree-shaking blocker) and top-level heavy imports | ⚠️ per pattern |
| **AWS SDK** | Detects v2 usage, incomplete v2→v3 migration, unnecessary clients (e.g. SSO in Lambda) | 🔴 v2, ⚠️ mixed |
| **Bundler Detection** | Checks for esbuild/webpack/rollup/tsup — no bundler = biggest improvement opportunity | 🔴 no bundler |

## Example Output

```
🩺 Lambda Doctor — Diagnosis Report

🔴 CRITICAL  Dev tool "typescript" in production dependencies
   → Move "typescript" from "dependencies" to "devDependencies".
   ⏱  Est. improvement: ~500ms

🔴 CRITICAL  Using AWS SDK v2 (aws-sdk)
   → Migrate to AWS SDK v3 (@aws-sdk/client-*). Only import the clients you need.
   ⏱  Est. improvement: ~400ms

🔴 CRITICAL  No bundler detected
   → Add esbuild (fastest) or webpack to bundle your Lambda function.
   ⏱  Est. improvement: ~500ms

⚠️ WARNING   Heavy dependency: moment
   → Use dayjs (2KB) or date-fns with tree-shaking.
   ⏱  Est. improvement: ~50ms

⚠️ WARNING   Wildcard import of "aws-sdk" prevents tree-shaking
   → Use named imports: import { specificFunction } from "aws-sdk"
   ⏱  Est. improvement: ~20ms

Summary: 3 critical | 12 warnings | 1 info
🚀 Total estimated cold start improvement: ~2742.5ms
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
```

### Exit Codes

- `0` — No critical issues found
- `1` — Critical issues detected (useful for CI gates)

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
