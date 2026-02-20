import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import type { Analyzer, AnalyzerResult, Diagnostic } from '../../types.js';
import { DEFAULT_EXCLUDE_PATTERNS } from '../../types.js';
import { isHeavyPackage, findHeavyPackage } from '../../known-heavy-packages.js';

const ESM_IMPORT = /^import\s+.*\s+from\s+['"](.+)['"]/gm;
const CJS_REQUIRE = /^(?:const|let|var)\s+.*=\s*require\(['"](.+)['"]\)/gm;
const WILDCARD_IMPORT = /^import\s+\*\s+as\s+\w+\s+from\s+['"](.+)['"]/gm;

// Packages where wildcard import is standard practice or has no cold start impact
const WILDCARD_ALLOWLIST = new Set([
  // Node builtins
  'path', 'fs', 'fs/promises', 'os', 'url', 'util', 'crypto', 'stream', 'http', 'https',
  'child_process', 'events', 'buffer', 'querystring', 'zlib', 'net', 'tls',
  'dns', 'dgram', 'cluster', 'readline', 'assert', 'timers', 'perf_hooks',
  'worker_threads', 'async_hooks', 'tty',
  // Node builtins with node: protocol
  'node:path', 'node:fs', 'node:fs/promises', 'node:os', 'node:url', 'node:util',
  'node:crypto', 'node:http', 'node:https', 'node:stream', 'node:events',
  'node:buffer', 'node:querystring', 'node:child_process', 'node:cluster',
  'node:net', 'node:readline', 'node:zlib', 'node:assert', 'node:tty',
  // Frontend frameworks (shouldn't be in Lambda, but don't false-positive)
  'react', 'react-dom', 'vue', 'svelte', 'preact',
  // IaC SDKs (deploy-time, not Lambda runtime)
  '@pulumi/aws', '@pulumi/pulumi', '@pulumi/cloud', '@pulumi/random', '@pulumi/awsx',
  // AWS CDK
  'aws-cdk-lib', '@aws-cdk/core', 'constructs',
]);

function isWildcardAllowed(pkg: string): boolean {
  if (WILDCARD_ALLOWLIST.has(pkg)) return true;
  // Allow all node: protocol imports
  if (pkg.startsWith('node:')) return true;
  // Allow @pulumi/* and @aws-cdk/* scoped packages
  if (pkg.startsWith('@pulumi/') || pkg.startsWith('@aws-cdk/')) return true;
  return false;
}

function getPackageName(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  const parts = specifier.split('/');
  if (parts[0].startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0];
}

function isTopLevel(line: string): boolean {
  const indent = line.length - line.trimStart().length;
  return indent <= 1;
}

export const importAnalysisAnalyzer: Analyzer = {
  name: 'import-analysis',
  description: 'Analyzes import patterns for tree-shaking issues and heavy top-level imports',

  async analyze(targetPath: string, exclude?: string[]): Promise<AnalyzerResult> {
    const start = performance.now();
    const diagnostics: Diagnostic[] = [];

    try {
      const files = await fg(['**/*.ts', '**/*.js', '**/*.mjs'], {
        cwd: targetPath,
        ignore: exclude ?? DEFAULT_EXCLUDE_PATTERNS,
        absolute: false,
      });

      for (const file of files) {
        const filePath = path.join(targetPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Check wildcard imports (tree-shaking issue)
          let match: RegExpExecArray | null;
          WILDCARD_IMPORT.lastIndex = 0;
          while ((match = WILDCARD_IMPORT.exec(line)) !== null) {
            const pkg = getPackageName(match[1]);
            if (pkg && !isWildcardAllowed(pkg) && !WILDCARD_ALLOWLIST.has(match[1])) {
              diagnostics.push({
                analyzer: 'import-analysis',
                severity: 'warning',
                title: `Wildcard import of "${pkg}" prevents tree-shaking`,
                description: `"import * as ..." from "${match[1]}" imports the entire module, preventing bundlers from removing unused code.`,
                recommendation: `Use named imports: import { specificFunction } from "${match[1]}"`,
                estimatedImpactMs: 20,
                filePath: file,
                line: i + 1,
              });
            }
          }

          // Check top-level heavy imports
          if (isTopLevel(line)) {
            for (const regex of [ESM_IMPORT, CJS_REQUIRE]) {
              regex.lastIndex = 0;
              while ((match = regex.exec(line)) !== null) {
                const pkg = getPackageName(match[1]);
                if (pkg && isHeavyPackage(pkg)) {
                  const heavy = findHeavyPackage(pkg)!;
                  diagnostics.push({
                    analyzer: 'import-analysis',
                    severity: 'warning',
                    title: `Top-level import of heavy package "${pkg}"`,
                    description: `"${pkg}" is imported at the top level in ${file}. This forces it to load during cold start even if not needed for every invocation.`,
                    recommendation: `Consider lazy-loading: move the import inside the function that uses it. ${heavy.alternative}`,
                    estimatedImpactMs: heavy.estimatedSavingsMs / 2,
                    filePath: file,
                    line: i + 1,
                  });
                }
              }
            }
          }
        }
      }

      return {
        analyzer: 'import-analysis',
        durationMs: performance.now() - start,
        diagnostics,
        metadata: { filesScanned: files.length },
      };
    } catch (error) {
      console.warn('import-analysis analyzer warning:', error);
      return {
        analyzer: 'import-analysis',
        durationMs: performance.now() - start,
        diagnostics: [],
      };
    }
  },
};
