export const description = `
TODO:
- source.origin is unaligned
- ?
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('writeBuffer,Ranges')
  .params([
    {},
  ])
  .fn(async t => {
    const queue = t.device.defaultQueue;

    function runTest(arrayType : any, testBuffer : boolean) {
      const elementSize = arrayType.BYTES_PER_ELEMENT;
      const buffer = t.device.createBuffer({ size: 16 * elementSize, usage: GPUBufferUsage.COPY_DST });
      let arraySm : any = new arrayType(8);
      let arrayMd : any = new arrayType(16);
      let arrayLg : any = new arrayType(32);

      if (testBuffer) {
        arraySm = arraySm.buffer;
        arrayMd = arrayMd.buffer;
        arrayLg = arrayLg.buffer;

        const array15 = new Uint8Array(15).buffer;

        // Writing the full buffer that isn't 4-byte aligned.
        t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, array15));

        // Writing from an offset that causes source to be 4-byte aligned.
        t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, array15, 3), false);
      }

      if (elementSize < 4) {
        // Writing from an offset that causes the source to not be 4-byte aligned.
        t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, arrayMd, 3));

        // Writing with a size that is not 4-byte aligned.
        t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, arraySm, 0, 7));
      }

      // Writing the full buffer without offsets.
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arraySm), false);
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arrayMd), false);
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arrayLg), true);

      // Writing the full buffer with a 4-byte aligned offset.
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 8, arraySm), false);
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 8, arrayMd), true);

      // Writing the full buffer with a unaligned offset.
      t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 3, arraySm));

      // Writing remainder of buffer from offset.
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arraySm, 4), false);
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arrayMd, 4), false);
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arrayLg, 4), true);

      // Writing a larger buffer from an offset that allows it to fit in the destination.
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arrayLg, 16), false);

      // Writing with both an offset and size.
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arraySm, 4, 4), false);

      // Writing with a size that extends past the source buffer length.
      t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, arraySm, 0, 16));
      t.shouldThrow('OperationError', () => queue.writeBuffer(buffer, 0, arraySm, 4, 8));

      // Writing with a size that is 4-byte aligned but an offset that is not.
      t.expectGPUError('validation', () => queue.writeBuffer(buffer, 0, arraySm, 3, 4), false);
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