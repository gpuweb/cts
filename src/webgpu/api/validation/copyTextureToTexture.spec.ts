export const description = `
copyTextureToTexture tests.

Test Plan: (TODO(jiawei.shao@intel.com): add tests on compressed formats, aspects, 1D/3D textures)
* the source and destination texture
  - the {source, destination} texture is {invalid, valid}.
  - mipLevel {>, =, <} the mipmap level count of the {source, destination} texture.
  - the source texture is created {with, without} GPUTextureUsage::CopySrc.
  - the destination texture is created {with, without} GPUTextureUsage::CopyDst.
* sample count
  - the sample count of the source texture {is, isn't} equal to the one of the destination texture
  - when the sample count is greater than 1:
    - it {is, isn't} a copy of the whole subresource of the source texture.
    - it {is, isn't} a copy of the whole subresource of the destination texture.
* texture format
  - the format of the source texture {is, isn't} equal to the one of the destination texture.
    - including: depth24plus-stencil8 to/from {depth24plus, stencil8}.
  - for each depth and/or stencil format: a copy between two textures with same format:
    - it {is, isn't} a copy of the whole subresource of the {source, destination} texture.
* copy ranges
  - if the texture dimension is 2D:
    - (srcOrigin.x + copyExtent.width) {>, =, <} the width of the subresource size of source
      textureCopyView.
    - (srcOrigin.y + copyExtent.height) {>, =, <} the height of the subresource size of source
      textureCopyView.
    - (srcOrigin.z + copyExtent.depth) {>, =, <} the depth of the subresource size of source
      textureCopyView.
    - (dstOrigin.x + copyExtent.width) {>, =, <} the width of the subresource size of destination
      textureCopyView.
    - (dstOrigin.y + copyExtent.height) {>, =, <} the height of the subresource size of destination
      textureCopyView.
    - (dstOrigin.z + copyExtent.depth) {>, =, <} the depth of the subresource size of destination
      textureCopyView.
* when the source and destination texture are the same one:
  - the set of source texture subresources {has, doesn't have} overlaps with the one of destination
    texture subresources.
`;

import { poptions, params } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import {
  kDepthStencilFormats,
  kTextureUsages,
  kUncompressedTextureFormats,
} from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  TestCopyTextureToTexture(
    source: GPUTextureCopyView,
    destination: GPUTextureCopyView,
    copySize: GPUExtent3D,
    isSuccess: boolean
  ): void {
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyTextureToTexture(source, destination, copySize);

    this.expectValidationError(() => {
      commandEncoder.finish();
    }, !isSuccess);
  }
}

export const g = makeTestGroup(F);

g.test('copy_with_invalid_texture').fn(async t => {
  const validTexture = t.device.createTexture({
    size: { width: 4, height: 4, depth: 1 },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
  });

  const errorTexture = t.getErrorTexture();

  t.TestCopyTextureToTexture(
    { texture: errorTexture },
    { texture: validTexture },
    { width: 1, height: 1, depth: 1 },
    false
  );
  t.TestCopyTextureToTexture(
    { texture: validTexture },
    { texture: errorTexture },
    { width: 1, height: 1, depth: 1 },
    false
  );
});

