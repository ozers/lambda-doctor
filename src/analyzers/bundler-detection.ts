import fs from 'fs/promises';
import fg from 'fast-glob';
import path from 'path';
import type { Analyzer, AnalyzerResult, Diagnostic } from '../../types.js';

const BUNDLER_PACKAGES = [
  'esbuild', 'webpack', 'rollup', 'tsup', 'parcel',
  '@rsbuild/core', 'rspack', '@rspack/core',
  'turbopack', 'swc', '@swc/core', 'bun',
  'vite',
];
const BUNDLER_CONFIGS = [
  'webpack.config.*',
  'rollup.config.*',
  'tsup.config.*',
  'esbuild.config.*',
  '.parcelrc',
  'rsbuild.config.*',
  'rspack.config.*',
  'vite.config.*',
  '.swcrc',
];
const BUNDLER_KEYWORDS = [
  'esbuild', 'webpack', 'rollup', 'tsup', 'parcel', 'bundle',
  'rsbuild', 'rspack', 'turbopack', 'swc', 'vite',
];

export const bundlerDetectionAnalyzer: Analyzer = {
  name: 'bundler-detection',
  description: 'Detects whether a bundler is configured and checks ESM/bundler setup',

  async analyze(targetPath: string): Promise<AnalyzerResult> {
    const start = performance.now();
    const diagnostics: Diagnostic[] = [];

    try {
      const pkgJsonPath = path.join(targetPath, 'package.json');
      const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
      const devDeps = pkgJson.devDependencies ?? {};
      const deps = pkgJson.dependencies ?? {};
      const allDeps = { ...deps, ...devDeps };
      const scripts = pkgJson.scripts ?? {};

      // Check for bundler packages
      const detectedBundlers: string[] = [];
      for (const bundler of BUNDLER_PACKAGES) {
        if (bundler in allDeps) {
          detectedBundlers.push(bundler);
        }
      }

      // Check for config files
      const configFiles = await fg(BUNDLER_CONFIGS, {
        cwd: targetPath,
        dot: true,
      });

      // Check scripts for bundler keywords
      const bundlerScripts: string[] = [];
      for (const [name, script] of Object.entries(scripts)) {
        if (typeof script === 'string' && BUNDLER_KEYWORDS.some((kw) => script.includes(kw))) {
          bundlerScripts.push(name);
        }
      }

      // Check serverless.yml for bundler plugins
      let serverlessPlugin: string | null = null;
      try {
        const slsPath = path.join(targetPath, 'serverless.yml');
        const slsContent = await fs.readFile(slsPath, 'utf-8');
        if (slsContent.includes('serverless-esbuild')) serverlessPlugin = 'serverless-esbuild';
        else if (slsContent.includes('serverless-webpack')) serverlessPlugin = 'serverless-webpack';
      } catch {
        // serverless.yml not found, that's fine
      }

      // Check ESM
      const isESM = pkgJson.type === 'module';

      const hasBundler = detectedBundlers.length > 0 || configFiles.length > 0 || serverlessPlugin !== null;

      if (!hasBundler) {
        diagnostics.push({
          analyzer: 'bundler-detection',
          severity: 'critical',
          title: 'No bundler detected',
          description: 'No bundler (esbuild, webpack, rollup, etc.) was found in this project. Without a bundler, the entire node_modules directory is deployed, causing large bundle sizes and slow cold starts.',
          recommendation: 'Add esbuild (fastest) or webpack to bundle your Lambda function. This is typically the single biggest cold start improvement you can make.',
          estimatedImpactMs: 500,
        });
      } else {
        diagnostics.push({
          analyzer: 'bundler-detection',
          severity: 'info',
          title: `Bundler detected: ${detectedBundlers.join(', ') || serverlessPlugin || 'config found'}`,
          description: `Found bundler setup: packages=[${detectedBundlers.join(', ')}], configs=[${configFiles.join(', ')}]${serverlessPlugin ? `, serverless plugin=${serverlessPlugin}` : ''}.`,
          recommendation: 'Ensure your bundler is configured for tree-shaking and minification.',
          estimatedImpactMs: 0,
        });
      }

      if (!isESM) {
        diagnostics.push({
          analyzer: 'bundler-detection',
          severity: 'info',
          title: 'Project is not using ESM',
          description: '"type": "module" is not set in package.json. ESM enables better tree-shaking with bundlers.',
          recommendation: 'Consider setting "type": "module" in package.json for better tree-shaking support.',
          estimatedImpactMs: 20,
        });
      }

      return {
        analyzer: 'bundler-detection',
        durationMs: performance.now() - start,
        diagnostics,
        metadata: {
          detectedBundlers,
          configFiles,
          bundlerScripts,
          serverlessPlugin,
          isESM,
          hasBundler,
        },
      };
    } catch (error) {
      console.warn('bundler-detection analyzer warning:', error);
      return {
        analyzer: 'bundler-detection',
        durationMs: performance.now() - start,
        diagnostics: [],
      };
    }
  },
};
