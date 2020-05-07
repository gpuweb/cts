import { ParamSpec } from './params_utils.js';
import { objectEquals } from './util/util.js';

// Identifies a test spec file.
export interface TestGroupID {
  // The spec's suite name, e.g. 'webgpu'.
  readonly suite: string;
  // The spec's path within the suite, e.g. ['command_buffer', 'compute', 'basic'].
  readonly group: string[];
}

export function testSpecEquals(x: TestGroupID, y: TestGroupID): boolean {
  return objectEquals(x, y);
}

// Identifies a test case (a specific parameterization of a test), within its spec file.
export interface TestCaseID {
  readonly test: readonly string[];
  readonly params: ParamSpec;
}
