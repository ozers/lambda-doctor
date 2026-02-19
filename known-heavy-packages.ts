// ============================================================
// Database of known heavy npm packages and their alternatives
// Used by heavy-dependencies and bundle-size analyzers
// ============================================================

export interface HeavyPackage {
  /** Package name */
  name: string;
  /** Typical size on disk (bytes, approximate) */
  typicalSizeBytes: number;
  /** Why it's problematic for Lambda */
  reason: string;
  /** Suggested replacement */
  alternative: string;
  /** Estimated cold start savings if replaced (ms) */
  estimatedSavingsMs: number;
}

/**
 * Known heavy packages that hurt Lambda cold starts.
 * Sources:
 * - https://speedrun.nobackspacecrew.com/blog/2023/09/23/optimizing-lambda-coldstarts.html
 * - https://aws.amazon.com/blogs/compute/optimizing-node-js-dependencies-in-aws-lambda/
 * - Community benchmarks
 */
export const HEAVY_PACKAGES: HeavyPackage[] = [
  {
    name: 'aws-sdk',
    typicalSizeBytes: 65_000_000,
    reason: 'AWS SDK v2 is 65MB+ and loads all service clients. Lambda runtime includes it, but it\'s slow.',
    alternative: 'Use @aws-sdk/client-* (v3) with selective imports. Only import clients you need.',
    estimatedSavingsMs: 400,
  },
  {
    name: 'moment',
    typicalSizeBytes: 4_800_000,
    reason: 'Moment.js is 4.8MB with locales. Not tree-shakeable.',
    alternative: 'Use dayjs (2KB) or date-fns with tree-shaking.',
    estimatedSavingsMs: 50,
  },
  {
    name: 'moment-timezone',
    typicalSizeBytes: 8_200_000,
    reason: 'Moment-timezone adds 8MB+ of timezone data on top of Moment.',
    alternative: 'Use dayjs/plugin/timezone or Intl.DateTimeFormat (built-in).',
    estimatedSavingsMs: 80,
  },
  {
    name: 'lodash',
    typicalSizeBytes: 1_400_000,
    reason: 'Full lodash is 1.4MB. Not tree-shakeable with CommonJS.',
    alternative: 'Use lodash-es (tree-shakeable) or individual packages like lodash.get.',
    estimatedSavingsMs: 30,
  },
  {
    name: 'axios',
    typicalSizeBytes: 450_000,
    reason: 'Axios is 450KB. Overkill for Lambda where you can use native fetch (Node 18+).',
    alternative: 'Use native fetch (Node 18+) or undici.',
    estimatedSavingsMs: 15,
  },
  {
    name: 'express',
    typicalSizeBytes: 550_000,
    reason: 'Express has 30+ dependencies. Heavy for a single Lambda function.',
    alternative: 'Use lambda-api (zero deps) or direct API Gateway event parsing.',
    estimatedSavingsMs: 20,
  },
  {
    name: 'bluebird',
    typicalSizeBytes: 350_000,
    reason: 'Bluebird is unnecessary in Node 18+ which has native Promise with good performance.',
    alternative: 'Use native Promise (built-in).',
    estimatedSavingsMs: 10,
  },
  {
    name: 'uuid',
    typicalSizeBytes: 150_000,
    reason: 'UUID package is 150KB. Node 18+ has crypto.randomUUID() built-in.',
    alternative: 'Use crypto.randomUUID() (built-in Node 18+).',
    estimatedSavingsMs: 5,
  },
  {
    name: 'winston',
    typicalSizeBytes: 2_500_000,
    reason: 'Winston is 2.5MB with many transports. Too heavy for Lambda.',
    alternative: 'Use @aws-lambda-powertools/logger or pino.',
    estimatedSavingsMs: 40,
  },
  {
    name: 'joi',
    typicalSizeBytes: 950_000,
    reason: 'Joi is ~1MB. Heavy for Lambda validation.',
    alternative: 'Use zod (lighter, TypeScript-native) or ajv.',
    estimatedSavingsMs: 20,
  },
  {
    name: 'mongoose',
    typicalSizeBytes: 3_800_000,
    reason: 'Mongoose is 3.8MB. Extremely heavy for Lambda.',
    alternative: 'Use native MongoDB driver or Dynamoose for DynamoDB.',
    estimatedSavingsMs: 100,
  },
  {
    name: 'typescript',
    typicalSizeBytes: 65_000_000,
    reason: 'TypeScript compiler in production bundle is 65MB. Should only be a devDependency.',
    alternative: 'Move to devDependencies. Deploy compiled JavaScript only.',
    estimatedSavingsMs: 500,
  },
  {
    name: 'ts-node',
    typicalSizeBytes: 3_500_000,
    reason: 'ts-node adds 200-500ms cold start. Should not be in production.',
    alternative: 'Transpile to JavaScript before deployment.',
    estimatedSavingsMs: 350,
  },
  {
    name: '@nestjs/core',
    typicalSizeBytes: 5_200_000,
    reason: 'NestJS is a heavy framework (5MB+). Decorator metadata and DI container add cold start overhead.',
    alternative: 'Use lighter patterns for Lambda: plain handlers or lambda-api.',
    estimatedSavingsMs: 150,
  },
  {
    name: 'puppeteer',
    typicalSizeBytes: 300_000_000,
    reason: 'Puppeteer bundles Chromium (300MB+). Exceeds Lambda package limits.',
    alternative: 'Use @sparticuz/chromium with puppeteer-core for Lambda.',
    estimatedSavingsMs: 2000,
  },
];

/**
 * Lookup a package by name.
 */
export function findHeavyPackage(name: string): HeavyPackage | undefined {
  return HEAVY_PACKAGES.find((pkg) => pkg.name === name);
}

/**
 * Check if a package is known to be heavy.
 */
export function isHeavyPackage(name: string): boolean {
  return HEAVY_PACKAGES.some((pkg) => pkg.name === name);
}
