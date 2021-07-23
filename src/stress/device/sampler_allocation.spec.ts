export const description = `
Stress tests for allocation of GPUSampler objects through GPUDevice.
`;

import { makeTestGroup } from '../../common/framework/test_group.js';
import { GPUTest } from '../../webgpu/gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('concurrent_sampler_allocation')
  .desc(`Tests allocation of many concurrent GPUSampler objects.`)
  .unimplemented();

g.test('continuous_sampler_allocation')
  .desc(
`Tests allocation and implicit GC of many GPUSampler objects over time. Objects
are sequentially created and dropped for GC over a very large number of
iterations.`)
  .unimplemented();

