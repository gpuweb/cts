export const description = `
copyTextureToTexture tests.

Test Plan:
* Validate the correctness of the copy by filling the srcTexture with testable data and any format that is
  supported by WebGPU, doing CopyTextureToTexture() copy, and verifying the content of the whole dstTexture:
  Copy {1 texel block, part of, the whole} srcTexture to the dstTexture {with, without} a non-zero valid
  srcOffset that
  - covers the whole dstTexture subresource
  - covers the corners of the dstTexture
  - doesn't cover any texels that are on the edge of the dstTexture
  - covers the mipmap level > 0 
  - covers {one, multiple} 2D texture array slices
`;

import { poptions, params } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/framework/util/util.js';
import { kAllTextureFormatInfo, kRegularTextureFormats } from '../../../capability_info.js';
import { GPUTest } from '../../../gpu_test.js';
import { align } from '../../../util/math.js';
import { physicalMipSize } from '../../../util/texture/subresource.js';

class F extends GPUTest {
  GetInitialDataPerMipLevel(
    textureSize: GPUExtent3DDict,
    format: GPUTextureFormat,
    mipLevel: number
  ): Uint8Array {
    // TODO(jiawei.shao@intel.com): support 3D textures
    const textureSizeAtLevel = physicalMipSize(textureSize, format, '2d', mipLevel);
    const bytesPerBlock = kAllTextureFormatInfo[format].bytesPerBlock;
    assert(bytesPerBlock !== undefined);

    const byteSize =
      bytesPerBlock *
      textureSizeAtLevel.width *
      textureSizeAtLevel.height *
      textureSizeAtLevel.depth;
    const initialData = new Uint8Array(new ArrayBuffer(byteSize));

    for (let i = 0; i < byteSize; ++i) {
      initialData[i] = (i ** 3 + i) % 251;
    }
    return initialData;
  }
}

export const g = makeTestGroup(F);

