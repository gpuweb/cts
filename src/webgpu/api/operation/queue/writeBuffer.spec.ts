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

type WriteBufferSignature = {
  bufferOffset: number;
  data: readonly number[];
  arrayType: typeof kTypedArrays[number];
  useArrayBuffer: boolean;
  dataOffset?: number;
  dataSize?: number;
};

class F extends GPUTest {
  calculateRequiredBufferSize(writes: WriteBufferSignature[]): number {
    let bufferSize = 0;
    // Calculate size of final buffer
    for (const { bufferOffset, data, arrayType, useArrayBuffer, dataOffset, dataSize } of writes) {
      const typeBuilder = self[arrayType];
      let requiredSize = data.length * typeBuilder.BYTES_PER_ELEMENT;

      // When passing data as an ArrayBuffer, dataOffset, dataSize use byte instead of number of
      // elements
      const bytesPerElement = useArrayBuffer ? 1 : typeBuilder.BYTES_PER_ELEMENT;
      if (dataOffset) {
        requiredSize -= dataOffset * bytesPerElement;
      }
      if (dataSize) {
        requiredSize = Math.min(requiredSize, dataSize * bytesPerElement);
      }

      requiredSize += bufferOffset;

      if (requiredSize > bufferSize) {
        bufferSize = requiredSize;
      }
    }
    // writeBuffer requires buffers to be a multiple of 4
    return Math.ceil(bufferSize / 4) * 4;
  }

  testWriteBuffer(...writes: WriteBufferSignature[]) {
    const bufferSize = this.calculateRequiredBufferSize(writes);
    const buffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    // Initialize buffer to non-zero data (0xff)
    const expectedData = new Uint8Array(range<number>(bufferSize, i => 0xff));
    this.queue.writeBuffer(buffer, 0, expectedData);

    for (const { bufferOffset, data, arrayType, useArrayBuffer, dataOffset, dataSize } of writes) {
      const typeBuilder = self[arrayType];
      const writeData = new typeBuilder(data);
      this.queue.writeBuffer(
        buffer,
        bufferOffset,
        useArrayBuffer ? writeData.buffer : writeData,
        dataOffset,
        dataSize
      );
      const bytesPerElement = useArrayBuffer ? 1 : typeBuilder.BYTES_PER_ELEMENT;
      const begin = dataOffset ? dataOffset * bytesPerElement : 0;
      expectedData.set(
        new Uint8Array(
          writeData.buffer.slice(begin, dataSize ? begin + dataSize * bytesPerElement : undefined)
        ),
        bufferOffset
      );
    }

    this.debug(`expectedData: [${expectedData.join(', ')}]`);
    this.expectContents(buffer, expectedData);
  }
}

export const g = makeTestGroup(F);

const kTestData = range<number>(16, i => i);

g.test('array_types')
  .desc('Tests that writeBuffer correctly handles different TypedArrays and ArrayBuffer.')
  .cases(params().combine(poptions('arrayType', kTypedArrays)).combine(pbool('useArrayBuffer')))
  .fn(t => {
    const { arrayType, useArrayBuffer } = t.params;

    t.testWriteBuffer({ bufferOffset: 0, data: kTestData, arrayType, useArrayBuffer });
  });

g.test('multiple_writes_at_different_offsets_and_sizes')
  .desc(
    `
Tests that writeBuffer currently handles different offsets and writes. This includes:
- Non-overlapping TypedArrays and ArrayLists
- Overlapping TypedArrays and ArrayLists
- Writing zero data
- Writing on zero sized buffers
- Unaligned source
- Multiple overlapping writes with decreasing sizes
    `
  )
  .cases([
    {
      // Concatenate 2 Uint32Arrays
      writes: [
        {
          bufferOffset: 0,
          data: kTestData,
          arrayType: 'Uint32Array',
          useArrayBuffer: false,
          dataOffset: 2,
          dataSize: 2,
        }, // [2, 3]
        {
          bufferOffset: 2 * Uint32Array.BYTES_PER_ELEMENT,
          data: kTestData,
          arrayType: 'Uint32Array',
          useArrayBuffer: false,
          dataOffset: 0,
          dataSize: 2,
        }, // [0, 1]
      ], // Expected [2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
    },
    {
      // Concatenate 2 Uint8Arrays
      writes: [
        { bufferOffset: 0, data: [0, 1, 2, 3], arrayType: 'Uint8Array', useArrayBuffer: false },
        { bufferOffset: 4, data: [4, 5, 6, 7], arrayType: 'Uint8Array', useArrayBuffer: false },
      ], // Expected [0, 1, 2, 3, 4, 5, 6, 7]
    },
    {
      // Overlap in the middle
      writes: [
        { bufferOffset: 0, data: kTestData, arrayType: 'Uint8Array', useArrayBuffer: false },
        { bufferOffset: 4, data: [0], arrayType: 'Uint32Array', useArrayBuffer: false },
      ], // Expected [0, 1, 2, 3, 0, 0 ,0 ,0, 8, 9, 10, 11, 12, 13, 14, 15]
    },
    {
      // Overlapping arrayLists
      writes: [
        {
          bufferOffset: 0,
          data: kTestData,
          arrayType: 'Uint32Array',
          useArrayBuffer: true,
          dataOffset: 2,
          dataSize: 4 * Uint32Array.BYTES_PER_ELEMENT,
        },
        { bufferOffset: 4, data: [0x04030201], arrayType: 'Uint32Array', useArrayBuffer: true },
      ], // Expected [0, 0, 1, 0, 1, 2, 3, 4, 0, 0, 3, 0, 0, 0, 4, 0]
    },
    {
      // Write over with empty buffer
      writes: [
        { bufferOffset: 0, data: kTestData, arrayType: 'Uint8Array', useArrayBuffer: false },
        { bufferOffset: 0, data: [], arrayType: 'Uint8Array', useArrayBuffer: false },
      ], // Expected [0, 1, 2, 3, 4, 5 ,6 ,7, 8, 9, 10, 11, 12, 13, 14, 15]
    },
    {
      // Zero buffer
      writes: [],
    }, // Expected []
    {
      // Unaligned source
      writes: [
        {
          bufferOffset: 0,
          data: [0, ...kTestData],
          arrayType: 'Uint8Array',
          useArrayBuffer: false,
          dataOffset: 1,
        },
      ], // Expected [0, 1, 2, 3, 4, 5 ,6 ,7, 8, 9, 10, 11, 12, 13, 14, 15]
    },
    {
      // Multiple overlapping writes
      writes: [
        {
          bufferOffset: 0,
          data: [0x05050505, 0x05050505, 0x05050505, 0x05050505, 0x05050505],
          arrayType: 'Uint32Array',
          useArrayBuffer: false,
        },
        {
          bufferOffset: 0,
          data: [0x04040404, 0x04040404, 0x04040404, 0x04040404],
          arrayType: 'Uint32Array',
          useArrayBuffer: false,
        },
        {
          bufferOffset: 0,
          data: [0x03030303, 0x03030303, 0x03030303],
          arrayType: 'Uint32Array',
          useArrayBuffer: false,
        },
        {
          bufferOffset: 0,
          data: [0x02020202, 0x02020202],
          arrayType: 'Uint32Array',
          useArrayBuffer: false,
        },
        {
          bufferOffset: 0,
          data: [0x01010101],
          arrayType: 'Uint32Array',
          useArrayBuffer: false,
        },
      ], // Expected [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5]
    },
  ] as const)
  .fn(t => {
    t.testWriteBuffer(...t.params.writes);
  });
