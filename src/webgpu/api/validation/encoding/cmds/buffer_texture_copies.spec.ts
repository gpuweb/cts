export const description = `
copyTextureToBuffer and copyBufferToTexture validation tests not covered by
the general image_copy tests, or by destroyed,*.
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
  .cases(params().combine(poptions('format', kDepthStencilFormats)))
  .subcases(() =>
    params().combine(poptions('aspect', ['all', 'depth-only', 'stencil-only'] as const))
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

  Given a depth stencil format, a copy aspect ('depth-only' or 'stencil-only'), the copy method
  (buffer-to-texture or texture-to-buffer) and the copy size, validate
  - if the copy can be successfully executed with the minimum required buffer size.
  - if the copy fails with a validation error when the buffer size is less than the minimum
  required buffer size.
`
  )
  .cases(
    params()
      .combine(poptions('format', kDepthStencilFormats))
      .combine(poptions('aspect', ['depth-only', 'stencil-only'] as const))
      .combine(poptions('copyType', ['CopyB2T', 'CopyT2B'] as const))
      .filter(param => {
        return depthStencilBufferTextureCopySupported(param.copyType, param.format, param.aspect);
      })
  )
  .subcases(() =>
    params().combine(
      poptions('copySize', [
        { width: 8, height: 1, depthOrArrayLayers: 1 },
        { width: 4, height: 4, depthOrArrayLayers: 1 },
        { width: 4, height: 4, depthOrArrayLayers: 3 },
      ])
    )
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

g.test('depth_stencil_format,buffer_offset')
  .desc(
    `
    Validate for every depth stencil formats the buffer offset must be a multiple of the texel aspect ('depth-only' or 'stencil-only')
    size of the texture format in copyBufferToTexture() and copyTextureToBuffer().
    `
  )
  .cases(
    params()
      .combine(poptions('format', kDepthStencilFormats))
      .combine(poptions('aspect', ['depth-only', 'stencil-only'] as const))
      .combine(poptions('copyType', ['CopyB2T', 'CopyT2B'] as const))
      .filter(param => {
        return depthStencilBufferTextureCopySupported(param.copyType, param.format, param.aspect);
      })
  )
  .fn(async t => {
    const { format, aspect, copyType } = t.params;

    const textureSize = { width: 4, height: 4, depthOrArrayLayers: 1 };

    const texture = t.device.createTexture({
      size: textureSize,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const texelAspectSize = depthStencilFormatAspectSize(format, aspect);
    assert(texelAspectSize > 0);

    const bytesPerRow = align(texelAspectSize * textureSize.width, kBytesPerRowAlignment);
    const rowsPerImage = textureSize.height;
    const minimumBufferSize =
      bytesPerRow * (rowsPerImage * textureSize.depthOrArrayLayers - 1) +
      align(texelAspectSize * textureSize.width, kBufferCopyAlignment);
    assert(minimumBufferSize > kBufferCopyAlignment);

    const offsetsToTest: number[] = [texelAspectSize, 2 * texelAspectSize];
    if (texelAspectSize > 1) {
      // offset < texelAspectSize
      offsetsToTest.push(texelAspectSize / 2);

      // offset > texelAspectSize and offset is not a multiple of texelAspectSize
      offsetsToTest.push(texelAspectSize * 2 + 1);
      if (texelAspectSize > 2) {
        offsetsToTest.push(texelAspectSize * 2 + 2);
      }
    }

    offsetsToTest.forEach(offset => {
      const buffer = t.device.createBuffer({
        size: minimumBufferSize + offset,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      const isSuccess = offset % texelAspectSize === 0;

      if (copyType === 'CopyB2T') {
        t.testCopyTexturetoBuffer(
          { texture, aspect },
          { buffer, offset, bytesPerRow, rowsPerImage },
          textureSize,
          isSuccess
        );
      } else {
        assert(copyType === 'CopyT2B');
        t.testCopyTexturetoBuffer(
          { texture, aspect },
          { buffer, offset, bytesPerRow, rowsPerImage },
          textureSize,
          isSuccess
        );
      }
    });
  });
