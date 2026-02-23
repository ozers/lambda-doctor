# Lambda Doctor — Implementation Guide

Project scaffold is ready. Implement in the following order.

## Implementation Order

### 1. `src/analyzers/bundle-size.ts`
- Scan all files under `node_modules/` using `fast-glob`
- Group scoped packages correctly (`@aws-sdk/client-dynamodb` → `@aws-sdk/client-dynamodb`)
- Collect file sizes via `fs.stat`
- Report top 10 largest dependencies
- Thresholds: >50MB critical, >10MB warning, single dep >5MB critical, >1MB warning

### 2. `src/analyzers/heavy-dependencies.ts`
- Read `package.json`, split `dependencies` and `devDependencies`
- Check each dependency against `known-heavy-packages.ts`
- Flag dev tools (typescript, ts-node) in `dependencies` as critical
- Add alternative and estimatedSavingsMs to each diagnostic

### 3. `src/analyzers/import-analysis.ts`
- Find `.ts`, `.js`, `.mjs` files using `fast-glob` (excluding node_modules)
- Extract import/require patterns with regex:
  - ESM: `/^import\s+.*\s+from\s+['"](.+)['"]/gm`
  - CJS: `/^(?:const|let|var)\s+.*=\s*require\(['"](.+)['"]\)/gm`
- Top-level vs function-body detection: line indentation 0-1 = top-level
- Flag top-level imports of heavy packages
- Flag `import * as` patterns (blocks tree-shaking)

### 4. `src/analyzers/aws-sdk.ts`
- `aws-sdk` (v2) in package.json → critical
- `@aws-sdk/client-*` present → good, count them
- Both v2 and v3 → warning (incomplete migration)
- More than 5 @aws-sdk clients → info (too many clients)
- `@aws-sdk/client-sso` import in source → warning (unnecessary in Lambda)

### 5. `src/analyzers/bundler-detection.ts`
- Check devDependencies for bundlers: esbuild, webpack, rollup, tsup, parcel
- Check for config files: webpack.config.*, rollup.config.*, tsup.config.*, esbuild.config.*
- Check package.json scripts for bundler keywords
- Check serverless.yml for serverless-esbuild or serverless-webpack
- Check for `"type": "module"` (ESM)
- No bundler found → critical (biggest optimization opportunity)

### 6. `src/reporters/console.ts`
- Colored output with chalk
- Severity icon mapping: critical=🔴, warning=⚠️, info=💡
- Bundle size breakdown (top dependencies table)
- Diagnostics sorted by severity
- Footer with total estimated improvement

### 7. `src/bin/cli.ts`
- Show ora spinner during analysis
- Error handling: meaningful messages for missing path or package.json
- JSON output format support
- Exit code 1 if critical issues found

## Quality Standards

- Each analyzer returns its own AnalyzerResult
- All file I/O must be async (fs/promises)
- Every diagnostic must have: title, description, recommendation, estimatedImpactMs
- No analyzer should crash — return empty result on error, log warning to console
- Test fixtures: unhealthy-lambda must have at least 8 issues
- Test fixtures: healthy-lambda must have 0 critical issues

## Run & Verify

```bash
npm install
npm run build
npm test

# Manual test with fixtures
node dist/bin/cli.js analyze test/fixtures/unhealthy-lambda
node dist/bin/cli.js analyze test/fixtures/healthy-lambda
node dist/bin/cli.js analyze test/fixtures/unhealthy-lambda --format json
```
