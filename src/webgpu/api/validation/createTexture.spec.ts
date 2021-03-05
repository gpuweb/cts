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
import {
  kAllTextureFormats,
  kAllTextureFormatInfo,
  kUncompressedTextureFormats,
  kUncompressedTextureFormatInfo,
} from '../../capability_info.js';
import { DefaultLimits } from '../../constants.js';
import { maxMipLevelCount } from '../../util/texture/base.js';

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
      size: { width, height, depthOrArrayLayers: arrayLayerCount },
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
    width, height, depthOrArrayLayers and mipLevelCount for every dimension, and representative formats.
    TODO: add tests for depth/stencil format if depth/stencil format can support mipmaps.`
  )
  // .cases(poptions('dimension', ['1d', '2d', '3d'] as const))
  .subcases(() =>
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
      .combine(poptions('format', ['rgba8unorm', 'rgb10a2unorm', 'bc1-rgba-unorm'] as const))
      .unless(({ format, dimension }) => format === 'bc1-rgba-unorm' && dimension !== '2d')
  )
  .fn(async t => {
    const { dimension, zeroArgument, format } = t.params;

    const size = dimension === '1d' ? [32, 1, 1] : dimension === '2d' ? [32, 32, 1] : [32, 32, 32];
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
    for every format with different texture dimension types.
    TODO: test 1D and 3D dimensions. Note that it is invalid for some formats with 1D/3D and/or mipmapping.`
  )
  .subcases(() =>
    params()
      .combine(poptions('format', kAllTextureFormats))
      .combine(poptions('mipLevelCount', [1, 3, 6, 7]))
  )
  .fn(async t => {
    const { format, mipLevelCount } = t.params;
    const size = [32, 32, 1];
    const descriptor = {
      size,
      mipLevelCount,
      format,
      usage: GPUTextureUsage.SAMPLED,
    };

    await t.selectDeviceOrSkipTestCase(kAllTextureFormatInfo[format].extension);

    const success = mipLevelCount <= 6;
    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !success);
  });

g.test('mipLevelCount,bound_check')
  .desc(
    `Test mip level count bound check upon different texture size and different texture dimension types.
    The cases below test: 1) there must be no mip levels after a 1 level (1D texture), or 1x1 level (2D texture), or 1x1x1 level (3D texture), 2) array layers are not mip-mapped, 3) power-of-two, non-power-of-two, and non-square sizes.
    TODO: test compressed texture`
  )
  .subcases(() => [
    { size: [32, 32] }, // Mip level sizes: 32x32, 16x16, 8x8, 4x4, 2x2, 1x1
    { size: [31, 32] }, // Mip level sizes: 31x32, 15x16, 7x8, 3x4, 1x2, 1x1
    { size: [32, 31] }, // Mip level sizes: 32x31, 16x15, 8x7, 4x3, 2x1, 1x1
    { size: [31, 31] }, // Mip level sizes: 31x31, 15x15, 7x7, 3x3, 1x1
    { size: [32], dimension: '1d' as const }, // Mip level sizes: 32, 16, 8, 4, 2, 1
    { size: [31], dimension: '1d' as const }, // Mip level sizes: 31, 15, 7, 3, 1
    { size: [32, 32, 32], dimension: '3d' as const }, // Mip level sizes: 32x32x32, 16x16x16, 8x8x8, 4x4x4, 2x2x2, 1x1x1
    { size: [32, 31, 31], dimension: '3d' as const }, // Mip level sizes: 32x31x31, 16x15x15, 8x7x7, 4x3x3, 2x1x1, 1x1x1
    { size: [31, 32, 31], dimension: '3d' as const }, // Mip level sizes: 31x32x31, 15x16x15, 7x8x7, 3x4x3, 1x2x1, 1x1x1
    { size: [31, 31, 32], dimension: '3d' as const }, // Mip level sizes: 31x31x32, 15x15x16, 7x7x8, 3x3x4, 1x1x2, 1x1x1
    { size: [31, 31, 31], dimension: '3d' as const }, // Mip level sizes: 31x31x31, 15x15x15, 7x7x7, 3x3x3, 1x1x1
    { size: [32, 8] }, // Mip levels: 32x8, 16x4, 8x2, 4x1, 2x1, 1x1
    { size: [32, 32, 64] }, // Mip levels: 32x32x64, 16x16x64, 8x8x64, 4x4x64, 2x2x64, 1x1x64
    { size: [32, 32, 64], dimension: '3d' as const }, // Mip levels: 32x32x64, 16x16x32, 8x8x16, 4x4x8, 2x2x4, 1x1x2, 1x1x1
  ])
  .fn(async t => {
    const { size, dimension } = t.params;

    const descriptor: GPUTextureDescriptor = {
      size,
      dimension,
      format: 'rgba8unorm' as const,
      usage: GPUTextureUsage.SAMPLED,
    };

    const mipLevelCount = maxMipLevelCount(descriptor);
    descriptor.mipLevelCount = mipLevelCount;
    t.device.createTexture(descriptor);

    descriptor.mipLevelCount = mipLevelCount + 1;
    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    });
  });

g.test('mipLevelCount,bound_check,bigger_than_integer_bit_width')
  .desc(`Test mip level count bound check when mipLevelCount is bigger than integer bit width`)
  .fn(async t => {
    const descriptor = {
      size: [32, 32],
      mipLevelCount: 100,
      format: 'rgba8unorm' as const,
      usage: GPUTextureUsage.SAMPLED,
    };

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    });
  });

