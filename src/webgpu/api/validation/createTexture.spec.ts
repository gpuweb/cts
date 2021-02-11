export const description = `
createTexture validation tests.

TODO: review existing tests and merge with this plan:
> All x= every texture format
>
> - sampleCount = {0, 1, 4, 8, 16, 256} with format/dimension that supports multisample
>     - x= every texture format
> - sampleCount = {1, 4}
>     - with format that supports multisample, with all possible dimensions
>     - with dimension that support multisample, with all possible formats
>     - with format-dimension that support multisample, with {mipLevelCount, array layer count} = {1, 2}
> - 1d, {width, height, depth} > whatever the max is
>     - height max is 1 (unless 1d-array is added)
>     - depth max is 1
>     - x= every texture format
> - 2d, {width, height, depth} > whatever the max is
>     - depth (array layers) max differs from width/height
>     - x= every texture format
> - 3d, {width, height, depth} > whatever the max is
>     - x= every texture format
> - usage flags
>     - {0, ... each single usage flag}
>     - x= every texture format
> - every possible pair of usage flags
>     - with one common texture format
> - any other conditions from the spec
> - ...?

TODO: move destroy tests out of this file
`;

import { poptions, params } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kAllTextureFormats, kAllTextureFormatInfo } from '../../capability_info.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  getDescriptor(
    options: {
      width?: number;
      height?: number;
      arrayLayerCount?: number;
      mipLevelCount?: number;
      sampleCount?: number;
      format?: GPUTextureFormat;
    } = {}
  ): GPUTextureDescriptor {
    const {
      width = 32,
      height = 32,
      arrayLayerCount = 1,
      mipLevelCount = 1,
      sampleCount = 1,
      format = 'rgba8unorm',
    } = options;
    return {
      size: { width, height, depth: arrayLayerCount },
      mipLevelCount,
      sampleCount,
      dimension: '2d',
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.SAMPLED,
    };
  }
}

export const g = makeTestGroup(F);

g.test('zero_size')
  .desc(
    `Test texture creation with zero or nonzero size of
   width, height, depthOrArrayLayers and mipLevelCount for every dimension, and representative formats.`
  )
  .params(
    params()
      .combine(poptions('dimension', ['1d', '2d', '3d'] as const))
      .combine(
        poptions('zeroArgument', [
          'none',
          'width',
          'height',
          'depthOrArrayLayers',
          'mipLevelCount',
        ] as const)
      )
      .combine(
        poptions('format', [
          'rgba8unorm',
          'rgb10a2unorm',
          'depth24plus-stencil8',
          'bc1-rgba-unorm',
        ] as const)
      )
  )
  .fn(async t => {
    const { dimension, zeroArgument, format } = t.params;

    const size = dimension === '1d' ? [31, 1, 1] : dimension === '2d' ? [31, 31, 1] : [31, 31, 31];
    let mipLevelCount = 1;

    switch (zeroArgument) {
      case 'width':
        size[0] = 0;
        break;
      case 'height':
        size[1] = 0;
        break;
      case 'depthOrArrayLayers':
        size[2] = 0;
        break;
      case 'mipLevelCount':
        mipLevelCount = 0;
        break;
      default:
        break;
    }

    const descriptor = {
      size,
      mipLevelCount,
      dimension,
      format,
      usage: GPUTextureUsage.SAMPLED,
    };

    await t.selectDeviceOrSkipTestCase(kAllTextureFormatInfo[format].extension);

    const success = zeroArgument === 'none';
    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !success);
  });

g.test('mipLevelCount,format')
  .desc(
    `Test texture creation with no mipmap chain, partial mipmap chain, full mipmap chain, out-of-bounds mipmap chain
    for every format with different texture dimension types.`
  )
  .params(
    params()
      .combine(poptions('dimension', ['1d', '2d', '3d'] as const))
      .combine(poptions('format', kAllTextureFormats))
      .combine(poptions('mipLevelCount', [1, 3, 5, 6]))
  )
  .fn(async t => {
    const { format, dimension, mipLevelCount } = t.params;
    const size = dimension === '1d' ? [31, 1, 1] : dimension === '2d' ? [31, 31, 1] : [31, 31, 31];
    const descriptor = {
      size,
      mipLevelCount,
      dimension,
      format,
      usage: GPUTextureUsage.SAMPLED,
    };

    await t.selectDeviceOrSkipTestCase(kAllTextureFormatInfo[format].extension);

    const success = mipLevelCount <= 5;
    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !success);
  });

