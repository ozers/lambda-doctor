import { Command } from 'commander';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { analyze, printReport } from '../index.js';

const program = new Command();

program
  .name('lambda-doctor')
  .description('Diagnose and fix AWS Lambda cold start performance issues')
  .version('0.1.0');

program
  .command('analyze')
  .description('Analyze a Lambda project directory')
  .argument('<path>', 'Path to the Lambda project directory')
  .option('--format <format>', 'Output format: console or json', 'console')
  .option('--verbose', 'Show verbose output', false)
  .action(async (targetPath: string, options: { format: string; verbose: boolean }) => {
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

    const spinner = ora('Analyzing Lambda project...').start();

    try {
      const report = await analyze({
        targetPath: resolvedPath,
        format: options.format as 'console' | 'json',
        verbose: options.verbose,
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
