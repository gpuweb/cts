export const description = `
Stress tests for allocation of GPUBindGroupLayout objects through GPUDevice.
`;

import { makeTestGroup } from '../../common/framework/test_group.js';
import { GPUTest } from '../../webgpu/gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('concurrent_bind_group_layout_allocation')
  .desc(`Tests allocation of many concurrent GPUBindGroupLayout objects.`)
  .unimplemented();

g.test('continuous_bind_group_layout_allocation')
  .desc(
`Tests allocation and implicit GC of many GPUBindGroupLayout objects over time.
Objects are sequentially created and dropped for GC over a very large number of
iterations.`)
  .unimplemented();

