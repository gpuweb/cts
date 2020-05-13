import { CaseParams } from './params_utils.js';

// Identifies a test spec file.
export interface TestGroupID {
  // The spec's suite name, e.g. 'webgpu'.
  readonly suite: string;
  // The spec's path within the suite, e.g. ['command_buffer', 'compute', 'basic'].
  readonly file: readonly string[];
}

// Identifies a test case (a specific parameterization of a test), within its spec file.
export interface TestCaseID {
  readonly test: readonly string[];
  readonly params: CaseParams;
}
