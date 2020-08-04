export const description = `
writeTexture validation tests.
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kTextureFormats, kTextureFormatInfo } from '../../capability_info.js';

import { CopyBetweenLinearDataAndTextureTest, TestMethod, kTestValuesForDivisibilityBy4 } from './copyBetweenLinearDataAndTexture.js';

export const g = makeTestGroup(CopyBetweenLinearDataAndTextureTest);

g.test('texture_must_be_valid')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('texture_state', ['valid', 'destroyed', 'error']))
  )
  .fn(async t => {
    const { method, texture_state } = t.params;

    // A valid texture.
    let texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      mipLevelCount: 1,
      sampleCount: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    if (texture_state === 'destroyed') {
      // Texture becomes destroyed.
      texture.destroy();
    }

    if (texture_state === 'error') {
      // An error texture.
      t.device.pushErrorScope('validation');
      texture = t.device.createTexture({
        size: { width: 0, height: 0, depth: 0 },
        mipLevelCount: 1,
        sampleCount: 1,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
      });
      t.device.popErrorScope();
    }

    let success = texture_state === 'valid';

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 256, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('texture_usage_must_be_valid')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('usage', [GPUTextureUsage.COPY_SRC, GPUTextureUsage.COPY_DST]))
  )
  .fn(async t => {
    const { usage, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      mipLevelCount: 1,
      sampleCount: 1,
      format: 'rgba8unorm',
      usage: usage,
    });

    const success = (method == TestMethod.CopyTextureToBuffer 
                      ? usage == GPUTextureUsage.COPY_SRC
                      : usage == GPUTextureUsage.COPY_DST);

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 256, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('sample_count_must_be_1')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('sampleCount', [1, 4]))
  )
  .fn(async t => {
    const { sampleCount, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 4, height: 4, depth: 1 },
      mipLevelCount: 1,
      sampleCount: sampleCount,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.SAMPLED,
    });

    const success = sampleCount === 1;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 256, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('mip_level_must_be_in_range')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('mipLevelCount', [3, 5]))
      .combine(poptions('mipLevel', [3, 4]))
  )
  .fn(async t => {
    const { mipLevelCount, mipLevel, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 32, height: 32, depth: 1 },
      mipLevelCount: mipLevelCount,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    const success = mipLevel < mipLevelCount;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 }, mipLevel: mipLevel },
      { bytesPerRow: 256, rowsPerImage: 16 },
      { width: 0, height: 0, depth: 0 },
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('1d_texture')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('size', [
        { width: 1, height: 0, depth: 0},
        { width: 0, height: 0, depth: 0},
        { width: 0, height: 0, depth: 1},
        { width: 0, height: 1, depth: 0},
        { width: 0, height: 0, depth: 2},
        { width: 0, height: 2, depth: 0},
      ]))
  )
  .fn(async t => {
    const { size, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 2, height: 1, depth: 1 },
      mipLevelCount: 1,
      dimension: '1d',
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    // For 1d textures we require copyHeight and copyDepth to be 1,
    // copyHeight or copyDepth being 0 should cause a validation error.
    const success = size.height == 1 && size.depth == 1;

    t.testRun(
      { texture: texture, origin: { x: 0, y: 0, z: 0 } },
      { bytesPerRow: 256, rowsPerImage: 16 },
      size,
      { dataSize: 16, method: method, success: success },
    );
  });

g.test('texel_block_alignments_on_origin')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('value', kTestValuesForDivisibilityBy4))
      .combine(poptions('coordinate_to_test', ['x', 'y', 'z'] as const))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { value, coordinate_to_test, format, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 12, height: 12, depth: 12 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let origin = { x: 0, y: 0, z: 0 };
    let size = { width: 0, height: 0, depth: 0 };
    let success = true;

    origin[coordinate_to_test] = value;
    switch (coordinate_to_test) {
      case 'x': {
       success = origin.x % kTextureFormatInfo[format].blockWidth === 0;
       break;
      }
      case 'y': {
       success = origin.y % kTextureFormatInfo[format].blockHeight === 0;
       break;
      }
    }

    t.testRun(
      { texture: texture, origin: origin },
      { bytesPerRow: 1024, rowsPerImage: 16 },
      size,
      { dataSize: 1, method: method, success: success },
    );
  });

g.test('texel_block_alignments_on_size')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('value', kTestValuesForDivisibilityBy4))
      .combine(poptions('coordinate_to_test', ['width', 'height', 'depth'] as const))
      .combine(poptions('format', kTextureFormats))
      .unless(({ format }) => !kTextureFormatInfo[format].copyable)
  )
  .fn(async t => {
    const { value, coordinate_to_test, format, method } = t.params;

    const texture = t.device.createTexture({
      size: { width: 12, height: 12, depth: 12 },
      mipLevelCount: 1,
      format: format,
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    let origin = { x: 0, y: 0, z: 0 };
    let size = { width: 0, height: 0, depth: 0 };
    let success = true;

    size[coordinate_to_test] = value;
    switch (coordinate_to_test) {
      case 'width': {
        success = size.width % kTextureFormatInfo[format].blockWidth === 0;
        break;
      }
      case 'height': {
        success = size.height % kTextureFormatInfo[format].blockHeight === 0;
        break;
      }
    }

    t.testRun(
      { texture: texture, origin: origin },
      { bytesPerRow: 1024, rowsPerImage: 16 },
      size,
      { dataSize: 1, method: method, success: success },
    );
  });

// TODO: might need dimensions.
g.test('texture_range_conditions')
  .params(
    params()
      .combine(poptions('method', [TestMethod.WriteTexture, TestMethod.CopyBufferToTexture, TestMethod.CopyTextureToBuffer]))
      .combine(poptions('origin_value', [7, 8]))
      .combine(poptions('copy_size_value', [7, 8]))
      .combine(poptions('texture_size_value', [14, 15]))
      .combine(poptions('mipLevel', [0, 2]))
      .combine(poptions('coordinate_to_test', [0, 1, 2] as const))
  )
  .fn(async t => {
    const { origin_value, copy_size_value, texture_size_value, mipLevel, coordinate_to_test, method } = t.params;

    let origin: GPUOrigin3D = [0, 0, 0];
    let copy_size: GPUExtent3D = [0, 0, 0];
    let texture_size = { width: 16 << mipLevel, height: 16 << mipLevel, depth: 16 };
    const success = origin_value + copy_size_value <= texture_size_value;

    origin[coordinate_to_test] = origin_value;
    copy_size[coordinate_to_test] = copy_size_value;
    switch (coordinate_to_test) {
      case 0: {
        texture_size.width = texture_size_value << mipLevel;
        break;
      }
      case 1: {
        texture_size.height = texture_size_value << mipLevel;
        break;
      }
      case 2: {
        texture_size.depth = texture_size_value;
        break;
      }
    }

    const texture = t.device.createTexture({
      size: texture_size,
      mipLevelCount: 3,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });

    t.testRun(
      { texture: texture, origin: origin, mipLevel: mipLevel },
      { bytesPerRow: 1024, rowsPerImage: 32 },
      copy_size,
      { dataSize: 1, method: method, success: success },
    );
  });
