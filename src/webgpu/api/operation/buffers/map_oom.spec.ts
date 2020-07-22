export const description = '';

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { poptions, params, pbool } from '../../../../common/framework/params_builder.js';
import { kBufferUsages } from '../../../capability_info.js';

// A multiple of 8 guaranteed to be way too large to allocate (just under 8 pebibytes).
// (Note this is likely to exceed limitations other than just the system's
// physical memory - so may test codepaths other than "true" OOM.)
const MAX_ALIGNED_SAFE_INTEGER = Number.MAX_SAFE_INTEGER - 7;

export const g = makeTestGroup(GPUTest);

g.test('mapAsync')
  .params(
    params()
      .combine(pbool('oom')) //
      .combine(pbool('write'))
  )
  .fn(async t => {
    const { oom, write } = t.params;
    const size = oom ? MAX_ALIGNED_SAFE_INTEGER : 16;

    const buffer = t.expectGPUError(
      'out-of-memory',
      () =>
        t.device.createBuffer({
          size,
          usage: write ? GPUBufferUsage.MAP_WRITE : GPUBufferUsage.MAP_READ,
        }),
      oom
    );
    const promise = t.expectGPUError(
      'out-of-memory',
      () => buffer.mapAsync(write ? GPUMapMode.WRITE : GPUMapMode.READ),
      oom
    );

    if (oom) {
      t.shouldReject('OperationError', promise);
    } else {
      await promise;
      const arraybuffer = buffer.getMappedRange();
      t.expect(arraybuffer.byteLength == size);
      buffer.unmap();
      t.expect(arraybuffer.byteLength == 0);
    }
  });

g.test('mappedAtCreation')
  .params(
    params()
      .combine(pbool('oom')) //
      .combine(poptions('usage', kBufferUsages))
  )
  .fn(async t => {
    const { oom, usage } = t.params;
    const size = oom ? MAX_ALIGNED_SAFE_INTEGER : 16;

    const buffer = t.expectGPUError(
      'out-of-memory',
      () => t.device.createBuffer({ mappedAtCreation: true, size, usage }),
      oom
    );

    const f = () => buffer.getMappedRange(0, size);

    if (oom) {
      t.shouldThrow('RangeError', f);
    } else {
      const mapping = f();
      t.expect(mapping.byteLength == size);
      buffer.unmap();
      t.expect(mapping.byteLength == 0);
    }
  });
