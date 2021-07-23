export const description = `
Stress tests for occlusion queries.
`;

import { makeTestGroup } from '../../common/framework/test_group.js';
import { GPUTest } from '../../webgpu/gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('many_queries')
  .desc(`Tests a huge number of occlusion queries in a render pass.`)
  .unimplemented();
