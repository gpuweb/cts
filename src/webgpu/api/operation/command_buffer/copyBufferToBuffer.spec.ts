export const description = 'copyBufferToBuffer operation tests';

import { poptions, params } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('b2b')
  .desc(
    `Validate the correctness of the copy by filling the srcBuffer with testable data, doing
  CopyBufferToBuffer() copy, and verifying the content of the whole dstBuffer with MapRead:
  Copy {4 bytes, part of, the whole} srcBuffer to the dstBuffer {with, without} a non-zero valid
  srcOffset that
  - covers the whole dstBuffer
  - covers the beginning of the dstBuffer
  - covers the end of the dstBuffer
  - covers neither the beginning nor the end of the dstBuffer`
  )
  .params(
    params()
      .combine(poptions('srcOffset', [0, 4, 8, 16]))
      .combine(poptions('dstOffset', [0, 4, 8, 16]))
      .combine(poptions('copySize', [0, 4, 8, 16]))
      .expand(p =>
        poptions('srcBufferSize', [p.srcOffset + p.copySize, p.srcOffset + p.copySize + 8])
      )
      .expand(p =>
        poptions('dstBufferSize', [p.dstOffset + p.copySize, p.dstOffset + p.copySize + 8])
      )
  )
  .fn(async t => {
    const { srcOffset, dstOffset, copySize, srcBufferSize, dstBufferSize } = t.params;

    const srcData = new Uint8Array(srcBufferSize);
    for (let i = 0; i < srcBufferSize; ++i) {
      srcData[i] = i + 1;
    }

    const src = t.device.createBuffer({
      mappedAtCreation: true,
      size: srcBufferSize,
      usage: GPUBufferUsage.COPY_SRC,
    });
    new Uint8Array(src.getMappedRange()).set(srcData);
    src.unmap();

    const dst = t.device.createBuffer({
      size: dstBufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const encoder = t.device.createCommandEncoder();
    encoder.copyBufferToBuffer(src, srcOffset, dst, dstOffset, copySize);
    t.device.defaultQueue.submit([encoder.finish()]);

    const expectedDstData = new Uint8Array(dstBufferSize);
    for (let i = 0; i < copySize; ++i) {
      expectedDstData[dstOffset + i] = srcData[srcOffset + i];
    }

    t.expectContents(dst, expectedDstData);
  });

g.test('b2b_CopyStateTransitions')
  .desc(
    `Validate the state transitions after the copy:
  first copy from srcBuffer to dstBuffer, then copy from dstBuffer to srcBuffer and check the
  content of the whole dstBuffer`
  )
  .fn(async t => {
    const srcData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const dstData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

    const src = t.device.createBuffer({
      mappedAtCreation: true,
      size: srcData.length,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    new Uint8Array(src.getMappedRange()).set(srcData);
    src.unmap();

    const dst = t.device.createBuffer({
      mappedAtCreation: true,
      size: dstData.length,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    new Uint8Array(dst.getMappedRange()).set(dstData);
    dst.unmap();

    const encoder = t.device.createCommandEncoder();
    encoder.copyBufferToBuffer(src, 0, dst, 4, 4);
    encoder.copyBufferToBuffer(dst, 0, src, 4, 4);
    t.device.defaultQueue.submit([encoder.finish()]);

    const expectedSrcData = new Uint8Array([1, 2, 3, 4, 10, 20, 30, 40]);
    const expectedDstData = new Uint8Array([10, 20, 30, 40, 1, 2, 3, 4]);
    t.expectContents(src, expectedSrcData);
    t.expectContents(dst, expectedDstData);
  });

g.test('b2b_CopyOrder')
  .desc(
    `Validate the order of the copies in one command buffer:
  first copy from srcBuffer to a region of dstBuffer, then copy from another part of srcBuffer to
  another region of dstBuffer which have overlaps with the region of dstBuffer in the first copy
  and check the content of the whole dstBuffer to see the copies are done in correct order.`
  )
  .fn(async t => {
    const srcData = new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]);

    const src = t.device.createBuffer({
      mappedAtCreation: true,
      size: srcData.length * 4,
      usage: GPUBufferUsage.COPY_SRC,
    });
    new Uint32Array(src.getMappedRange()).set(srcData);
    src.unmap();

    const dst = t.device.createBuffer({
      size: srcData.length * 4,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const encoder = t.device.createCommandEncoder();
    encoder.copyBufferToBuffer(src, 0, dst, 0, 16);
    encoder.copyBufferToBuffer(src, 16, dst, 8, 16);
    t.device.defaultQueue.submit([encoder.finish()]);

    const expectedDstData = new Uint32Array([1, 2, 5, 6, 7, 8, 0, 0]);
    t.expectContents(dst, expectedDstData);
  });
