import path from 'path';
import type { AnalyzeConfig, DiagnosisReport, Analyzer, ReportSummary } from '../types.js';
import { DEFAULT_EXCLUDE_PATTERNS } from '../types.js';
import { bundleSizeAnalyzer } from './analyzers/bundle-size.js';
import { heavyDependenciesAnalyzer } from './analyzers/heavy-dependencies.js';
import { importAnalysisAnalyzer } from './analyzers/import-analysis.js';
import { awsSdkAnalyzer } from './analyzers/aws-sdk.js';
import { bundlerDetectionAnalyzer } from './analyzers/bundler-detection.js';

export { printReport } from './reporters/console.js';

const ALL_ANALYZERS: Analyzer[] = [
  bundleSizeAnalyzer,
  heavyDependenciesAnalyzer,
  importAnalysisAnalyzer,
  awsSdkAnalyzer,
  bundlerDetectionAnalyzer,
];

export async function analyze(config: AnalyzeConfig): Promise<DiagnosisReport> {
  const targetPath = path.resolve(config.targetPath);
  const start = performance.now();

  const excludePatterns = config.exclude ?? DEFAULT_EXCLUDE_PATTERNS;

  const analyzersToRun = config.analyzers
    ? ALL_ANALYZERS.filter((a) => config.analyzers!.includes(a.name))
    : ALL_ANALYZERS;

  const results = await Promise.all(
    analyzersToRun.map((a) => a.analyze(targetPath, excludePatterns)),
  );

  const allDiagnostics = results.flatMap((r) => r.diagnostics);
  const summary: ReportSummary = {
    totalIssues: allDiagnostics.length,
    critical: allDiagnostics.filter((d) => d.severity === 'critical').length,
    warnings: allDiagnostics.filter((d) => d.severity === 'warning').length,
    info: allDiagnostics.filter((d) => d.severity === 'info').length,
    estimatedTotalImpactMs: allDiagnostics.reduce((sum, d) => sum + d.estimatedImpactMs, 0),
    heavyDependencies: results.find((r) => r.analyzer === 'heavy-dependencies')?.metadata?.heavyCount as number ?? 0,
    bundleSizeBytes: results.find((r) => r.analyzer === 'bundle-size')?.metadata?.totalSizeBytes as number ?? undefined,
  };

  return {
    targetPath,
    timestamp: new Date().toISOString(),
    totalDurationMs: performance.now() - start,
    results,
    summary,
  };
}

export type { AnalyzeConfig, DiagnosisReport, Analyzer, ReportSummary } from '../types.js';
export { DEFAULT_EXCLUDE_PATTERNS } from '../types.js';
