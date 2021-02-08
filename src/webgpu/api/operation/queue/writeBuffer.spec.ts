export const description = 'Operation tests for GPUQueue.writeBuffer()';

import { params, pbool, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { range } from '../../../../common/framework/util/util.js';
import { GPUTest } from '../../../gpu_test.js';

const kTypedArrays = [
  'Uint8Array',
  'Uint16Array',
  'Uint32Array',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
] as const;

export const g = makeTestGroup(GPUTest);

const kTestData = range<number>(16, i => i);

g.test('array_types')
  .desc('Tests that writeBuffer correctly handles different TypedArrays and ArrayBuffer.')
  .cases(params().combine(poptions('arrayType', kTypedArrays)).combine(pbool('useArrayBuffer')))
  .fn(t => {
    const { arrayType, useArrayBuffer } = t.params;
    const typeBuilder = self[arrayType];
    const typedData = new typeBuilder(kTestData);
    const buffer = t.device.createBuffer({
      size: typedData.byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    t.queue.writeBuffer(buffer, 0, useArrayBuffer ? typedData.buffer : typedData);
    t.expectContents(buffer, typedData);
  });

g.test('unaligned_source')
  .desc('Tests that writeBuffer correctly handles unaligned sources.')
  .fn(t => {
    const kStartOffset = 1;
    const arrayData = new ArrayBuffer(kStartOffset + kTestData.length);
    const typedData = new Uint8Array(arrayData, kStartOffset);
    kTestData.every((val, idx) => {
      typedData[idx] = val;
    });
    const buffer = t.device.createBuffer({
      size: typedData.byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    t.queue.writeBuffer(buffer, 0, arrayData, kStartOffset);
    t.expectContents(buffer, typedData);
  });
