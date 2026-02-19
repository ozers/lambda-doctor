import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import type { Analyzer, AnalyzerResult, Diagnostic, DependencyInfo } from '../../types.js';

function getPackageName(filePath: string): string {
  // filePath is relative to node_modules, e.g. "@aws-sdk/client-s3/dist/index.js"
  const parts = filePath.split('/');
  if (parts[0].startsWith('@')) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

export const bundleSizeAnalyzer: Analyzer = {
  name: 'bundle-size',
  description: 'Analyzes total node_modules size and identifies the largest dependencies',

  async analyze(targetPath: string): Promise<AnalyzerResult> {
    const start = performance.now();
    const diagnostics: Diagnostic[] = [];
    const nodeModulesPath = path.join(targetPath, 'node_modules');

    try {
      await fs.access(nodeModulesPath);
    } catch {
      return {
        analyzer: 'bundle-size',
        durationMs: performance.now() - start,
        diagnostics: [],
        metadata: { totalSizeBytes: 0, topDependencies: [] },
      };
    }

    try {
      const files = await fg('**/*', {
        cwd: nodeModulesPath,
        stats: true,
        onlyFiles: true,
        dot: true,
      });

      const packageSizes = new Map<string, number>();

      for (const entry of files) {
        const pkgName = getPackageName(entry.path);
        const size = entry.stats?.size ?? 0;
        packageSizes.set(pkgName, (packageSizes.get(pkgName) ?? 0) + size);
      }

      const totalSizeBytes = [...packageSizes.values()].reduce((a, b) => a + b, 0);
      const sorted = [...packageSizes.entries()]
        .sort((a, b) => b[1] - a[1]);
      const top10 = sorted.slice(0, 10);

      const topDependencies: DependencyInfo[] = top10.map(([name, sizeBytes]) => ({
        name,
        version: '',
        sizeBytes,
        isHeavy: false,
      }));

      // Total bundle size diagnostics
      const totalMB = totalSizeBytes / (1024 * 1024);
      if (totalMB > 50) {
        diagnostics.push({
          analyzer: 'bundle-size',
          severity: 'critical',
          title: 'Bundle size is critically large',
          description: `Total node_modules size is ${totalMB.toFixed(1)}MB. AWS Lambda has a 250MB unzipped limit and large bundles severely impact cold start times.`,
          recommendation: 'Use a bundler (esbuild/webpack) to tree-shake and bundle only what you need. Remove unused dependencies.',
          estimatedImpactMs: Math.min(totalMB * 10, 2000),
        });
      } else if (totalMB > 10) {
        diagnostics.push({
          analyzer: 'bundle-size',
          severity: 'warning',
          title: 'Bundle size is large',
          description: `Total node_modules size is ${totalMB.toFixed(1)}MB. This adds unnecessary cold start latency.`,
          recommendation: 'Consider using a bundler to reduce the deployment package size.',
          estimatedImpactMs: Math.min(totalMB * 5, 500),
        });
      }

      // Individual dependency size diagnostics
      for (const [name, sizeBytes] of sorted) {
        const depMB = sizeBytes / (1024 * 1024);
        if (depMB > 5) {
          diagnostics.push({
            analyzer: 'bundle-size',
            severity: 'critical',
            title: `Dependency "${name}" is very large (${depMB.toFixed(1)}MB)`,
            description: `The package "${name}" takes up ${depMB.toFixed(1)}MB on disk.`,
            recommendation: `Look for a lighter alternative to "${name}" or ensure it's being tree-shaken.`,
            estimatedImpactMs: Math.min(depMB * 8, 500),
          });
        } else if (depMB > 1) {
          diagnostics.push({
            analyzer: 'bundle-size',
            severity: 'warning',
            title: `Dependency "${name}" is large (${depMB.toFixed(1)}MB)`,
            description: `The package "${name}" takes up ${depMB.toFixed(1)}MB on disk.`,
            recommendation: `Consider replacing "${name}" with a lighter alternative.`,
            estimatedImpactMs: Math.min(depMB * 5, 200),
          });
        }
      }

      return {
        analyzer: 'bundle-size',
        durationMs: performance.now() - start,
        diagnostics,
        metadata: { totalSizeBytes, topDependencies },
      };
    } catch (error) {
      console.warn('bundle-size analyzer warning:', error);
      return {
        analyzer: 'bundle-size',
        durationMs: performance.now() - start,
        diagnostics: [],
        metadata: { totalSizeBytes: 0, topDependencies: [] },
      };
    }
  },
};
