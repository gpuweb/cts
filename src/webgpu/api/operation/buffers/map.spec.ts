export const description = '';

import { pbool, poptions, params } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';

import { MappingTest } from './mapping_test.js';

export const g = makeTestGroup(MappingTest);

g.test('mapAsync,write')
  .params(poptions('size', [12, 512 * 1024]))
  .fn(async t => {
    const { size } = t.params;
    const buffer = t.device.createBuffer({
      size,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
    });

    await buffer.mapAsync(GPUMapMode.WRITE);
    const arrayBuffer = buffer.getMappedRange();
    t.checkMapWrite(buffer, arrayBuffer, size);
  });

g.test('mapAsync,read')
  .params(poptions('size', [12, 512 * 1024]))
  .fn(async t => {
    const { size } = t.params;

    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const init = buffer.getMappedRange();

    const expected = new Uint32Array(new ArrayBuffer(size));
    const data = new Uint32Array(init);
    for (let i = 0; i < data.length; ++i) {
      data[i] = expected[i] = i + 1;
    }
    buffer.unmap();

    await buffer.mapAsync(GPUMapMode.READ);
    const actual = new Uint8Array(buffer.getMappedRange());
    t.expectBuffer(actual, new Uint8Array(expected.buffer));
  });

g.test('mappedAtCreation')
  .params(
    params()
      .combine(poptions('size', [12, 512 * 1024]))
      .combine(pbool('mappable'))
  )
  .fn(async t => {
    const { size, mappable } = t.params;
    const buffer = t.device.createBuffer({
      mappedAtCreation: true,
      size,
      usage: GPUBufferUsage.COPY_SRC | (mappable ? GPUBufferUsage.MAP_WRITE : 0),
    });
    const arrayBuffer = buffer.getMappedRange();
    t.checkMapWrite(buffer, arrayBuffer, size);
  });