g.test('sampleCount')
  .params([
    { sampleCount: 0, _success: false },
    { sampleCount: 1, _success: true },
    { sampleCount: 2, _success: false },
    { sampleCount: 3, _success: false },
    { sampleCount: 4, _success: true },
    { sampleCount: 8, _success: false },
    { sampleCount: 16, _success: false },
    { sampleCount: 4, mipLevelCount: 2, _success: false },
    { sampleCount: 4, arrayLayerCount: 2, _success: false },
  ])
  .fn(async t => {
    const { sampleCount, mipLevelCount, arrayLayerCount, _success } = t.params;

    const descriptor = t.getDescriptor({ sampleCount, mipLevelCount, arrayLayerCount });

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !_success);
  });

g.test('texture_size,1d_texture')
  .desc(`Test texture size requirement for 1D texture`)
  .subcases(() =>
    params()
      .combine(poptions('format', kAllTextureFormats))
      .combine(
        poptions('width', [
          DefaultLimits.maxTextureDimension1D - 1,
          DefaultLimits.maxTextureDimension1D,
          DefaultLimits.maxTextureDimension1D + 1,
        ])
      )
      .combine(poptions('height', [1, 2]))
      .combine(poptions('depthOrArrayLayers', [1, 2]))
  )
  .fn(async t => {
    const { format, width, height, depthOrArrayLayers } = t.params;

    await t.selectDeviceOrSkipTestCase(kAllTextureFormatInfo[format].extension);

    const descriptor: GPUTextureDescriptor = {
      size: [width, height, depthOrArrayLayers],
      dimension: '1d' as const,
      format,
      usage: GPUTextureUsage.SAMPLED,
    };

    const success =
      width <= DefaultLimits.maxTextureDimension1D && height === 1 && depthOrArrayLayers === 1;

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !success);
  });

g.test('texture_size,2d_texture')
  .desc(
    `Test texture size requirement for 2D texture.
	TODO: add tests for compressed texture.`
  )
  .subcases(() =>
    params()
      .combine(poptions('format', kUncompressedTextureFormats))
      .combine(poptions('dimension', [undefined, '2d'] as const))
      .combine([
        // Test the bound of width
        { size: [DefaultLimits.maxTextureDimension2D - 1, 1, 1] },
        { size: [DefaultLimits.maxTextureDimension2D, 1, 1] },
        { size: [DefaultLimits.maxTextureDimension2D + 1, 1, 1] },
        // Test the bound of height
        { size: [1, DefaultLimits.maxTextureDimension2D - 1, 1] },
        { size: [1, DefaultLimits.maxTextureDimension2D, 1] },
        { size: [1, DefaultLimits.maxTextureDimension2D + 1, 1] },
        // Test the bound of array layers
        { size: [1, 1, DefaultLimits.maxTextureArrayLayers - 1] },
        { size: [1, 1, DefaultLimits.maxTextureArrayLayers] },
        { size: [1, 1, DefaultLimits.maxTextureArrayLayers + 1] },
      ])
  )
  .fn(async t => {
    const { format, dimension, size } = t.params;

    await t.selectDeviceOrSkipTestCase(kUncompressedTextureFormatInfo[format].extension);

    const descriptor: GPUTextureDescriptor = {
      size,
      dimension,
      format,
      usage: GPUTextureUsage.SAMPLED,
    };

    const success =
      size[0] <= DefaultLimits.maxTextureDimension2D &&
      size[1] <= DefaultLimits.maxTextureDimension2D &&
      size[2] <= DefaultLimits.maxTextureArrayLayers;

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !success);
  });

g.test('texture_size,3d_texture')
  .desc(
    `Test texture size requirement for 3D texture.
	TODO: add tests for compressed texture.`
  )
  .subcases(() =>
    params()
      .combine(poptions('format', kUncompressedTextureFormats))
      .combine([
        // Test the bound of width
        { size: [DefaultLimits.maxTextureDimension3D - 1, 1, 1] },
        { size: [DefaultLimits.maxTextureDimension3D, 1, 1] },
        { size: [DefaultLimits.maxTextureDimension3D + 1, 1, 1] },
        // Test the bound of height
        { size: [1, DefaultLimits.maxTextureDimension3D - 1, 1] },
        { size: [1, DefaultLimits.maxTextureDimension3D, 1] },
        { size: [1, DefaultLimits.maxTextureDimension3D + 1, 1] },
        // Test the bound of depth
        { size: [1, 1, DefaultLimits.maxTextureDimension3D - 1] },
        { size: [1, 1, DefaultLimits.maxTextureDimension3D] },
        { size: [1, 1, DefaultLimits.maxTextureDimension3D + 1] },
      ])
  )
  .fn(async t => {
    const { format, size } = t.params;

    await t.selectDeviceOrSkipTestCase(kUncompressedTextureFormatInfo[format].extension);

    const descriptor: GPUTextureDescriptor = {
      size,
      dimension: '3d' as const,
      format,
      usage: GPUTextureUsage.SAMPLED,
    };

    const success =
      size[0] <= DefaultLimits.maxTextureDimension3D &&
      size[1] <= DefaultLimits.maxTextureDimension3D &&
      size[2] <= DefaultLimits.maxTextureDimension3D;

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !success);
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

    await t.selectDeviceOrSkipTestCase(info.extension);

    const descriptor = t.getDescriptor({ width: 1, height: 1, format });

    t.expectValidationError(() => {
      t.device.createTexture(descriptor);
    }, !info.renderable);
  });

// TODO: Add tests for compressed texture formats