g.test('mipmap_level')
  .params([
    { srcLevelCount: 1, dstLevelCount: 1, srcCopyLevel: 0, dstCopyLevel: 0 },
    { srcLevelCount: 1, dstLevelCount: 1, srcCopyLevel: 1, dstCopyLevel: 0 },
    { srcLevelCount: 1, dstLevelCount: 1, srcCopyLevel: 0, dstCopyLevel: 1 },
    { srcLevelCount: 3, dstLevelCount: 3, srcCopyLevel: 0, dstCopyLevel: 0 },
    { srcLevelCount: 3, dstLevelCount: 3, srcCopyLevel: 2, dstCopyLevel: 0 },
    { srcLevelCount: 3, dstLevelCount: 3, srcCopyLevel: 3, dstCopyLevel: 0 },
    { srcLevelCount: 3, dstLevelCount: 3, srcCopyLevel: 0, dstCopyLevel: 2 },
    { srcLevelCount: 3, dstLevelCount: 3, srcCopyLevel: 0, dstCopyLevel: 3 },
  ] as const)
  .fn(async t => {
    const { srcLevelCount, dstLevelCount, srcCopyLevel, dstCopyLevel } = t.params;

    const srcTexture = t.device.createTexture({
      size: { width: 32, height: 32, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC,
      mipLevelCount: srcLevelCount,
    });
    const dstTexture = t.device.createTexture({
      size: { width: 32, height: 32, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
      mipLevelCount: dstLevelCount,
    });

    const isSuccess = srcCopyLevel < srcLevelCount && dstCopyLevel < dstLevelCount;
    t.TestCopyTextureToTexture(
      { texture: srcTexture, mipLevel: srcCopyLevel },
      { texture: dstTexture, mipLevel: dstCopyLevel },
      { width: 1, height: 1, depth: 1 },
      isSuccess
    );
  });

g.test('texture_usage')
  .params(
    params()
      .combine(poptions('srcUsage', kTextureUsages))
      .combine(poptions('dstUsage', kTextureUsages))
  )
  .fn(async t => {
    const { srcUsage, dstUsage } = t.params;

    const srcTexture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      format: 'rgba8unorm',
      usage: srcUsage,
    });
    const dstTexture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      format: 'rgba8unorm',
      usage: dstUsage,
    });

    const isSuccess =
      srcUsage === GPUTextureUsage.COPY_SRC && dstUsage === GPUTextureUsage.COPY_DST;

    t.TestCopyTextureToTexture(
      { texture: srcTexture },
      { texture: dstTexture },
      { width: 1, height: 1, depth: 1 },
      isSuccess
    );
  });

g.test('sample_count')
  .params(
    params()
      .combine(poptions('srcSampleCount', [1, 4]))
      .combine(poptions('dstSampleCount', [1, 4]))
  )
  .fn(async t => {
    const { srcSampleCount, dstSampleCount } = t.params;

    const srcTexture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC,
      sampleCount: srcSampleCount,
    });
    const dstTexture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
      sampleCount: dstSampleCount,
    });

    const isSuccess = srcSampleCount === dstSampleCount;
    t.TestCopyTextureToTexture(
      { texture: srcTexture },
      { texture: dstTexture },
      { width: 4, height: 4, depth: 1 },
      isSuccess
    );
  });

