export const description = `
TODO:
- Test some weird but valid values for entry point name (both module and pipeline creation
  should succeed).
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);
