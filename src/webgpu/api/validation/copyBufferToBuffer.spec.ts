export const description = `
copyBufferToBuffer tests.

Test Plan:
* Buffer is valid/invalid
  - the source buffer is invalid
  - the destination buffer is invalid
* Buffer usages
  - the source buffer is created without GPUBufferUsage::COPY_SRC
  - the destination buffer is created without GPUBufferUsage::COPY_DEST
* CopySize
  - copySize is not a multiple of 4
  - copySize is 0
* copy offsets
  - sourceOffset is not a multiple of 4
  - destinationOffset is not a multiple of 4
* Arthimetic overflow
  - (sourceOffset + copySize) is overflow
  - (destinationOffset + copySize) is overflow
* Out of bounds
  - (sourceOffset + copySize) > size of source buffer
  - (destinationOffset + copySize) > size of destination buffer
* Source buffer and destination buffer are the same buffer
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';

import { kMaxSafeMultipleOf8 } from '../../util/math.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  TestCopyBufferToBuffer(options: {
    srcBuffer: GPUBuffer;
    srcOffset: number;
    dstBuffer: GPUBuffer;
    dstOffset: number;
    copySize: number;
    isSuccess: boolean;
  }): void {
    const { srcBuffer, srcOffset, dstBuffer, dstOffset, copySize, isSuccess } = options;

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(srcBuffer, srcOffset, dstBuffer, dstOffset, copySize);

    this.expectValidationError(() => {
      commandEncoder.finish();
    }, !isSuccess);
  }
}

export const g = makeTestGroup(F);

g.test('copy_with_invalid_buffer').fn(async t => {
  const bufferSize = 16;

  const validBuffer = t.device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const errorBuffer = t.getErrorBuffer();

  const srcOffset = 0;
  const dstOffset = 0;
  const copySize = 8;

  t.TestCopyBufferToBuffer({
    srcBuffer: errorBuffer,
    srcOffset,
    dstBuffer: validBuffer,
    dstOffset,
    copySize,
    isSuccess: false,
  });

  t.TestCopyBufferToBuffer({
    srcBuffer: validBuffer,
    srcOffset,
    dstBuffer: errorBuffer,
    dstOffset,
    copySize,
    isSuccess: false,
  });
});

g.test('buffer_usage')
  .params([
    { srcUsage: GPUBufferUsage.COPY_SRC, dstUsage: GPUBufferUsage.COPY_DST, _isSuccess: true },
    { srcUsage: GPUBufferUsage.COPY_DST, dstUsage: GPUBufferUsage.COPY_DST, _isSuccess: false },
    { srcUsage: GPUBufferUsage.COPY_SRC, dstUsage: GPUBufferUsage.COPY_SRC, _isSuccess: false },
  ] as const)
  .fn(async t => {
    const { srcUsage, dstUsage, _isSuccess: isSuccess } = t.params;

    const bufferSize = 16;
    const srcOffset = 0;
    const dstOffset = 0;
    const copySize = 8;

    const srcBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: srcUsage,
    });
    const dstBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: dstUsage,
    });

    t.TestCopyBufferToBuffer({
      srcBuffer,
      srcOffset,
      dstBuffer,
      dstOffset,
      copySize,
      isSuccess,
    });
  });

g.test('copy_size')
  .params([
    { copySize: 0, _isSuccess: true },
    { copySize: 2, _isSuccess: false },
    { copySize: 4, _isSuccess: true },
    { copySize: 5, _isSuccess: false },
    { copySize: 8, _isSuccess: true },
  ] as const)
  .fn(async t => {
    const { copySize, _isSuccess: isSuccess } = t.params;

    const bufferSize = 16;
    const srcOffset = 0;
    const dstOffset = 0;

    const srcBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC,
    });
    const dstBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST,
    });

    t.TestCopyBufferToBuffer({
      srcBuffer,
      srcOffset,
      dstBuffer,
      dstOffset,
      copySize,
      isSuccess,
    });
  });

g.test('copy_offset')
  .params([
    { srcOffset: 0, dstOffset: 0, _isSuccess: true },
    { srcOffset: 2, dstOffset: 0, _isSuccess: false },
    { srcOffset: 4, dstOffset: 0, _isSuccess: true },
    { srcOffset: 5, dstOffset: 0, _isSuccess: false },
    { srcOffset: 8, dstOffset: 0, _isSuccess: true },
    { srcOffset: 0, dstOffset: 2, _isSuccess: false },
    { srcOffset: 0, dstOffset: 4, _isSuccess: true },
    { srcOffset: 0, dstOffset: 5, _isSuccess: false },
    { srcOffset: 0, dstOffset: 8, _isSuccess: true },
    { srcOffset: 4, dstOffset: 4, _isSuccess: true },
  ] as const)
  .fn(async t => {
    const { srcOffset, dstOffset, _isSuccess: isSuccess } = t.params;

    const bufferSize = 16;
    const copySize = 8;

    const srcBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC,
    });
    const dstBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST,
    });

    t.TestCopyBufferToBuffer({
      srcBuffer,
      srcOffset,
      dstBuffer,
      dstOffset,
      copySize,
      isSuccess,
    });
  });

g.test('copy_overflow')
  .params([
    { srcOffset: 0, dstOffset: 0, copySize: kMaxSafeMultipleOf8 },
    { srcOffset: 16, dstOffset: 0, copySize: kMaxSafeMultipleOf8 },
    { srcOffset: 0, dstOffset: 16, copySize: kMaxSafeMultipleOf8 },
    { srcOffset: kMaxSafeMultipleOf8, dstOffset: 0, copySize: 16 },
    { srcOffset: 0, dstOffset: kMaxSafeMultipleOf8, copySize: 16 },
    { srcOffset: kMaxSafeMultipleOf8, dstOffset: 0, copySize: kMaxSafeMultipleOf8 },
    { srcOffset: 0, dstOffset: kMaxSafeMultipleOf8, copySize: kMaxSafeMultipleOf8 },
    {
      srcOffset: kMaxSafeMultipleOf8,
      dstOffset: kMaxSafeMultipleOf8,
      copySize: kMaxSafeMultipleOf8,
    },
  ] as const)
  .fn(async t => {
    const { srcOffset, dstOffset, copySize } = t.params;

    const bufferSize = 16;
    const srcBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC,
    });
    const dstBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST,
    });

    t.TestCopyBufferToBuffer({
      srcBuffer,
      srcOffset,
      dstBuffer,
      dstOffset,
      copySize,
      isSuccess: false,
    });
  });

g.test('copy_out_of_bounds')
  .params([
    { srcOffset: 0, dstOffset: 0, copySize: 32, _isSuccess: true },
    { srcOffset: 0, dstOffset: 0, copySize: 36 },
    { srcOffset: 36, dstOffset: 0, copySize: 4 },
    { srcOffset: 0, dstOffset: 36, copySize: 4 },
    { srcOffset: 36, dstOffset: 0, copySize: 0 },
    { srcOffset: 0, dstOffset: 36, copySize: 0 },
    { srcOffset: 20, dstOffset: 0, copySize: 16 },
    { srcOffset: 0, dstOffset: 20, copySize: 16 },
  ] as const)
  .fn(async t => {
    const { srcOffset, dstOffset, copySize, _isSuccess = false } = t.params;

    const bufferSize = 32;
    const srcBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC,
    });
    const dstBuffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST,
    });

    t.TestCopyBufferToBuffer({
      srcBuffer,
      srcOffset,
      dstBuffer,
      dstOffset,
      copySize,
      isSuccess: _isSuccess,
    });
  });

g.test('copy_within_same_buffer')
  .params([
    { srcOffset: 0, dstOffset: 8, copySize: 4 },
    { srcOffset: 8, dstOffset: 0, copySize: 4 },
    { srcOffset: 0, dstOffset: 4, copySize: 8 },
    { srcOffset: 4, dstOffset: 0, copySize: 8 },
  ] as const)
  .fn(async t => {
    const { srcOffset, dstOffset, copySize } = t.params;

    const bufferSize = 16;
    const buffer = t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    t.TestCopyBufferToBuffer({
      srcBuffer: buffer,
      srcOffset,
      dstBuffer: buffer,
      dstOffset,
      copySize,
      isSuccess: false,
    });
  });
