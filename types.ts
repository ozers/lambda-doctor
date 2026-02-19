// ============================================================
// lambda-doctor core types
// ============================================================

/** Severity of a diagnostic finding */
export type Severity = 'critical' | 'warning' | 'info';

/** Category of analysis */
export type AnalyzerName =
  | 'bundle-size'
  | 'heavy-dependencies'
  | 'import-analysis'
  | 'aws-sdk'
  | 'bundler-detection';

/** A single diagnostic finding */
export interface Diagnostic {
  /** Which analyzer produced this */
  analyzer: AnalyzerName;
  /** Severity level */
  severity: Severity;
  /** Short human-readable title */
  title: string;
  /** Detailed description of the issue */
  description: string;
  /** Actionable fix recommendation */
  recommendation: string;
  /** Estimated cold start improvement in ms (0 if unknown) */
  estimatedImpactMs: number;
  /** File path related to this finding (optional) */
  filePath?: string;
  /** Line number (optional) */
  line?: number;
}

/** Summary of a dependency */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Version string */
  version: string;
  /** Size on disk in bytes */
  sizeBytes: number;
  /** Whether it's a known heavy package */
  isHeavy: boolean;
  /** Suggested lighter alternative (if any) */
  alternative?: string;
}

/** Result from a single analyzer */
export interface AnalyzerResult {
  /** Analyzer name */
  analyzer: AnalyzerName;
  /** Time taken to run in ms */
  durationMs: number;
  /** Findings */
  diagnostics: Diagnostic[];
  /** Analyzer-specific metadata */
  metadata?: Record<string, unknown>;
}

/** Full diagnosis report */
export interface DiagnosisReport {
  /** Path that was analyzed */
  targetPath: string;
  /** Timestamp */
  timestamp: string;
  /** Total analysis duration in ms */
  totalDurationMs: number;
  /** Results from each analyzer */
  results: AnalyzerResult[];
  /** Aggregated summary */
  summary: ReportSummary;
}

/** Aggregated summary across all analyzers */
export interface ReportSummary {
  /** Total number of diagnostics */
  totalIssues: number;
  /** Count by severity */
  critical: number;
  warnings: number;
  info: number;
  /** Total estimated cold start improvement in ms */
  estimatedTotalImpactMs: number;
  /** Total bundle size in bytes (if detected) */
  bundleSizeBytes?: number;
  /** Number of heavy dependencies found */
  heavyDependencies: number;
}

/** Configuration for the analyze command */
export interface AnalyzeConfig {
  /** Path to the Lambda project directory */
  targetPath: string;
  /** Which analyzers to run (default: all) */
  analyzers?: AnalyzerName[];
  /** Output format */
  format?: 'console' | 'json';
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Glob patterns to exclude from file scanning */
  exclude?: string[];
}

/** Default glob patterns excluded from scanning */
export const DEFAULT_EXCLUDE_PATTERNS: string[] = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '**/*.d.ts',
  '**/__tests__/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/test/**',
  '**/tests/**',
  '**/cypress/**',
  '**/.serverless/**',
  '**/cdk.out/**',
];

/** Interface that all analyzers must implement */
export interface Analyzer {
  /** Unique name */
  name: AnalyzerName;
  /** Human-readable description */
  description: string;
  /** Run the analysis */
  analyze(targetPath: string, exclude?: string[]): Promise<AnalyzerResult>;
}
