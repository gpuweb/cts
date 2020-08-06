export const description = `
copyBufferToBuffer tests.
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';

import { ValidationTest } from './validation_test.js';

const MAX_ALIGNED_SAFE_INTEGER = Number.MAX_SAFE_INTEGER - 7;

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

  const errorBuffer = t.expectGPUError('validation', () =>
    t.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.MAP_READ,
    })
  );

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
    { srcUsage: GPUBufferUsage.COPY_SRC, dstUsage: GPUBufferUsage.COPY_DST, isSuccess: true },
    { srcUsage: GPUBufferUsage.COPY_DST, dstUsage: GPUBufferUsage.COPY_SRC, isSuccess: false },
    { srcUsage: GPUBufferUsage.COPY_SRC, dstUsage: GPUBufferUsage.COPY_SRC, isSuccess: false },
  ] as const)
  .fn(async t => {
    const { srcUsage, dstUsage, isSuccess } = t.params;

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
    { copySize: 0, isSuccess: true },
    { copySize: 2, isSuccess: false },
    { copySize: 4, isSuccess: true },
    { copySize: 5, isSuccess: false },
    { copySize: 8, isSuccess: true },
  ] as const)
  .fn(async t => {
    const { copySize, isSuccess } = t.params;

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
    { srcOffset: 0, dstOffset: 0, isSuccess: true },
    { srcOffset: 2, dstOffset: 0, isSuccess: false },
    { srcOffset: 4, dstOffset: 0, isSuccess: true },
    { srcOffset: 5, dstOffset: 0, isSuccess: false },
    { srcOffset: 8, dstOffset: 0, isSuccess: true },
    { srcOffset: 0, dstOffset: 2, isSuccess: false },
    { srcOffset: 0, dstOffset: 4, isSuccess: true },
    { srcOffset: 0, dstOffset: 5, isSuccess: false },
    { srcOffset: 0, dstOffset: 8, isSuccess: true },
    { srcOffset: 4, dstOffset: 8, isSuccess: true },
  ] as const)
  .fn(async t => {
    const { srcOffset, dstOffset, isSuccess } = t.params;

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
    { srcOffset: 16, dstOffset: 0, copySize: MAX_ALIGNED_SAFE_INTEGER },
    { srcOffset: 0, dstOffset: 16, copySize: MAX_ALIGNED_SAFE_INTEGER },
    { srcOffset: MAX_ALIGNED_SAFE_INTEGER, dstOffset: 0, copySize: 16 },
    { srcOffset: 0, dstOffset: MAX_ALIGNED_SAFE_INTEGER, copySize: 16 },
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
    { srcOffset: 0, dstOffset: 0, copySize: 36 },
    { srcOffset: 36, dstOffset: 0, copySize: 4 },
    { srcOffset: 0, dstOffset: 36, copySize: 4 },
    { srcOffset: 36, dstOffset: 0, copySize: 0 },
    { srcOffset: 0, dstOffset: 36, copySize: 0 },
    { srcOffset: 20, dstOffset: 0, copySize: 16 },
    { srcOffset: 0, dstOffset: 20, copySize: 16 },
  ] as const)
  .fn(async t => {
    const { srcOffset, dstOffset, copySize } = t.params;

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
      isSuccess: false,
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
