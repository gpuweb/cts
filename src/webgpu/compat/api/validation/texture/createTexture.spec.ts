export const description = `
Tests that you can not use bgra8unorm-srgb in compat mode.
Tests that textureBindingViewDimension must compatible with texture dimension
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { kTextureDimensions, kTextureViewDimensions } from '../../../../capability_info.js';
import { getTextureDimensionFromView } from '../../../../util/texture/base.js';
import { CompatibilityTest } from '../../../compatibility_test.js';

export const g = makeTestGroup(CompatibilityTest);

g.test('unsupportedTextureFormats')
  .desc(`Tests that you can not create a bgra8unorm-srgb texture in compat mode.`)
  .fn(t => {
    t.expectGPUError(
      'validation',
      () =>
        t.device.createTexture({
          size: [1, 1, 1],
          format: 'bgra8unorm-srgb',
          usage: GPUTextureUsage.TEXTURE_BINDING,
        }),
      true
    );
  });

g.test('unsupportedTextureViewFormats')
  .desc(
    `Tests that you can not create a bgra8unorm texture with a bgra8unorm-srgb viewFormat in compat mode.`
  )
  .fn(t => {
    t.expectGPUError(
      'validation',
      () =>
        t.device.createTexture({
          size: [1, 1, 1],
          format: 'bgra8unorm',
          viewFormats: ['bgra8unorm-srgb'],
          usage: GPUTextureUsage.TEXTURE_BINDING,
        }),
      true
    );
  });

g.test('invalidTextureBindingViewDimension')
  .desc(
    `Tests that you can not specify a textureBindingViewDimension that is incompatible with the texture's dimension.`
  )
  .params(u =>
    u //
      .combine('dimension', kTextureDimensions)
      .combine('textureBindingViewDimension', kTextureViewDimensions)
  )
  .fn(t => {
    const { dimension, textureBindingViewDimension } = t.params;
    const shouldError = getTextureDimensionFromView(textureBindingViewDimension) !== dimension;
    t.expectGPUError(
      'validation',
      () => {
        const texture = t.device.createTexture({
          size: [1, 1, dimension === '1d' ? 1 : 6],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING,
          dimension,
          textureBindingViewDimension,
        } as GPUTextureDescriptor); // MAINTENANCE_TODO: remove cast once textureBindingViewDimension is added to IDL
        t.trackForCleanup(texture);
      },
      shouldError
    );
  });
