export const description = '';

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { poptions, params, pbool } from '../../../../common/framework/params_builder.js';
import { kBufferUsages } from '../../../capability_info.js';

export const g = makeTestGroup(GPUTest);

g.test('mapAsync')
  .params(
    params()
      .combine(pbool('oom')) //
      .combine(pbool('write'))
  )
  .fn(async t => {
    const { oom, write } = t.params;

    const buffer = t.expectGPUError(
      'out-of-memory',
      () => {
        return t.device.createBuffer({
          size: oom ? Number.MAX_SAFE_INTEGER : 16,
          usage: write ? GPUBufferUsage.MAP_WRITE : GPUBufferUsage.MAP_READ,
        });
      },
      oom
    );
    const promise = buffer.mapAsync(write ? GPUMapMode.WRITE : GPUMapMode.READ);

    if (oom) {
      t.shouldReject('OperationError', promise);
    } else {
      t.shouldResolve(promise);
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
    const size = oom ? Number.MAX_SAFE_INTEGER - 3 : 16;

    const buffer = t.expectGPUError(
      'out-of-memory',
      () => t.device.createBuffer({ mappedAtCreation: true, size, usage }),
      oom
    );

    const f = () => {
      buffer.getMappedRange(0, size);
    };
    if (oom) {
      t.shouldThrow('RangeError', f);
    } else {
      f();
    }
  });
