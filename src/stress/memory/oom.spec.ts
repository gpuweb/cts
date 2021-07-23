export const description = `
Stress tests covering robustness when available VRAM is exhausted.
`;

import { makeTestGroup } from '../../common/framework/test_group.js';
import { GPUTest } from '../../webgpu/gpu_test.js';

export const g = makeTestGroup(GPUTest);

// Helper to exhaust VRAM until there is less than 64 MB of capacity. Returns
// an opaque closure which can be called to free the allocated resources later.
const exhaustVramUntilUnder64MB = async device => {
  const allocateUntilOom = async (device, size) => {
    const buffers = [];
    while (true) {
      device.pushErrorScope('out-of-memory');
      const buffer = device.createBuffer({size, usage: GPUBufferUsage.STORAGE});
      if (await device.popErrorScope()) {
        return buffers;
      }
      buffers.push(buffer);
    }
  };

  const kLargeChunkSize = 512 * 1024 * 1024;
  const kSmallChunkSize = 64 * 1024 * 1024;
  const buffers = await allocateUntilOom(device, kLargeChunkSize);
  buffers.push(...allocateUntilOom(device, kSmallChunkSize));
  return () => {
    buffers.forEach(buffer => buffer.destroy());
  };
};

g.test('get_mapped_range')
  .desc(
`Tests getMappedRange on a mappedAtCreation GPUBuffer that failed allocation due
to OOM. This should throw a RangeError, but below a certain threshold may just
crash the page.`)
  .unimplemented();

g.test('map_after_vram_oom')
  .desc(
`Allocates tons of buffers and textures with varying mapping states (unmappable,
mappable, mapAtCreation, matAtCreation-then-unmapped) until OOM; then attempts
to mapAsync all the mappable objects.`);
  .unimplemented();

g.test('validation_vs_oom')
  .desc(
`Tests that calls affected by both OOM and validation errors expose the
validation error with precedence.`)
  .unimplemented();

g.test('recovery')
  .desc(
`Tests that after going VRAM-OOM, destroying allocated resources eventually
allows new resources to be allocated.`)
  .unimplemented();
