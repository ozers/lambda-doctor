import fs from 'fs/promises';
import path from 'path';
import type { Analyzer, AnalyzerResult, Diagnostic } from '../../types.js';
import { findHeavyPackage, HEAVY_PACKAGES } from '../../known-heavy-packages.js';

const DEV_ONLY_PACKAGES = ['typescript', 'ts-node', 'ts-jest', 'jest', 'mocha', 'eslint', 'prettier', 'tsup', 'webpack', 'rollup', 'esbuild'];

export const heavyDependenciesAnalyzer: Analyzer = {
  name: 'heavy-dependencies',
  description: 'Detects known heavy dependencies and dev tools in production',

  async analyze(targetPath: string): Promise<AnalyzerResult> {
    const start = performance.now();
    const diagnostics: Diagnostic[] = [];

    try {
      const pkgJsonPath = path.join(targetPath, 'package.json');
      const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
      const deps = pkgJson.dependencies ?? {};
      const devDeps = pkgJson.devDependencies ?? {};
      let heavyCount = 0;

      // Check production dependencies against heavy packages list
      for (const depName of Object.keys(deps)) {
        const heavy = findHeavyPackage(depName);
        if (heavy) {
          heavyCount++;
          diagnostics.push({
            analyzer: 'heavy-dependencies',
            severity: 'warning',
            title: `Heavy dependency: ${depName}`,
            description: heavy.reason,
            recommendation: heavy.alternative,
            estimatedImpactMs: heavy.estimatedSavingsMs,
            filePath: 'package.json',
          });
        }
      }

      // Check if dev-only tools are in production dependencies
      for (const depName of Object.keys(deps)) {
        if (DEV_ONLY_PACKAGES.includes(depName)) {
          diagnostics.push({
            analyzer: 'heavy-dependencies',
            severity: 'critical',
            title: `Dev tool "${depName}" in production dependencies`,
            description: `"${depName}" is a development tool that should not be in "dependencies". It adds unnecessary size and cold start time.`,
            recommendation: `Move "${depName}" from "dependencies" to "devDependencies".`,
            estimatedImpactMs: findHeavyPackage(depName)?.estimatedSavingsMs ?? 100,
            filePath: 'package.json',
          });
        }
      }

      return {
        analyzer: 'heavy-dependencies',
        durationMs: performance.now() - start,
        diagnostics,
        metadata: { heavyCount, totalDependencies: Object.keys(deps).length },
      };
    } catch (error) {
      console.warn('heavy-dependencies analyzer warning:', error);
      return {
        analyzer: 'heavy-dependencies',
        durationMs: performance.now() - start,
        diagnostics: [],
      };
    }
  },
};
