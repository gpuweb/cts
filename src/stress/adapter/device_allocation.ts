export const description = `
Stress tests for GPUAdapter.requestDevice.
`;

import { makeTestGroup } from '../../common/framework/test_group.js';
import { GPUTest } from '../../webgpu/gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('concurrent_device_allocation')
  .desc(`Tests allocation of many concurrent GPUDevice objects.`)
  .unimplemented();

g.test('continuous_device_allocation_with_destroy')
  .desc(
    `Tests allocation and destruction of many GPUDevice objects over time. Objects
are sequentially requested and destroyed over a very large number of
iterations.`
  )
  .unimplemented();

g.test('continuous_device_allocation_with_gc')
  .desc(
    `Tests allocation and implicit GC of many GPUDevice objects over time. Objects
are sequentially requested and dropped for GC over a very large number of
iterations.`
  )
  .unimplemented();
