export const description = `
Tests writeBuffer validation.

- buffer missing usage flag
- bufferOffset {ok, unaligned, too large for buffer}
- dataOffset {ok, too large for data}
- buffer size {ok, too small for copy}
- data size {ok, too small for copy}
- size {aligned, unaligned}
- size unspecified; default {ok, too large for buffer}

Note: destroyed buffer is tested in destroyed/.

TODO: implement usage flag validation.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { TypedArrayBufferView, TypedArrayBufferViewConstructor } from '../../../gpu_test.js';
import { ValidationTest } from '../validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('ranges')
  .desc(
    `
Tests that the data ranges given to GPUQueue.writeBuffer() are properly validated. Tests calling
writeBuffer with both TypedArrays and ArrayBuffers and checks that the data offset and size is
interpreted correctly for both.

  - When passing a TypedArray the data offset and size is given in elements.
  - When passing an ArrayBuffer the data offset and size is given in bytes.

Also verifies that the specified data range:

  - Describes a valid range of the source buffer.
  - Fits fully within the destination buffer.
  - Is 4-byte aligned.
`
  )
  .fn(async t => {
    const queue = t.device.defaultQueue;

    function runTest(arrayType: TypedArrayBufferViewConstructor, testBuffer: boolean) {
      const elementSize = arrayType.BYTES_PER_ELEMENT;
      const buffer = t.device.createBuffer({
        size: 16 * elementSize,
        usage: GPUBufferUsage.COPY_DST,
      });
      const arraySm: TypedArrayBufferView | ArrayBuffer = testBuffer
        ? new arrayType(8).buffer
        : new arrayType(8);
      const arrayMd: TypedArrayBufferView | ArrayBuffer = testBuffer
        ? new arrayType(16).buffer
        : new arrayType(16);
      const arrayLg: TypedArrayBufferView | ArrayBuffer = testBuffer
        ? new arrayType(32).buffer
        : new arrayType(32);

      if (testBuffer) {
        const array15 = new Uint8Array(15).buffer;

        // Writing the full buffer that isn't 4-byte aligned.
        t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, array15));

        // Writing from an offset that causes source to be 4-byte aligned.
        queue.writeBuffer(buffer, 0, array15, 3);
      }

      if (testBuffer || elementSize < 4) {
        // Writing from an offset that causes the source to not be 4-byte aligned.
        t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, arrayMd, 3));

        // Writing with a size that is not 4-byte aligned.
        t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, arraySm, 0, 7));
      }

      // Writing the full buffer without offsets.
      queue.writeBuffer(buffer, 0, arraySm);
      queue.writeBuffer(buffer, 0, arrayMd);
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arrayLg));

      // Writing the full buffer with a 4-byte aligned offset.
      queue.writeBuffer(buffer, 8, arraySm);
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 8, arrayMd));

      // Writing the full buffer with a unaligned offset.
      t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 3, arraySm));

      // Writing remainder of buffer from offset.
      queue.writeBuffer(buffer, 0, arraySm, 4);
      queue.writeBuffer(buffer, 0, arrayMd, 4);
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arrayLg, 4));

      // Writing a larger buffer from an offset that allows it to fit in the destination.
      queue.writeBuffer(buffer, 0, arrayLg, 16);

      // Writing with both an offset and size.
      queue.writeBuffer(buffer, 0, arraySm, 4, 4);

      // Writing with a size that extends past the source buffer length.
      t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, arraySm, 0, 16));
      t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, arraySm, 4, 8));

      // Writing with a size that is 4-byte aligned but an offset that is not.
      queue.writeBuffer(buffer, 0, arraySm, 3, 4);
    }

    const arrayTypes = [
      Uint8Array,
      Uint8Array,
      Int8Array,
      Uint16Array,
      Int16Array,
      Uint32Array,
      Int32Array,
      Float32Array,
      Float64Array,
    ];

    runTest(Uint8Array, true);

    for (const arrayType of arrayTypes) {
      runTest(arrayType, false);
    }
  });
