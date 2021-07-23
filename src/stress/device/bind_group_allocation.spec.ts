export const description = `
Stress tests for allocation of GPUBindGroup objects through GPUDevice.
`;

import { makeTestGroup } from '../../common/framework/test_group.js';
import { GPUTest } from '../../webgpu/gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('concurrent_bind_group_allocation')
  .desc(`Tests allocation of many concurrent GPUBindGroup objects.`)
  .unimplemented();

g.test('continuous_bind_group_allocation')
  .desc(
    `Tests allocation and implicit GC of many GPUBindGroup objects over time.
Objects are sequentially created and dropped for GC over a very large number of
iterations.`
  )
  .unimplemented();
