export const description = `
Stress tests covering behavior around shader entry points.
`;

import { makeTestGroup } from '../../common/framework/test_group.js';
import { GPUTest } from '../../webgpu/gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('many_entry_points')
  .desc(
`Tests compilation and usage of shaders with a huge number of entry points.`)
  .unimplemented();
