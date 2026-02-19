import { describe, it, expect } from 'vitest';
import path from 'path';
import { analyze } from '../src/index.js';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const UNHEALTHY = path.join(FIXTURES, 'unhealthy-lambda');
const HEALTHY = path.join(FIXTURES, 'healthy-lambda');

describe('unhealthy-lambda', () => {
  it('should find at least 8 issues', async () => {
    const report = await analyze({ targetPath: UNHEALTHY });
    const allDiagnostics = report.results.flatMap((r) => r.diagnostics);
    expect(allDiagnostics.length).toBeGreaterThanOrEqual(8);
  });

  it('should detect aws-sdk v2 as critical', async () => {
    const report = await analyze({ targetPath: UNHEALTHY });
    const awsDiag = report.results
      .find((r) => r.analyzer === 'aws-sdk')!
      .diagnostics;
    const critical = awsDiag.find((d) => d.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical!.title).toContain('AWS SDK v2');
  });

  it('should flag typescript in production dependencies', async () => {
    const report = await analyze({ targetPath: UNHEALTHY });
    const heavyDiag = report.results
      .find((r) => r.analyzer === 'heavy-dependencies')!
      .diagnostics;
    const tsCritical = heavyDiag.find(
      (d) => d.severity === 'critical' && d.title.includes('typescript'),
    );
    expect(tsCritical).toBeDefined();
  });

  it('should detect no bundler as critical', async () => {
    const report = await analyze({ targetPath: UNHEALTHY });
    const bundlerDiag = report.results
      .find((r) => r.analyzer === 'bundler-detection')!
      .diagnostics;
    const noBundler = bundlerDiag.find(
      (d) => d.severity === 'critical' && d.title.includes('No bundler'),
    );
    expect(noBundler).toBeDefined();
  });

  it('should detect heavy dependencies (moment, lodash, etc.)', async () => {
    const report = await analyze({ targetPath: UNHEALTHY });
    const heavyDiag = report.results
      .find((r) => r.analyzer === 'heavy-dependencies')!
      .diagnostics;
    const heavyNames = heavyDiag.map((d) => d.title);
    expect(heavyNames.some((t) => t.includes('moment'))).toBe(true);
    expect(heavyNames.some((t) => t.includes('lodash'))).toBe(true);
  });

  it('should detect wildcard import pattern', async () => {
    const report = await analyze({ targetPath: UNHEALTHY });
    const importDiag = report.results
      .find((r) => r.analyzer === 'import-analysis')!
      .diagnostics;
    const wildcard = importDiag.find((d) => d.title.includes('Wildcard import'));
    expect(wildcard).toBeDefined();
  });

  it('should flag not using ESM', async () => {
    const report = await analyze({ targetPath: UNHEALTHY });
    const bundlerDiag = report.results
      .find((r) => r.analyzer === 'bundler-detection')!
      .diagnostics;
    const noESM = bundlerDiag.find((d) => d.title.includes('not using ESM'));
    expect(noESM).toBeDefined();
  });

  it('should have estimated total impact > 0', async () => {
    const report = await analyze({ targetPath: UNHEALTHY });
    expect(report.summary.estimatedTotalImpactMs).toBeGreaterThan(0);
  });
});

describe('healthy-lambda', () => {
  it('should have 0 critical issues', async () => {
    const report = await analyze({ targetPath: HEALTHY });
    expect(report.summary.critical).toBe(0);
  });

  it('should detect esbuild bundler', async () => {
    const report = await analyze({ targetPath: HEALTHY });
    const bundlerDiag = report.results
      .find((r) => r.analyzer === 'bundler-detection')!
      .diagnostics;
    const detected = bundlerDiag.find((d) => d.title.includes('Bundler detected'));
    expect(detected).toBeDefined();
  });
});
