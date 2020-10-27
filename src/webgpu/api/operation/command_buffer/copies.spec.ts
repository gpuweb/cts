export const description = `
copy{Buffer,Texture}To{Buffer,Texture} tests.

Test Plan:
1. CopyBufferToBuffer
* Validate the correctness of the copy by filling the srcBuffer with testable data, doing
  CopyBufferToBuffer() copy, and verifying the content of the whole dstBuffer with MapRead:
  Copy {4 bytes, part of, the whole} srcBuffer to the dstBuffer {with, without} a non-zero valid
  srcOffset that
  - covers the whole dstBuffer
  - covers the beginning of the dstBuffer
  - covers the end of the dstBuffer
  - covers neither the beginning nor the end of the dstBuffer
* Validate the state transitions after the copy:
  first copy from srcBuffer to dstBuffer, then copy from dstBuffer to srcBuffer and check the
  content of the whole dstBuffer
* Validate the order of the copies in one command buffer:
  first copy from srcBuffer to a region of dstBuffer, then copy from another part of srcBuffer to
  another region of dstBuffer which have overlaps with the region of dstBuffer in the first copy
  and check the content of the whole dstBuffer to see the copies are done in correct order.
2. CopyTextureToTexture
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
import { getTexelDataRepresentation } from '../../../util/texture/texelData.js';

class F extends GPUTest {
  GetPhysicalSubresourceSize(
    textureSize: GPUExtent3DDict,
    format: GPUTextureFormat,
    mipLevel: number
  ): GPUExtent3DDict {
    const virtualWidthAtLevel = Math.max(textureSize.width >> mipLevel, 1);
    const virtualHeightAtLevel = Math.max(textureSize.height >> mipLevel, 1);
    const physicalWidthAtLevel = align(
      virtualWidthAtLevel,
      kAllTextureFormatInfo[format].blockWidth
    );
    const physicalHeightAtLevel = align(
      virtualHeightAtLevel,
      kAllTextureFormatInfo[format].blockHeight
    );
    return { width: physicalWidthAtLevel, height: physicalHeightAtLevel, depth: textureSize.depth };
  }

  GetInitialDataPerMipLevel(
    textureSize: GPUExtent3DDict,
    format: GPUTextureFormat,
    bytesPerBlock: number,
    mipLevel: number
  ): ArrayBuffer {
    const textureSizeAtLevel = this.GetPhysicalSubresourceSize(textureSize, format, mipLevel);

    const initialData = new ArrayBuffer(
      bytesPerBlock *
        textureSizeAtLevel.width *
        textureSizeAtLevel.height *
        textureSizeAtLevel.depth
    );

    let initialDataView = undefined;
    switch (format) {
      case 'r32uint':
      case 'rg32uint':
      case 'rgba32uint': {
        initialDataView = new Uint32Array(initialData);
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = i * (mipLevel + 1);
        }
        break;
      }

      case 'r32sint':
      case 'rg32sint':
      case 'rgba32sint': {
        initialDataView = new Int32Array(initialData);
        let sign = -1;
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = i * (mipLevel + 1) * sign;
          sign *= -1;
        }
        break;
      }

      case 'r32float':
      case 'rg32float':
      case 'rgba32float': {
        initialDataView = new Float32Array(initialData);
        let factor = 1.1;
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = i * (mipLevel + 1) * factor;
          factor *= -1;
        }
        break;
      }

      case 'r8sint':
      case 'r8snorm':
      case 'rg8sint':
      case 'rg8snorm':
      case 'rgba8sint':
      case 'rgba8snorm': {
        initialDataView = new Int8Array(initialData);
        let sign = -1;
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = ((i * (mipLevel + 1)) % 128) * sign;
          sign *= -1;
        }
        break;
      }

      case 'r8uint':
      case 'r8unorm':
      case 'rg8uint':
      case 'rg8unorm':
      case 'rgba8uint':
      case 'rgba8unorm':
      case 'rgba8unorm-srgb':
      case 'bgra8unorm':
      case 'bgra8unorm-srgb': {
        initialDataView = new Uint8Array(initialData);
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = (i * (mipLevel + 1)) % 256;
        }
        break;
      }

      case 'r16sint':
      case 'rg16sint':
      case 'rgba16sint': {
        initialDataView = new Uint16Array(initialData);
        let sign = -1;
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = ((i * (mipLevel + 1)) % 32768) * sign;
          sign *= -1;
        }
        break;
      }

      case 'r16uint':
      case 'rg16uint':
      case 'rgba16uint': {
        initialDataView = new Uint16Array(initialData);
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = (i * (mipLevel + 1)) % 65536;
        }
        break;
      }

      case 'r16float':
      case 'rg16float':
      case 'rgba16float': {
        const texelDataRepresentation = getTexelDataRepresentation('r16float');
        initialDataView = new Uint16Array(initialData);
        let factor = 1.1;
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = new Uint16Array(
            texelDataRepresentation.packData({ R: i * factor })
          )[0];
          factor *= -1;
        }
        break;
      }

      case 'rgb10a2unorm': {
        const texelDataRepresentation = getTexelDataRepresentation('rgb10a2unorm');
        initialDataView = new Uint32Array(initialData);
        for (let i = 0; i < initialDataView.length; ++i) {
          initialDataView[i] = new Uint32Array(
            texelDataRepresentation.packData({ R: i % 1024, G: i % 512, B: i % 256, A: i % 4 })
          )[0];
        }
        break;
      }

      case 'rg11b10ufloat': {
        const texelDataRepresentation = getTexelDataRepresentation('rg11b10ufloat');
        initialDataView = new Uint32Array(initialData);
        for (let i = 0; i < initialDataView.length; ++i) {
          const factor = 0.9;
          const baseI = i % 16;
          initialDataView[i] = new Uint32Array(
            texelDataRepresentation.packData({
              R: baseI,
              G: baseI * factor * 2,
              B: (baseI * factor) / 2,
            })
          )[0];
        }
        break;
      }

      case 'rgb9e5ufloat': {
        const texelDataRepresentation = getTexelDataRepresentation('rgb9e5ufloat');
        initialDataView = new Uint32Array(initialData);
        for (let i = 0; i < initialDataView.length; ++i) {
          const factor = 0.9;
          initialDataView[i] = new Uint32Array(
            texelDataRepresentation.packData({
              R: i,
              G: i * factor,
              B: (i * factor) / 2,
            })
          )[0];
        }
        break;
      }

      default:
        break;
    }

    return initialData;
  }
}

export const g = makeTestGroup(F);

g.test('b2b')
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

g.test('b2b_CopyStateTransitions').fn(async t => {
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

g.test('b2b_CopyOrder').fn(async t => {
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

g.test('b2t2b').fn(async t => {
  const data = new Uint32Array([0x01020304]);

  const src = t.device.createBuffer({
    mappedAtCreation: true,
    size: 4,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  new Uint32Array(src.getMappedRange()).set(data);
  src.unmap();

  const dst = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const mid = t.device.createTexture({
    size: { width: 1, height: 1, depth: 1 },
    format: 'rgba8uint',
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
  });

  const encoder = t.device.createCommandEncoder();
  encoder.copyBufferToTexture(
    { buffer: src, bytesPerRow: 256 },
    { texture: mid, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { width: 1, height: 1, depth: 1 }
  );
  encoder.copyTextureToBuffer(
    { texture: mid, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { buffer: dst, bytesPerRow: 256 },
    { width: 1, height: 1, depth: 1 }
  );
  t.device.defaultQueue.submit([encoder.finish()]);

  t.expectContents(dst, data);
});

g.test('b2t2t2b').fn(async t => {
  const data = new Uint32Array([0x01020304]);

  const src = t.device.createBuffer({
    mappedAtCreation: true,
    size: 4,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  new Uint32Array(src.getMappedRange()).set(data);
  src.unmap();

  const dst = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const midDesc: GPUTextureDescriptor = {
    size: { width: 1, height: 1, depth: 1 },
    format: 'rgba8uint',
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
  };
  const mid1 = t.device.createTexture(midDesc);
  const mid2 = t.device.createTexture(midDesc);

  const encoder = t.device.createCommandEncoder();
  encoder.copyBufferToTexture(
    { buffer: src, bytesPerRow: 256 },
    { texture: mid1, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { width: 1, height: 1, depth: 1 }
  );
  encoder.copyTextureToTexture(
    { texture: mid1, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { texture: mid2, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { width: 1, height: 1, depth: 1 }
  );
  encoder.copyTextureToBuffer(
    { texture: mid2, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { buffer: dst, bytesPerRow: 256 },
    { width: 1, height: 1, depth: 1 }
  );
  t.device.defaultQueue.submit([encoder.finish()]);

  t.expectContents(dst, data);
});

// TODO(jiawei.shao@intel.com): support all WebGPU texture formats
g.test('t2t_non_compressed_color_formats')
  .params(
    params()
      .combine(
        poptions('textureSize', [
          { width: 32, height: 32, depth: 3 },
          { width: 31, height: 33, depth: 3 },
        ])
      )
      .combine(poptions('format', kRegularTextureFormats))
      .combine(
        poptions('copyBoxOffsets', [
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: -2 },
          },
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 1, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: -2 },
          },
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 0, y: 1, z: 0 },
            copyExtent: { width: 0, height: 0, depth: -2 },
          },
          {
            srcOffset: { x: 1, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: -2 },
          },
          {
            srcOffset: { x: 1, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: -1, height: 0, depth: -2 },
          },
          {
            srcOffset: { x: 0, y: 1, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: -2 },
          },
          {
            srcOffset: { x: 0, y: 1, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: -1, depth: -2 },
          },
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: 0 },
          },
          {
            srcOffset: { x: 0, y: 0, z: 0 },
            dstOffset: { x: 0, y: 0, z: 1 },
            copyExtent: { width: 0, height: 0, depth: -1 },
          },
          {
            srcOffset: { x: 0, y: 0, z: 1 },
            dstOffset: { x: 0, y: 0, z: 0 },
            copyExtent: { width: 0, height: 0, depth: -1 },
          },
          {
            srcOffset: { x: 0, y: 0, z: 1 },
            dstOffset: { x: 0, y: 0, z: 1 },
            copyExtent: { width: 0, height: 0, depth: -1 },
          },
          {
            srcOffset: { x: 0, y: 0, z: 1 },
            dstOffset: { x: 0, y: 0, z: 1 },
            copyExtent: { width: 0, height: 0, depth: 0 },
          },
        ])
      )
      .combine(poptions('srcCopyLevel', [0, 1]))
      .combine(poptions('dstCopyLevel', [0, 1]))
  )
  .fn(async t => {
    const { textureSize, format, copyBoxOffsets, srcCopyLevel, dstCopyLevel } = t.params;

    const kMipLevelCount = 4;

    // Create srcTexture and dstTexture
    const textureDesc: GPUTextureDescriptor = {
      size: { width: textureSize.width, height: textureSize.height, depth: textureSize.depth },
      format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      mipLevelCount: kMipLevelCount,
    };
    const srcTexture = t.device.createTexture(textureDesc);
    const dstTexture = t.device.createTexture(textureDesc);

    // Fill the whole subresource of srcTexture at srcCopyLevel with initalSrcData.
    const bytesPerBlock = kAllTextureFormatInfo[format].bytesPerBlock;
    assert(bytesPerBlock !== undefined);
    const initialSrcData = t.GetInitialDataPerMipLevel(
      { width: textureSize.width, height: textureSize.height, depth: textureSize.depth },
      format,
      bytesPerBlock,
      srcCopyLevel
    );
    const srcTextureSizeAtLevel = t.GetPhysicalSubresourceSize(textureSize, format, srcCopyLevel);
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
    const dstTextureSizeAtLevel = t.GetPhysicalSubresourceSize(textureSize, format, dstCopyLevel);
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
    const appliedCopyDepth =
      textureSize.depth +
      copyBoxOffsets.copyExtent.depth -
      Math.max(copyBoxOffsets.srcOffset.z, copyBoxOffsets.dstOffset.z);

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

    // Fill expectedDataWithPadding with the expected data of dstTexture.
    const expectedDataWithPadding = new ArrayBuffer(dstBufferSize);
    const expectedUint8DataWithPadding = new Uint8Array(expectedDataWithPadding);
    const expectedUint8Data = new Uint8Array(initialSrcData);
    for (let z = 0; z < appliedCopyDepth; ++z) {
      const srcOffsetZ = copyBoxOffsets.srcOffset.z + z;
      const dstOffsetZ = copyBoxOffsets.dstOffset.z + z;
      for (let y = 0; y < appliedCopyHeight; ++y) {
        const srcOffsetY = copyBoxOffsets.srcOffset.y + y;
        const dstOffsetY = copyBoxOffsets.dstOffset.y + y;
        for (let x = 0; x < appliedCopyWidth * bytesPerBlock; ++x) {
          const srcOffsetX = copyBoxOffsets.srcOffset.x * bytesPerBlock + x;
          const dstOffsetX = copyBoxOffsets.dstOffset.x * bytesPerBlock + x;
          expectedUint8DataWithPadding[
            bytesPerDstAlignedRow * (dstTextureSizeAtLevel.height * dstOffsetZ + dstOffsetY) +
              dstOffsetX
          ] =
            expectedUint8Data[
              bytesPerBlock *
                srcTextureSizeAtLevel.width *
                (srcTextureSizeAtLevel.height * srcOffsetZ + srcOffsetY) +
                srcOffsetX
            ];
        }
      }
    }

    // Verify the content of the whole subresouce of dstTexture at dstCopyLevel (in dstBuffer) is expected.
    t.expectContents(dstBuffer, expectedUint8DataWithPadding);
  });
