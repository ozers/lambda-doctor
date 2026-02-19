import { Command } from 'commander';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyze, printReport } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('lambda-doctor')
  .description('Diagnose and fix AWS Lambda cold start performance issues')
  .version(pkg.version);

program
  .command('analyze')
  .description('Analyze a Lambda project directory')
  .argument('<path>', 'Path to the Lambda project directory')
  .option('--format <format>', 'Output format: console or json', 'console')
  .option('--verbose', 'Show verbose output', false)
  .option('--exclude <patterns>', 'Comma-separated glob patterns to exclude (default: tests, dist, build, cypress, coverage)')
  .option('--no-default-excludes', 'Disable default exclude patterns (tests, cypress, etc.)')
  .action(async (targetPath: string, options: { format: string; verbose: boolean; exclude?: string; defaultExcludes: boolean }) => {
    const resolvedPath = path.resolve(targetPath);

    // Validate path exists
    try {
      await fs.access(resolvedPath);
    } catch {
      console.error(`Error: Path does not exist: ${resolvedPath}`);
      process.exit(1);
    }

    // Validate package.json exists
    try {
      await fs.access(path.join(resolvedPath, 'package.json'));
    } catch {
      console.error(`Error: No package.json found in ${resolvedPath}`);
      process.exit(1);
    }

    // Build exclude patterns
    let excludePatterns: string[] | undefined;
    if (!options.defaultExcludes) {
      // Only basic excludes when --no-default-excludes is used
      excludePatterns = ['node_modules/**', 'dist/**', '**/*.d.ts'];
    }
    if (options.exclude) {
      const userPatterns = options.exclude.split(',').map((p) => p.trim());
      excludePatterns = [...(excludePatterns ?? []), ...userPatterns];
    }

    const spinner = ora('Analyzing Lambda project...').start();

    try {
      const report = await analyze({
        targetPath: resolvedPath,
        format: options.format as 'console' | 'json',
        verbose: options.verbose,
        exclude: excludePatterns,
      });

      spinner.stop();

      if (options.format === 'json') {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printReport(report);
      }

      if (report.summary.critical > 0) {
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(error);
      process.exit(1);
    }
  });

program.parse();
