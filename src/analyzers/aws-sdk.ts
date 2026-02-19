import fs from 'fs/promises';
import fg from 'fast-glob';
import path from 'path';
import type { Analyzer, AnalyzerResult, Diagnostic } from '../../types.js';

export const awsSdkAnalyzer: Analyzer = {
  name: 'aws-sdk',
  description: 'Checks AWS SDK version usage and migration status',

  async analyze(targetPath: string): Promise<AnalyzerResult> {
    const start = performance.now();
    const diagnostics: Diagnostic[] = [];

    try {
      const pkgJsonPath = path.join(targetPath, 'package.json');
      const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
      const allDeps = { ...(pkgJson.dependencies ?? {}), ...(pkgJson.devDependencies ?? {}) };

      const hasV2 = 'aws-sdk' in allDeps;
      const v3Clients = Object.keys(allDeps).filter((d) => d.startsWith('@aws-sdk/client-'));
      const hasV3 = v3Clients.length > 0;

      if (hasV2 && !hasV3) {
        diagnostics.push({
          analyzer: 'aws-sdk',
          severity: 'critical',
          title: 'Using AWS SDK v2 (aws-sdk)',
          description: 'AWS SDK v2 is 65MB+ and loads all service clients. It adds 400ms+ to cold starts.',
          recommendation: 'Migrate to AWS SDK v3 (@aws-sdk/client-*). Only import the clients you need.',
          estimatedImpactMs: 400,
          filePath: 'package.json',
        });
      }

      if (hasV2 && hasV3) {
        diagnostics.push({
          analyzer: 'aws-sdk',
          severity: 'warning',
          title: 'Incomplete AWS SDK v2 to v3 migration',
          description: 'Both aws-sdk (v2) and @aws-sdk/client-* (v3) are present. This means v2 is still bundled alongside v3.',
          recommendation: 'Complete the migration to SDK v3 and remove the "aws-sdk" dependency.',
          estimatedImpactMs: 400,
          filePath: 'package.json',
        });
      }

      if (v3Clients.length > 5) {
        diagnostics.push({
          analyzer: 'aws-sdk',
          severity: 'info',
          title: `${v3Clients.length} AWS SDK v3 clients detected`,
          description: `This Lambda uses ${v3Clients.length} AWS SDK clients: ${v3Clients.join(', ')}. Each client adds to bundle size.`,
          recommendation: 'Verify all clients are necessary. Consider splitting into multiple Lambdas if responsibilities are too broad.',
          estimatedImpactMs: v3Clients.length * 5,
        });
      }

      // Check source files for unnecessary SSO client
      const sourceFiles = await fg(['**/*.ts', '**/*.js', '**/*.mjs'], {
        cwd: targetPath,
        ignore: ['node_modules/**', 'dist/**', '**/*.d.ts'],
        absolute: false,
      });

      for (const file of sourceFiles) {
        const content = await fs.readFile(path.join(targetPath, file), 'utf-8');
        if (content.includes('@aws-sdk/client-sso')) {
          diagnostics.push({
            analyzer: 'aws-sdk',
            severity: 'warning',
            title: 'Unnecessary SSO client in Lambda',
            description: '@aws-sdk/client-sso is imported but Lambda functions use IAM roles, not SSO authentication.',
            recommendation: 'Remove the @aws-sdk/client-sso import. Lambda uses IAM execution roles for authentication.',
            estimatedImpactMs: 15,
            filePath: file,
          });
          break;
        }
      }

      return {
        analyzer: 'aws-sdk',
        durationMs: performance.now() - start,
        diagnostics,
        metadata: { hasV2, hasV3, v3ClientCount: v3Clients.length },
      };
    } catch (error) {
      console.warn('aws-sdk analyzer warning:', error);
      return {
        analyzer: 'aws-sdk',
        durationMs: performance.now() - start,
        diagnostics: [],
      };
    }
  },
};
