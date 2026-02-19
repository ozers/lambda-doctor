import chalk from 'chalk';
import type { DiagnosisReport, Diagnostic, DependencyInfo } from '../../types.js';

const SEVERITY_ICON: Record<string, string> = {
  critical: '🔴',
  warning: '⚠️',
  info: '💡',
};

const SEVERITY_COLOR: Record<string, (s: string) => string> = {
  critical: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

export function printReport(report: DiagnosisReport): void {
  console.log();
  console.log(chalk.bold.cyan('🩺 Lambda Doctor — Diagnosis Report'));
  console.log(chalk.gray(`   Target: ${report.targetPath}`));
  console.log(chalk.gray(`   Date:   ${report.timestamp}`));
  console.log();

  // Bundle size breakdown
  const bundleSizeResult = report.results.find((r) => r.analyzer === 'bundle-size');
  if (bundleSizeResult?.metadata) {
    const { totalSizeBytes, topDependencies } = bundleSizeResult.metadata as {
      totalSizeBytes: number;
      topDependencies: DependencyInfo[];
    };
    if (totalSizeBytes > 0) {
      console.log(chalk.bold('📦 Bundle Size Breakdown'));
      console.log(chalk.gray(`   Total: ${formatBytes(totalSizeBytes)}`));
      console.log();
      if (topDependencies && topDependencies.length > 0) {
        console.log(chalk.gray('   Top Dependencies:'));
        for (const dep of topDependencies) {
          const bar = '█'.repeat(Math.max(1, Math.round((dep.sizeBytes / totalSizeBytes) * 30)));
          console.log(`   ${chalk.white(dep.name.padEnd(35))} ${formatBytes(dep.sizeBytes).padStart(10)}  ${chalk.green(bar)}`);
        }
        console.log();
      }
    }
  }

  // Diagnostics sorted by severity
  const allDiagnostics = report.results.flatMap((r) => r.diagnostics);
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const sorted = [...allDiagnostics].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  if (sorted.length === 0) {
    console.log(chalk.green.bold('✅ No issues found! Your Lambda looks healthy.'));
    console.log();
    return;
  }

  console.log(chalk.bold('🔍 Diagnostics'));
  console.log();

  for (const diag of sorted) {
    const icon = SEVERITY_ICON[diag.severity];
    const colorFn = SEVERITY_COLOR[diag.severity];
    const location = diag.filePath ? chalk.gray(` (${diag.filePath}${diag.line ? `:${diag.line}` : ''})`) : '';

    console.log(`${icon} ${colorFn(diag.severity.toUpperCase())} ${chalk.bold(diag.title)}${location}`);
    console.log(chalk.gray(`   ${diag.description}`));
    console.log(chalk.green(`   → ${diag.recommendation}`));
    if (diag.estimatedImpactMs > 0) {
      console.log(chalk.cyan(`   ⏱  Est. improvement: ~${diag.estimatedImpactMs}ms`));
    }
    console.log();
  }

  // Footer summary
  const { summary } = report;
  console.log(chalk.bold('─'.repeat(60)));
  console.log(
    chalk.bold('Summary: ') +
      chalk.red(`${summary.critical} critical`) +
      chalk.gray(' | ') +
      chalk.yellow(`${summary.warnings} warnings`) +
      chalk.gray(' | ') +
      chalk.blue(`${summary.info} info`),
  );
  if (summary.estimatedTotalImpactMs > 0) {
    console.log(
      chalk.bold.green(`\n🚀 Total estimated cold start improvement: ~${summary.estimatedTotalImpactMs}ms`),
    );
  }
  console.log();
}
