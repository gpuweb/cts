export const description = `
copyTextureToBuffer and copyBufferToTexture validation tests not covered by
the general image_copy tests, or by destroyed,*.

TODO: plan further
`;

import { poptions, params } from '../../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert } from '../../../../../common/framework/util/util.js';
import {
  kDepthStencilFormats,
  depthStencilBufferTextureCopySupported,
  depthStencilFormatAspectSize,
} from '../../../../capability_info.js';
import { align } from '../../../../util/math.js';
import { kBufferCopyAlignment, kBytesPerRowAlignment } from '../../../../util/texture/layout.js';
import { ValidationTest } from '../../validation_test.js';

class ImageCopyTest extends ValidationTest {
  testCopyBufferToTexture(
    source: GPUImageCopyBuffer,
    destination: GPUImageCopyTexture,
    copySize: GPUExtent3DStrict,
    isSuccess: boolean
  ): void {
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToTexture(source, destination, copySize);
    this.expectValidationError(() => {
      this.device.queue.submit([encoder.finish()]);
    }, !isSuccess);
  }

  testCopyTexturetoBuffer(
    source: GPUImageCopyTexture,
    destination: GPUImageCopyBuffer,
    copySize: GPUExtent3DStrict,
    isSuccess: boolean
  ): void {
    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToBuffer(source, destination, copySize);
    this.expectValidationError(() => {
      this.device.queue.submit([encoder.finish()]);
    }, !isSuccess);
  }
}

export const g = makeTestGroup(ImageCopyTest);

g.test('depth_stencil_format,copy_usage_and_aspect')
  .desc(
    `
  Validate the combination of usage and aspect of each depth stencil format in copyBufferToTexture
  and copyTextureToBuffer. See https://gpuweb.github.io/gpuweb/#depth-formats for more details.
`
  )
  .cases(
    params()
      .combine(poptions('format', kDepthStencilFormats))
      .combine(poptions('aspect', ['all', 'depth-only', 'stencil-only'] as const))
  )
  .fn(async t => {
    const { format, aspect } = t.params;

    const textureSize = { width: 1, height: 1, depthOrArrayLayers: 1 };
    const texture = t.device.createTexture({
      size: textureSize,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const buffer = t.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    {
      const success = depthStencilBufferTextureCopySupported('CopyB2T', format, aspect);
      t.testCopyBufferToTexture({ buffer }, { texture, aspect }, textureSize, success);
    }

    {
      const success = depthStencilBufferTextureCopySupported('CopyT2B', format, aspect);
      t.testCopyTexturetoBuffer({ texture, aspect }, { buffer }, textureSize, success);
    }
  });

g.test('depth_stencil_format,copy_buffer_size')
  .desc(
    `
  Validate the minimum buffer size for each depth stencil format in copyBufferToTexture
  and copyTextureToBuffer.
`
  )
  .cases(
    params()
      .combine(poptions('format', kDepthStencilFormats))
      .combine(poptions('aspect', ['depth-only', 'stencil-only'] as const))
      .combine(poptions('copyType', ['CopyB2T', 'CopyT2B'] as const))
      .combine(
        poptions('copySize', [
          { width: 8, height: 1, depthOrArrayLayers: 1 },
          { width: 4, height: 4, depthOrArrayLayers: 1 },
          { width: 4, height: 4, depthOrArrayLayers: 3 },
        ])
      )
      .filter(param => {
        return depthStencilBufferTextureCopySupported(param.copyType, param.format, param.aspect);
      })
  )
  .fn(async t => {
    const { format, aspect, copyType, copySize } = t.params;

    const texture = t.device.createTexture({
      size: copySize,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const texelAspectSize = depthStencilFormatAspectSize(format, aspect);
    assert(texelAspectSize > 0);

    const bytesPerRow = align(texelAspectSize * copySize.width, kBytesPerRowAlignment);
    const rowsPerImage = copySize.height;
    const minimumBufferSize =
      bytesPerRow * (rowsPerImage * copySize.depthOrArrayLayers - 1) +
      align(texelAspectSize * copySize.width, kBufferCopyAlignment);
    assert(minimumBufferSize > kBufferCopyAlignment);

    const bigEnoughBuffer = t.device.createBuffer({
      size: minimumBufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const smallerBuffer = t.device.createBuffer({
      size: minimumBufferSize - kBufferCopyAlignment,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    if (copyType === 'CopyB2T') {
      t.testCopyBufferToTexture(
        { buffer: bigEnoughBuffer, bytesPerRow, rowsPerImage },
        { texture, aspect },
        copySize,
        true
      );
      t.testCopyBufferToTexture(
        { buffer: smallerBuffer, bytesPerRow, rowsPerImage },
        { texture, aspect },
        copySize,
        false
      );
    } else {
      assert(copyType === 'CopyT2B');
      t.testCopyTexturetoBuffer(
        { texture, aspect },
        { buffer: bigEnoughBuffer, bytesPerRow, rowsPerImage },
        copySize,
        true
      );
      t.testCopyTexturetoBuffer(
        { texture, aspect },
        { buffer: smallerBuffer, bytesPerRow, rowsPerImage },
        copySize,
        false
      );
    }
  });
