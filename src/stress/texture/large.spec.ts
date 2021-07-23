export const description = `
Stress tests covering usage of very large textures.
`;

import { makeTestGroup } from '../../common/framework/test_group.js';
import { GPUTest } from '../../webgpu/gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('loading')
  .desc(
    `Tests execution of shaders loading values from very large (at least 8192x8192)
textures. The texture size is selected according to the limit supported by the
GPUDevice.`
  )
  .unimplemented();

g.test('sampling')
  .desc(
    `Tests execution of shaders sampling values from very large (at least 8192x8192)
textures. The texture size is selected according to the limit supported by the
GPUDevice.`
  )
  .unimplemented();
