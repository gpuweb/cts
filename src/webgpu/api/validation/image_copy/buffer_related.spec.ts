export const description = `Validation tests for buffer related parameters for copies`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import {
  kSizedTextureFormats,
  kTextureFormatInfo,
  textureDimensionAndFormatCompatible,
} from '../../../capability_info.js';
import { kImageCopyTypes } from '../../../util/texture/layout.js';

import { ImageCopyTest, formatCopyableWithMethod } from './image_copy.js';

export const g = makeTestGroup(ImageCopyTest);

g.test('valid')
  .desc(`The buffer must be valid and not destroyed.`)
  .params(u =>
    u //
      // B2B copy validations are at api,validation,encoding,cmds,copyBufferToBuffer.spec.ts
      .combine('method', ['CopyB2T', 'CopyT2B'] as const)
      .combine('bufferState', ['valid', 'destroyed', 'error'])
  )
  .fn(async t => {
    const { method, bufferState } = t.params;

    // A valid buffer.
    let buffer = t.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    switch (bufferState) {
      case 'destroyed': {
        buffer.destroy();
        break;
      }
      case 'error': {
        buffer = t.getErrorBuffer();
        break;
      }
    }

    const success = bufferState === 'valid';
    const submit = bufferState === 'destroyed';

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depthOrArrayLayers: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    t.testBuffer(
      buffer,
      texture,
      { bytesPerRow: 0 },
      { width: 0, height: 0, depthOrArrayLayers: 0 },
      { dataSize: 16, method, success, submit }
    );
  });

g.test('bytes_per_row_alignment')
  .desc(
    `Test that bytesPerRow must be a multiple of 256 for CopyB2T and CopyT2B if it is required.`
  )
  .params(u =>
    u //
      .combine('method', kImageCopyTypes)
      .combine('dimension', ['2d', '3d'] as const)
      .combine('format', kSizedTextureFormats)
      .filter(({ dimension, format }) => textureDimensionAndFormatCompatible(dimension, format))
      .filter(formatCopyableWithMethod)
      .beginSubcases()
      .combine('bytesPerRow', [undefined, 0, 1, 255, 256, 257, 512])
      .combine('copyHeight', [0, 1, 2, 4, 8])
      // copyHeight must be aligned with blockHeight
      .filter(({ format, copyHeight }) => copyHeight % kTextureFormatInfo[format].blockHeight === 0)
      // bytesPerRow must be specified and it must be equal or greater than the bytes size of each row if we are copying multiple rows.
      // Note that we are copying one single block on each row in this test.
      .filter(
        ({ format, bytesPerRow, copyHeight }) =>
          copyHeight / kTextureFormatInfo[format].blockHeight <= 1 ||
          (bytesPerRow !== undefined && bytesPerRow >= kTextureFormatInfo[format].bytesPerBlock)
      )
  )
  .fn(async t => {
    const { method, dimension, format, bytesPerRow, copyHeight } = t.params;

    const info = kTextureFormatInfo[format];
    await t.selectDeviceOrSkipTestCase(info.feature);

    const buffer = t.device.createBuffer({
      size: 512 * 8 * 16,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    let success = false;
    // writeTexture doesn't require bytersPerRow to be 256-byte aligned.
    if (method === 'WriteTexture') success = true;
    // If the copy height <= 1, bytesPerRow is not required.
    if (copyHeight / info.blockHeight <= 1 && bytesPerRow === undefined) success = true;
    // If bytesPerRow > 0 and it is a multiple of 256, it will succeeed if other parameters are valid.
    if (bytesPerRow !== undefined && bytesPerRow > 0 && bytesPerRow % 256 === 0) success = true;

    const texture = t.device.createTexture({
      size: [info.blockWidth, !copyHeight ? info.blockHeight : copyHeight, 1],
      dimension,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    t.testBuffer(
      buffer,
      texture,
      { bytesPerRow },
      { width: info.blockWidth, height: copyHeight, depthOrArrayLayers: 1 },
      { dataSize: 512 * 8 * 16, method, success }
    );
  });