g.test('mipLevelCount,bound_check')
  .desc(
    `Test mip level count bound check upon different texture size and different texture dimension types.`
  )
  .params([
    { size: [32, 32], mipLevelCount: 6, _success: true }, // full mip chains for 2D texture are allowed (Mip level sizes: 32x32, 16x32, 8x8, 4x4, 2x2, 1x1)
    { size: [31, 32], mipLevelCount: 6, _success: true }, // full mip chains for 2D texture are allowed (Mip level sizes: 31x32, 15x16, 7x8, 3x4, 1x2, 1x1)
    { size: [32, 31], mipLevelCount: 6, _success: true }, // full mip chains for 2D texture are allowed (Mip level sizes: 32x31, 16x15, 8x7, 4x3, 2x1, 1x1)
    { size: [31, 32], mipLevelCount: 7, _success: false }, // too big mip chains on width for 2D texture are disallowed (Mip level sizes: 31x32, 15x16, 7x8, 3x4, 1x2, 1x1, ?x?)
    { size: [32, 31], mipLevelCount: 7, _success: false }, // too big mip chains on height for 2D texture are disallowed (Mip level sizes: 32x31, 16x15, 8x7, 4x3, 2x1, 1x1, ?x?)
    { size: [31, 31], mipLevelCount: 5, _success: true }, // full mip chains for non-power-of-two 2D texture are allowed (Mip level sizes: 31x31, 15x15, 7x7, 3x3, 1x1)
    { size: [31, 31], mipLevelCount: 6, _success: false }, // too big mip chains for non-power-of-two 2D texture are disallowed (Mip level sizes: 31x31, 15x15, 7x7, 3x3, 1x1, ?x?)
    { size: [32, 1, 1], dimension: '1d' as const, mipLevelCount: 6, _success: true }, // full mip chains for 1D texture are allowed (Mip level sizes: 32, 16, 8, 4, 2, 1)
    { size: [32, 1, 1], dimension: '1d' as const, mipLevelCount: 7, _success: false }, // too big mip chains for 1D texture are not allowed (Mip level sizes: 32, 16, 8, 4, 2, 1)
    { size: [31, 1, 1], dimension: '1d' as const, mipLevelCount: 5, _success: true }, // full mip chains for non-power-of-two 1D texture are allowed (Mip level sizes: 31, 15, 7, 3, 1)
    { size: [31, 1, 1], dimension: '1d' as const, mipLevelCount: 6, _success: false }, // too big mip chains for non-power-of-two 1D texture are not allowed (Mip level sizes: 31, 15, 7, 3, 1)
    { size: [32, 32, 32], dimension: '3d' as const, mipLevelCount: 6, _success: true }, // full mip chains for 3D texture are allowed (Mip level sizes: 32x32x32, 16x16x16, 8x8x8, 4x4x4, 2x2x2, 1x1x1)
    { size: [32, 32, 32], dimension: '3d' as const, mipLevelCount: 7, _success: false }, // too big mip chains for 3D texture are not allowed (Mip level sizes: 32x32x32, 16x16x16, 8x8x8, 4x4x4, 2x2x2, 1x1x1)
    { size: [31, 31, 31], dimension: '3d' as const, mipLevelCount: 5, _success: true }, // full mip chains for non-power-of-two 3D texture are allowed (Mip level sizes: 31x31x31, 15x15x15, 7x7x7, 3x3x3, 1x1x1)
    { size: [31, 31, 31], dimension: '3d' as const, mipLevelCount: 6, _success: false }, // too big mip chains for non-power-of-two 3D texture are not allowed (Mip level sizes: 31x31x31, 15x15x15, 7x7x7, 3x3x3, 1x1x1)
    { size: [32, 32], mipLevelCount: 100, _success: false }, // undefined shift check if miplevel is bigger than the integer bit width
    { size: [32, 8], mipLevelCount: 6, _success: true }, // non square mip map halves the resolution until a 1x1 dimension. (Mip maps: 32x8, 16x4, 8x2, 4x1, 2x1, 1x1)
    { size: [32, 8], mipLevelCount: 7, _success: true }, // too big mip chains for non square mip map halves are disallowed (Mip maps: 32x8, 16x4, 8x2, 4x1, 2x1, 1x1)
    { size: [32, 32, 64], mipLevelCount: 7, _success: false }, // array layer count for 2D texture should not be taken account to calculate mip levels. (Mip maps: 32x32x64, 16x16x64, 8x8x64, 4x4x64, 2x2x64, 1x1x64)
    {
      size: [32, 32, 64],
      dimension: '3d' as const,
      mipLevelCount: 7,
      _success: true,
    }, // depth of 3D texture should be taken account to calculate mip levels. (Mip maps: 32x32x64, 16x16x32, 8x8x16, 4x4x8, 2x2x4, 1x1x2, 1x1x1)
  ])
  .fn(async t => {
    const { size, mipLevelCount, dimension, _success } = t.params;

    const descriptor = {
      size,
      mipLevelCount,
      dimension,
      format: 'rgba8unorm' as const,
      usage: GPUTextureUsage.SAMPLED,
    };

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !_success);
  });

