import { globalTestConfig } from '../../framework/test_config.js';
import { Logger } from '../../internal/logging/logger.js';
import { LiveTestCaseResult, Status } from '../../internal/logging/result.js';
import { parseQuery } from '../../internal/query/parseQuery.js';
import { TestQueryWithExpectation } from '../../internal/query/query.js';
import { TestTreeLeaf } from '../../internal/tree.js';
import { setDefaultRequestAdapterOptions, setGPUProvider } from '../../util/navigator_gpu.js';

import { AllSpecs, ReactNativeTestFileLoader } from './loader.js';

/**
 * Configuration options for the React Native CTS runner
 */
export interface CTSConfig {
  /** Run in WebGPU compatibility mode */
  compatibility?: boolean;
  /** Force fallback adapter */
  forceFallbackAdapter?: boolean;
  /** Enforce default limits */
  enforceDefaultLimits?: boolean;
  /** Enable debug logging */
  debug?: boolean;
  /** Unroll const eval loops */
  unrollConstEvalLoops?: boolean;
  /** Custom GPU provider function */
  gpuProvider?: () => GPU;
  /** Power preference for adapter */
  powerPreference?: GPUPowerPreference;
}

/**
 * Result of a single test case
 */
export interface TestResult {
  name: string;
  status: Status;
  timems: number;
  logs?: string[];
}

/**
 * Summary of a test run
 */
export interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  warned: number;
  timems: number;
}

/**
 * Callbacks for test run progress
 */
export interface TestRunCallbacks {
  /** Called when a test starts */
  onTestStart?: (name: string, index: number, total: number) => void;
  /** Called when a test completes */
  onTestComplete?: (result: TestResult, index: number, total: number) => void;
  /** Called when the entire run completes */
  onRunComplete?: (summary: TestRunSummary, results: TestResult[]) => void;
  /** Check if the run should be stopped */
  shouldStop?: () => boolean;
}

/**
 * Apply configuration to global test config
 */
export function applyConfig(config: CTSConfig): void {
  if (config.compatibility !== undefined) {
    globalTestConfig.compatibility = config.compatibility;
  }
  if (config.forceFallbackAdapter !== undefined) {
    globalTestConfig.forceFallbackAdapter = config.forceFallbackAdapter;
  }
  if (config.enforceDefaultLimits !== undefined) {
    globalTestConfig.enforceDefaultLimits = config.enforceDefaultLimits;
  }
  if (config.debug !== undefined) {
    globalTestConfig.enableDebugLogs = config.debug;
  }
  if (config.unrollConstEvalLoops !== undefined) {
    globalTestConfig.unrollConstEvalLoops = config.unrollConstEvalLoops;
  }

  // Set adapter options
  if (config.compatibility || config.forceFallbackAdapter || config.powerPreference) {
    setDefaultRequestAdapterOptions({
      ...(config.powerPreference && { powerPreference: config.powerPreference }),
      ...(config.compatibility && { featureLevel: 'compatibility' as const }),
      ...(config.forceFallbackAdapter && { forceFallbackAdapter: true }),
    });
  }

  // Set GPU provider
  if (config.gpuProvider) {
    setGPUProvider(config.gpuProvider);
  }
}

/**
 * List all test cases matching a query
 */
export async function listTests(
  allSpecs: AllSpecs,
  query: string
): Promise<string[]> {
  const loader = new ReactNativeTestFileLoader(allSpecs);
  const parsedQuery = parseQuery(query);
  const testcases = await loader.loadCases(parsedQuery);

  const names: string[] = [];
  for (const testcase of testcases) {
    names.push(testcase.query.toString());
  }
  return names;
}

/**
 * Run tests matching a query
 */
