/**
 * React Native runtime for the WebGPU CTS
 *
 * Usage:
 *   import { CTSRunner, runTests, listTests } from './rn/index.js';
 *   import { allSpecs } from './rn/generated/all_specs.js';
 *
 *   // Option 1: Use the runner class
 *   const runner = new CTSRunner(allSpecs, { compatibility: false });
 *   const { summary, results } = await runner.runTests('webgpu:api,operation,*');
 *
 *   // Option 2: Use standalone functions
 *   const tests = await listTests(allSpecs, 'webgpu:*');
 *   const { summary, results } = await runTests(allSpecs, 'webgpu:api,operation,adapter,*', {
 *     onTestStart: (name, i, total) => console.log(`Running ${i + 1}/${total}: ${name}`),
 *     onTestComplete: (result, i, total) => console.log(`  ${result.status}`),
 *   });
 */

export {
  ReactNativeTestFileLoader,
  AllSpecs,
  SpecEntry,
} from './loader.js';

export {
  CTSRunner,
  CTSConfig,
  TestResult,
  TestRunSummary,
  TestRunCallbacks,
  applyConfig,
  listTests,
  runTests,
  runSingleTest,
} from './runtime.js';