g.test('multisampled_copy_restrictions')
  .params(
    params()
      .combine(
        poptions('srcCopyOrigin', [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 1, y: 1, z: 0 },
        ])
      )
      .combine(
        poptions('dstCopyOrigin', [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 1, y: 1, z: 0 },
        ])
      )
      .expand(p => poptions('copyWidth', [32 - Math.max(p.srcCopyOrigin.x, p.dstCopyOrigin.x), 16]))
      .expand(p => poptions('copyHeight', [16 - Math.max(p.srcCopyOrigin.y, p.dstCopyOrigin.y), 8]))
  )
  .fn(async t => {
    const { srcCopyOrigin, dstCopyOrigin, copyWidth, copyHeight } = t.params;

    const kWidth = 32;
    const kHeight = 16;

    // Currently we don't support multisampled 2D array textures and the mipmap level count of the
    // multisampled textures must be 1.
    const srcTexture = t.device.createTexture({
      size: { width: kWidth, height: kHeight, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC,
      sampleCount: 4,
    });
    const dstTexture = t.device.createTexture({
      size: { width: kWidth, height: kHeight, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
      sampleCount: 4,
    });

    const isSuccess = copyWidth === kWidth && copyHeight === kHeight;
    t.TestCopyTextureToTexture(
      { texture: srcTexture, origin: srcCopyOrigin },
      { texture: dstTexture, origin: dstCopyOrigin },
      { width: copyWidth, height: copyHeight, depth: 1 },
      isSuccess
    );
  });

g.test('uncompressed_texture_format_equality')
  .params(
    params()
      .combine(poptions('srcFormat', kUncompressedTextureFormats))
      .combine(poptions('dstFormat', kUncompressedTextureFormats))
  )
  .fn(async t => {
    const { srcFormat, dstFormat } = t.params;

    const kTextureSize = { width: 16, height: 16, depth: 1 };

    const srcTexture = t.device.createTexture({
      size: kTextureSize,
      format: srcFormat,
      usage: GPUTextureUsage.COPY_SRC,
    });

    const dstTexture = t.device.createTexture({
      size: kTextureSize,
      format: dstFormat,
      usage: GPUTextureUsage.COPY_DST,
    });

    const isSuccess = srcFormat === dstFormat;
    t.TestCopyTextureToTexture(
      { texture: srcTexture },
      { texture: dstTexture },
      kTextureSize,
      isSuccess
    );
  });

g.test('depth_stencil_copy_restrictions')
  .params(
    params()
      .combine(poptions('format', kDepthStencilFormats))
      .combine(
        poptions('srcCopyOrigin', [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 1, y: 1, z: 0 },
        ])
      )
      .combine(
        poptions('dstCopyOrigin', [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 1, y: 1, z: 0 },
        ])
      )
      .combine(poptions('srcTextureSize', [64, 32]))
      .combine(poptions('dstTextureSize', [64, 32]))
      .combine(poptions('srcCopyLevel', [1, 2]))
      .combine(poptions('dstCopyLevel', [0, 1]))
      .expand(p =>
        poptions('copyWidth', [
          Math.max(p.srcTextureSize >> p.srcCopyLevel, p.dstTextureSize >> p.dstCopyLevel) -
            Math.max(p.srcCopyOrigin.x, p.dstCopyOrigin.x),
          8,
        ])
      )
      .expand(p =>
        poptions('copyHeight', [
          Math.max(p.srcTextureSize >> p.srcCopyLevel, p.dstTextureSize >> p.dstCopyLevel) -
            Math.max(p.srcCopyOrigin.y, p.dstCopyOrigin.y),
          8,
        ])
      )
  )
  .fn(async t => {
    const {
      format,
      srcCopyOrigin,
      dstCopyOrigin,
      srcTextureSize,
      dstTextureSize,
      srcCopyLevel,
      dstCopyLevel,
      copyWidth,
      copyHeight,
    } = t.params;

    const kMipLevelCount = 3;
    const srcTexture = t.device.createTexture({
      size: { width: srcTextureSize, height: srcTextureSize, depth: 1 },
      format,
      mipLevelCount: kMipLevelCount,
      usage: GPUTextureUsage.COPY_SRC,
    });
    const dstTexture = t.device.createTexture({
      size: { width: dstTextureSize, height: dstTextureSize, depth: 1 },
      format,
      mipLevelCount: kMipLevelCount,
      usage: GPUTextureUsage.COPY_DST,
    });

    const isSuccess =
      copyWidth === srcTextureSize >> srcCopyLevel &&
      copyHeight === srcTextureSize >> srcCopyLevel &&
      copyWidth === dstTextureSize >> dstCopyLevel &&
      copyHeight === dstTextureSize >> dstCopyLevel;
    t.TestCopyTextureToTexture(
      { texture: srcTexture, origin: srcCopyOrigin, mipLevel: srcCopyLevel },
      { texture: dstTexture, origin: dstCopyOrigin, mipLevel: dstCopyLevel },
      { width: copyWidth, height: copyHeight, depth: 1 },
      isSuccess
    );
  });

