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