export async function runTests(
  allSpecs: AllSpecs,
  query: string,
  callbacks?: TestRunCallbacks,
  expectations?: TestQueryWithExpectation[]
): Promise<{ summary: TestRunSummary; results: TestResult[] }> {
  const loader = new ReactNativeTestFileLoader(allSpecs);
  const parsedQuery = parseQuery(query);
  const testcases = await loader.loadCases(parsedQuery);
  const log = new Logger();

  // Collect all test cases first to get total count
  const testcaseArray: TestTreeLeaf[] = [];
  for (const testcase of testcases) {
    testcaseArray.push(testcase);
  }

  const total = testcaseArray.length;
  const results: TestResult[] = [];
  const summary: TestRunSummary = {
    total,
    passed: 0,
    failed: 0,
    skipped: 0,
    warned: 0,
    timems: 0,
  };

  const startTime = performance.now();

  for (let i = 0; i < testcaseArray.length; i++) {
    // Check if we should stop
    if (callbacks?.shouldStop?.()) {
      // Mark remaining tests as skipped
      for (let j = i; j < testcaseArray.length; j++) {
        const name = testcaseArray[j].query.toString();
        results.push({ name, status: 'skip', timems: 0 });
        summary.skipped++;
      }
      break;
    }

    const testcase = testcaseArray[i];
    const name = testcase.query.toString();

    callbacks?.onTestStart?.(name, i, total);

    const [rec, res] = log.record(name);
    await testcase.run(rec, expectations ?? []);

    const result: TestResult = {
      name,
      status: res.status,
      timems: res.timems,
      logs: res.logs?.map(l => l.toJSON()),
    };

    results.push(result);

    switch (res.status) {
      case 'pass':
        summary.passed++;
        break;
      case 'fail':
        summary.failed++;
        break;
      case 'skip':
        summary.skipped++;
        break;
      case 'warn':
        summary.warned++;
        break;
    }

    callbacks?.onTestComplete?.(result, i, total);
  }

  summary.timems = performance.now() - startTime;

  callbacks?.onRunComplete?.(summary, results);

  return { summary, results };
}

/**
 * Run a single test by name
 */
export async function runSingleTest(
  allSpecs: AllSpecs,
  testName: string,
  expectations?: TestQueryWithExpectation[]
): Promise<TestResult> {
  const { results } = await runTests(allSpecs, testName, undefined, expectations);
  if (results.length === 0) {
    throw new Error(`Test not found: ${testName}`);
  }
  return results[0];
}

/**
 * Create a test runner instance for more control
 */
export class CTSRunner {
  private readonly loader: ReactNativeTestFileLoader;
  private readonly logger: Logger;
  private stopRequested = false;

  constructor(allSpecs: AllSpecs, config?: CTSConfig) {
    this.loader = new ReactNativeTestFileLoader(allSpecs);
    this.logger = new Logger();
    if (config) {
      applyConfig(config);
    }
  }

  /** Request to stop the current run */
  requestStop(): void {
    this.stopRequested = true;
  }

  /** Check if stop was requested */
  isStopRequested(): boolean {
    return this.stopRequested;
  }

  /** Reset stop flag */
  resetStop(): void {
    this.stopRequested = false;
  }

  /** List tests matching a query */
  async listTests(query: string): Promise<string[]> {
    const parsedQuery = parseQuery(query);
    const testcases = await this.loader.loadCases(parsedQuery);
    const names: string[] = [];
    for (const testcase of testcases) {
      names.push(testcase.query.toString());
    }
    return names;
  }

  /** Run tests with callbacks */
  async runTests(
    query: string,
    callbacks?: TestRunCallbacks,
    expectations?: TestQueryWithExpectation[]
  ): Promise<{ summary: TestRunSummary; results: TestResult[] }> {
    this.resetStop();

    const parsedQuery = parseQuery(query);
    const testcases = await this.loader.loadCases(parsedQuery);

    const testcaseArray: TestTreeLeaf[] = [];
    for (const testcase of testcases) {
      testcaseArray.push(testcase);
    }

    const total = testcaseArray.length;
    const results: TestResult[] = [];
    const summary: TestRunSummary = {
      total,
      passed: 0,
      failed: 0,
      skipped: 0,
      warned: 0,
      timems: 0,
    };

    const startTime = performance.now();

    for (let i = 0; i < testcaseArray.length; i++) {
      if (this.stopRequested || callbacks?.shouldStop?.()) {
        for (let j = i; j < testcaseArray.length; j++) {
          const name = testcaseArray[j].query.toString();
          results.push({ name, status: 'skip', timems: 0 });
          summary.skipped++;
        }
        break;
      }

      const testcase = testcaseArray[i];
      const name = testcase.query.toString();

      callbacks?.onTestStart?.(name, i, total);

      const [rec, res] = this.logger.record(name);
      await testcase.run(rec, expectations ?? []);

      const result: TestResult = {
        name,
        status: res.status,
        timems: res.timems,
        logs: res.logs?.map(l => l.toJSON()),
      };

      results.push(result);

      switch (res.status) {
        case 'pass':
          summary.passed++;
          break;
        case 'fail':
          summary.failed++;
          break;
        case 'skip':
          summary.skipped++;
          break;
        case 'warn':
          summary.warned++;
          break;
      }

      callbacks?.onTestComplete?.(result, i, total);
    }

    summary.timems = performance.now() - startTime;
    callbacks?.onRunComplete?.(summary, results);

    return { summary, results };
  }

  /** Get logger results as JSON */
  getResultsJSON(space?: number): string {
    return this.logger.asJSON(space);
  }
}