g.test('copy_ranges')
  .params(
    params()
      .combine(
        poptions('srcCopyOrigin', [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 1 },
          { x: 0, y: 0, z: 2 },
          { x: 8, y: 4, z: 0 },
          { x: 8, y: 4, z: 1 },
          { x: 16, y: 8, z: 0 },
          { x: 16, y: 8, z: 1 },
        ])
      )
      .combine(
        poptions('dstCopyOrigin', [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 1 },
          { x: 0, y: 0, z: 2 },
          { x: 8, y: 4, z: 0 },
          { x: 8, y: 4, z: 1 },
          { x: 16, y: 8, z: 0 },
          { x: 16, y: 8, z: 1 },
        ])
      )
      .combine(
        poptions('copyExtent', [
          { width: 0, height: 0, depth: 0 },
          { width: 0, height: 0, depth: 1 },
          { width: 0, height: 0, depth: 2 },
          { width: 8, height: 0, depth: 1 },
          { width: 0, height: 4, depth: 1 },
          { width: 8, height: 4, depth: 1 },
          { width: 8, height: 4, depth: 2 },
          { width: 16, height: 8, depth: 1 },
          { width: 16, height: 8, depth: 2 },
          { width: 16, height: 16, depth: 0 },
        ])
      )
      .combine(poptions('srcCopyLevel', [0, 1]))
      .combine(poptions('dstCopyLevel', [0, 1]))
  )
  .fn(async t => {
    const { srcCopyOrigin, dstCopyOrigin, copyExtent, srcCopyLevel, dstCopyLevel } = t.params;

    const kTextureWidth = 16;
    const kTextureHeight = 8;
    const kMipLevelCount = 2;
    const kArrayLayerCount = 2;

    const srcTexture = t.device.createTexture({
      size: { width: kTextureWidth, height: kTextureHeight, depth: kArrayLayerCount },
      format: 'rgba8unorm',
      mipLevelCount: kMipLevelCount,
      usage: GPUTextureUsage.COPY_SRC,
    });
    const dstTexture = t.device.createTexture({
      size: { width: kTextureWidth, height: kTextureHeight, depth: kArrayLayerCount },
      format: 'rgba8unorm',
      mipLevelCount: kMipLevelCount,
      usage: GPUTextureUsage.COPY_DST,
    });

    const isSuccess =
      srcCopyOrigin.x + copyExtent.width <= kTextureWidth >> srcCopyLevel &&
      srcCopyOrigin.y + copyExtent.height <= kTextureHeight >> srcCopyLevel &&
      srcCopyOrigin.z + copyExtent.depth <= kArrayLayerCount &&
      dstCopyOrigin.x + copyExtent.width <= kTextureWidth >> dstCopyLevel &&
      dstCopyOrigin.y + copyExtent.height <= kTextureHeight >> dstCopyLevel &&
      dstCopyOrigin.z + copyExtent.depth <= kArrayLayerCount;

    t.TestCopyTextureToTexture(
      { texture: srcTexture, origin: srcCopyOrigin, mipLevel: srcCopyLevel },
      { texture: dstTexture, origin: dstCopyOrigin, mipLevel: dstCopyLevel },
      copyExtent,
      isSuccess
    );
  });

g.test('copy_within_same_texture')
  .params(
    params()
      .combine(poptions('srcCopyOriginZ', [0, 2, 4]))
      .combine(poptions('dstCopyOriginZ', [0, 2, 4]))
      .combine(poptions('copyExtentDepth', [1, 2, 3]))
  )
  .fn(async t => {
    const { srcCopyOriginZ, dstCopyOriginZ, copyExtentDepth } = t.params;

    const kArrayLayerCount = 7;

    const testTexture = t.device.createTexture({
      size: { width: 16, height: 16, depth: kArrayLayerCount },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const isSuccess =
      Math.min(srcCopyOriginZ, dstCopyOriginZ) + copyExtentDepth <=
      Math.max(srcCopyOriginZ, dstCopyOriginZ);
    t.TestCopyTextureToTexture(
      { texture: testTexture, origin: { x: 0, y: 0, z: srcCopyOriginZ } },
      { texture: testTexture, origin: { x: 0, y: 0, z: dstCopyOriginZ } },
      { width: 16, height: 16, depth: copyExtentDepth },
      isSuccess
    );
  });
