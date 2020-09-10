export const description = `
copyTextureToTexture tests.

Test Plan: (TODO(jiawei.shao@intel.com): add all the remaining tests)
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
`;

import { poptions, params } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kTextureUsages } from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  TestCopyTextureToTexture(
    source: GPUTextureCopyView,
    destination: GPUTextureCopyView,
    copySize: GPUExtent3D,
    isSuccess: boolean): void {

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
    { texture: errorTexture }, { texture: validTexture }, { width: 1, height: 1, depth: 1 }, false);
  t.TestCopyTextureToTexture(
    { texture: validTexture }, { texture: errorTexture }, { width: 1, height: 1, depth: 1 }, false);
});

g.test('mipmap_level')
  .params([
    { srcMipLevelCount: 1, dstMipLevelCount: 1, srcCopyMipLevel: 0, dstCopyMipLevel: 0, _isSuccess: true },
    { srcMipLevelCount: 1, dstMipLevelCount: 1, srcCopyMipLevel: 1, dstCopyMipLevel: 0, _isSuccess: false },
    { srcMipLevelCount: 1, dstMipLevelCount: 1, srcCopyMipLevel: 0, dstCopyMipLevel: 1, _isSuccess: false },
    { srcMipLevelCount: 3, dstMipLevelCount: 3, srcCopyMipLevel: 0, dstCopyMipLevel: 0, _isSuccess: true },
    { srcMipLevelCount: 3, dstMipLevelCount: 3, srcCopyMipLevel: 2, dstCopyMipLevel: 0, _isSuccess: true },
    { srcMipLevelCount: 3, dstMipLevelCount: 3, srcCopyMipLevel: 3, dstCopyMipLevel: 0, _isSuccess: false },
    { srcMipLevelCount: 3, dstMipLevelCount: 3, srcCopyMipLevel: 4, dstCopyMipLevel: 0, _isSuccess: false },
    { srcMipLevelCount: 3, dstMipLevelCount: 3, srcCopyMipLevel: 0, dstCopyMipLevel: 2, _isSuccess: true },
    { srcMipLevelCount: 3, dstMipLevelCount: 3, srcCopyMipLevel: 0, dstCopyMipLevel: 3, _isSuccess: false },
    { srcMipLevelCount: 3, dstMipLevelCount: 3, srcCopyMipLevel: 0, dstCopyMipLevel: 4, _isSuccess: false },
  ] as const)
  .fn(async t => {
    const { srcMipLevelCount, dstMipLevelCount, srcCopyMipLevel, dstCopyMipLevel, _isSuccess } = t.params;

    const srcTexture = t.device.createTexture({
      size: { width: 32, height: 32, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC,
      mipLevelCount: srcMipLevelCount,
    });
    const dstTexture = t.device.createTexture({
      size: { width: 32, height: 32, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
      mipLevelCount: dstMipLevelCount,
    });

    t.TestCopyTextureToTexture({ texture: srcTexture, mipLevel: srcCopyMipLevel }, { texture: dstTexture, mipLevel: dstCopyMipLevel }, { width: 1, height: 1, depth: 1 }, _isSuccess);
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

    const isSuccess = srcUsage === GPUTextureUsage.COPY_SRC && dstUsage === GPUTextureUsage.COPY_DST;

    t.TestCopyTextureToTexture({ texture: srcTexture }, { texture: dstTexture }, { width: 1, height: 1, depth: 1 }, isSuccess);
  });

g.test('sample_count')
  .params([
    { srcSamplecount: 1, dstSampleCount: 1, _isSuccess: true },
    { srcSamplecount: 1, dstSampleCount: 4, _isSuccess: false },
    { srcSamplecount: 4, dstSampleCount: 1, _isSuccess: false },
    { srcSamplecount: 4, dstSampleCount: 4, _isSuccess: true },
  ] as const)
  .fn(async t => {
    const { srcSamplecount, dstSampleCount, _isSuccess } = t.params;

    const srcTexture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC,
      sampleCount: srcSamplecount,
    });
    const dstTexture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_DST,
      sampleCount: dstSampleCount,
    });

    t.TestCopyTextureToTexture({ texture: srcTexture }, { texture: dstTexture }, { width: 4, height: 4, depth: 1 }, _isSuccess);
  });

g.test('multisampled_copy_restrictions')
  .params(
    params()
      .combine(poptions('srcCopyOrigin', [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }]))
      .combine(poptions('dstCopyOrigin', [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }]))
  )
  .fn(async t => {
    const { srcCopyOrigin, dstCopyOrigin } = t.params;

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

    const copyWidth = kWidth - Math.max(srcCopyOrigin.x, dstCopyOrigin.x);
    const copyHeight = kHeight - Math.max(srcCopyOrigin.y, dstCopyOrigin.y);

    const isSuccess = (kWidth === copyWidth) && (kHeight === copyHeight);

    t.TestCopyTextureToTexture({ texture: srcTexture, origin: srcCopyOrigin }, { texture: dstTexture, origin: dstCopyOrigin }, { width: copyWidth, height: copyHeight, depth: 1 }, isSuccess);
  });