// TODO(jiawei.shao@intel.com): support all WebGPU texture formats
g.test('t2t_non_compressed_color_formats')
  .params(
    params()
      .combine(
        poptions('textureSize', [
          {
            srcTextureSize: { width: 32, height: 32, depth: 1 },
            dstTextureSize: { width: 32, height: 32, depth: 1 },
          },
          {
            srcTextureSize: { width: 31, height: 33, depth: 1 },
            dstTextureSize: { width: 31, height: 33, depth: 1 },
          },
          {
            srcTextureSize: { width: 32, height: 32, depth: 1 },
            dstTextureSize: { width: 64, height: 64, depth: 1 },
          },
          {
            srcTextureSize: { width: 32, height: 32, depth: 1 },
            dstTextureSize: { width: 63, height: 61, depth: 1 },
          },
          {
            srcTextureSize: { width: 32, height: 32, depth: 3 },
            dstTextureSize: { width: 32, height: 32, depth: 3 },
          },
        ])
      )
      .combine(poptions('format', kRegularTextureFormats))
      .combine(
        poptions('copyBoxOffsets', [
          // Copy the whole array slices from the source texture to the destination texture.
          // The copy extent will cover the whole subresource of either source or the
          // destination texture.
          // From (0, 0) of src to (0, 0) of dst.
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: 0 },
          },
          // From (0, 0) of src to (1, 0) of dst.
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 1, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: 0 },
          },
          // From (0, 0) of src to (0, 1) of dst.
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 0, y: 1, z: 0 },
            copyExtent: { width: 0, height: 0, depth: 0 },
          },
          // From (1, 0) of src to (0, 0) of dst.
          {
            srcOffset: { x: 1, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: 0 },
          },
          // From (0, 1) of src to (0, 0) of dst.
          {
            srcOffset: { x: 0, y: 1, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: 0 },
          },

          // Copy the whole array slices from the source texture to the destination texture.
          // From (1, 0) of src to (0, 0) of dst, and the copy extent will not cover the last
          // column of both source and destination texture.
          {
            srcOffset: { x: 1, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: -1, height: 0, depth: 0 },
          },
          // From (0, 1) of src to (0, 0) of dst, and the copy extent will not cover the last
          // row of both source and destination texture.
          {
            srcOffset: { x: 0, y: 1, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: -1, depth: 0 },
          },

          // Copy 1 texture slice from the 2nd slice of the source texture to the 2nd slice of the
          // destination texture or copy nothing when they are not 2D array textures.
          {
            srcOffset: { x: 0, y: 0, z: 1 },
            dstOffset: { x: 0, y: 0, z: 1 },
            copyExtent: { width: 0, height: 0, depth: -1 },
          },
          // Copy 1 texture slice from the 1st slice of the source texture to the 2nd slice of the
          // destination texture or copy nothing when they are not 2D array textures.
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 1 },
            copyExtent: { width: 0, height: 0, depth: -1 },
          },
          // Copy 1 texture slice from the 2nd slice of the source texture to the 1st slice of the
          // destination texture or copy nothing when they are not 2D array textures.
          {
            srcOffset: { x: 0, y: 0, z: 1 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: -1 },
          },
          // Copy 2 texture slices from the 1st slice of the source texture to the 1st slice of the
          // destination texture or copy nothing when they are not 2D array textures.
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: -1 },
          },
          // Copy 2 texture slices from the 2nd slice of the source texture to the 2nd slice of the
          // destination texture or copy nothing when they are not 2D array textures.
          {
            srcOffset: { x: 0, y: 0, z: 1 },
            dstOffset: { x: 0, y: 0, z: 1 },
            copyExtent: { width: 0, height: 0, depth: 0 },
          },
        ])
      )
      .combine(poptions('srcCopyLevel', [0, 3]))
      .combine(poptions('dstCopyLevel', [0, 3]))
  )
  .fn(async t => {
    const { textureSize, format, copyBoxOffsets, srcCopyLevel, dstCopyLevel } = t.params;

    const kMipLevelCount = 4;

    // Create srcTexture and dstTexture
    const srcTextureDesc: GPUTextureDescriptor = {
      size: textureSize.srcTextureSize,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      mipLevelCount: kMipLevelCount,
    };
    const srcTexture = t.device.createTexture(srcTextureDesc);
    const dstTextureDesc: GPUTextureDescriptor = {
      size: textureSize.dstTextureSize,
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      mipLevelCount: kMipLevelCount,
    };
    const dstTexture = t.device.createTexture(dstTextureDesc);

    // Fill the whole subresource of srcTexture at srcCopyLevel with initialSrcData.
    const initialSrcData = t.GetInitialDataPerMipLevel(
      textureSize.srcTextureSize,
      format,
      srcCopyLevel
    );
    const srcTextureSizeAtLevel = physicalMipSize(
      textureSize.srcTextureSize,
      format,
      '2d',
      srcCopyLevel
    );
    const bytesPerBlock = kAllTextureFormatInfo[format].bytesPerBlock;
    assert(bytesPerBlock !== undefined);
    t.device.defaultQueue.writeTexture(
      { texture: srcTexture, mipLevel: srcCopyLevel },
      initialSrcData,
      {
        offset: 0,
        bytesPerRow: srcTextureSizeAtLevel.width * bytesPerBlock,
        rowsPerImage: srcTextureSizeAtLevel.height,
      },
      srcTextureSizeAtLevel
    );

    // Copy the region specified by copyBoxOffsets from srcTexture to dstTexture.
    const dstTextureSizeAtLevel = physicalMipSize(
      textureSize.dstTextureSize,
      format,
      '2d',
      dstCopyLevel
    );
    const minWidth = Math.min(srcTextureSizeAtLevel.width, dstTextureSizeAtLevel.width);
    const appliedCopyWidth =
      minWidth +
      copyBoxOffsets.copyExtent.width -
      Math.max(copyBoxOffsets.srcOffset.x, copyBoxOffsets.dstOffset.x);
    const minHeight = Math.min(srcTextureSizeAtLevel.height, dstTextureSizeAtLevel.height);
    const appliedCopyHeight =
      minHeight +
      copyBoxOffsets.copyExtent.height -
      Math.max(copyBoxOffsets.srcOffset.y, copyBoxOffsets.dstOffset.y);
    const appliedCopyDepth = Math.max(
      textureSize.srcTextureSize.depth +
        copyBoxOffsets.copyExtent.depth -
        Math.max(copyBoxOffsets.srcOffset.z, copyBoxOffsets.dstOffset.z),
      0
    );

    const encoder = t.device.createCommandEncoder();
    encoder.copyTextureToTexture(
      { texture: srcTexture, mipLevel: srcCopyLevel, origin: copyBoxOffsets.srcOffset },
      { texture: dstTexture, mipLevel: dstCopyLevel, origin: copyBoxOffsets.dstOffset },
      { width: appliedCopyWidth, height: appliedCopyHeight, depth: appliedCopyDepth }
    );

    // Copy the whole content of dstTexture at dstCopyLevel to dstBuffer.
    const bytesPerDstAlignedRow = align(dstTextureSizeAtLevel.width * bytesPerBlock, 256);
    const dstBufferSize =
      (dstTextureSizeAtLevel.width * dstTextureSizeAtLevel.height - 1) * bytesPerDstAlignedRow +
      align(dstTextureSizeAtLevel.width * bytesPerBlock, 4);
    const dstBufferDesc: GPUBufferDescriptor = {
      size: dstBufferSize,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    };
    const dstBuffer = t.device.createBuffer(dstBufferDesc);

    encoder.copyTextureToBuffer(
      { texture: dstTexture, mipLevel: dstCopyLevel, origin: { x: 0, y: 0, z: 0 } },
      {
        buffer: dstBuffer,
        bytesPerRow: bytesPerDstAlignedRow,
        rowsPerImage: dstTextureSizeAtLevel.height,
      },
      dstTextureSizeAtLevel
    );
    t.device.defaultQueue.submit([encoder.finish()]);

    // Fill expectedDataWithPadding with the expected data of dstTexture. The other values in
    // expectedDataWithPadding are kept 0 to check if the texels untouched by the copy are 0
    // (their previous values).
    const expectedDataWithPadding = new ArrayBuffer(dstBufferSize);
    const expectedUint8DataWithPadding = new Uint8Array(expectedDataWithPadding);
    const expectedUint8Data = new Uint8Array(initialSrcData);
    for (let z = 0; z < appliedCopyDepth; ++z) {
      const srcOffsetZ = copyBoxOffsets.srcOffset.z + z;
      const dstOffsetZ = copyBoxOffsets.dstOffset.z + z;
      for (let y = 0; y < appliedCopyHeight; ++y) {
        const srcOffsetY = copyBoxOffsets.srcOffset.y + y;
        const dstOffsetY = copyBoxOffsets.dstOffset.y + y;
        const expectedDataWithPaddingOffset =
          bytesPerDstAlignedRow * (dstTextureSizeAtLevel.height * dstOffsetZ + dstOffsetY) +
          copyBoxOffsets.dstOffset.x * bytesPerBlock;
        const expectedDataOffset =
          bytesPerBlock *
            srcTextureSizeAtLevel.width *
            (srcTextureSizeAtLevel.height * srcOffsetZ + srcOffsetY) +
          copyBoxOffsets.srcOffset.x * bytesPerBlock;
        expectedUint8DataWithPadding.set(
          expectedUint8Data.slice(
            expectedDataOffset,
            expectedDataOffset + appliedCopyWidth * bytesPerBlock
          ),
          expectedDataWithPaddingOffset
        );
      }
    }

    // Verify the content of the whole subresouce of dstTexture at dstCopyLevel (in dstBuffer) is expected.
    t.expectContents(dstBuffer, expectedUint8DataWithPadding);
  });