g.test('sampleCount')
  .params([
    // TODO: Consider making a list of "valid"+"invalid" texture descriptors in capability_info.
    { sampleCount: 0, _success: false }, // sampleCount of 0 is not allowed
    { sampleCount: 1, _success: true }, // sampleCount of 1 is allowed
    { sampleCount: 2, _success: false }, // sampleCount of 2 is not allowed
    { sampleCount: 3, _success: false }, // sampleCount of 3 is not allowed
    { sampleCount: 4, _success: true }, // sampleCount of 4 is allowed
    { sampleCount: 8, _success: false }, // sampleCount of 8 is not allowed
    { sampleCount: 16, _success: false }, // sampleCount of 16 is not allowed
    { sampleCount: 4, mipLevelCount: 2, _success: false }, // multisampled multi-level is not allowed
    { sampleCount: 4, arrayLayerCount: 2, _success: false }, // multisampled multi-layer is not allowed
  ])
  .fn(async t => {
    const { sampleCount, mipLevelCount, arrayLayerCount, _success } = t.params;

    const descriptor = t.getDescriptor({ sampleCount, mipLevelCount, arrayLayerCount });

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !_success);
  });

g.test('it_is_valid_to_destroy_a_texture').fn(t => {
  const descriptor = t.getDescriptor();
  const texture = t.device.createTexture(descriptor);
  texture.destroy();
});

g.test('it_is_valid_to_destroy_a_destroyed_texture').fn(t => {
  const descriptor = t.getDescriptor();
  const texture = t.device.createTexture(descriptor);
  texture.destroy();
  texture.destroy();
});

g.test('it_is_invalid_to_submit_a_destroyed_texture_before_and_after_encode')
  .params([
    { destroyBeforeEncode: false, destroyAfterEncode: false, _success: true },
    { destroyBeforeEncode: true, destroyAfterEncode: false, _success: false },
    { destroyBeforeEncode: false, destroyAfterEncode: true, _success: false },
  ])
  .fn(async t => {
    const { destroyBeforeEncode, destroyAfterEncode, _success } = t.params;

    const descriptor = t.getDescriptor();
    const texture = t.device.createTexture(descriptor);
    const textureView = texture.createView();

    if (destroyBeforeEncode) {
      texture.destroy();
    }

    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: textureView,
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    renderPass.endPass();
    const commandBuffer = commandEncoder.finish();

    if (destroyAfterEncode) {
      texture.destroy();
    }

    t.expectValidationError(() => {
      t.queue.submit([commandBuffer]);
    }, !_success);
  });

g.test('it_is_invalid_to_have_an_output_attachment_texture_with_non_renderable_format')
  .params(poptions('format', kAllTextureFormats))
  .fn(async t => {
    const format: GPUTextureFormat = t.params.format;
    const info = kAllTextureFormatInfo[format];

    const descriptor = t.getDescriptor({ width: 1, height: 1, format });

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !info.renderable);
  });

// TODO: Add tests for compressed texture formats
