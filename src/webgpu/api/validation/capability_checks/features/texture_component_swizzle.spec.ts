export const description = `
Validation tests for the 'texture-component-swizzle' feature.

Test that:
* when the feature is off, swizzling is not allowed, even the identity swizzle.
* swizzling is not allowed on textures with usage STORAGE_BINDING nor RENDER_ATTACHMENT
  except the identity swizzle.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUConst } from '../../../../constants.js';
import { UniqueFeaturesOrLimitsGPUTest } from '../../../../gpu_test.js';

import {
  isIdentitySwizzle,
  kSwizzleTests,
  swizzleSpecToGPUTextureComponentSwizzle,
} from './texture_component_swizzle_utils.js';

export const g = makeTestGroup(UniqueFeaturesOrLimitsGPUTest);

g.test('no_default_swizzle')
  .desc(
    `
  Test that if texture-component-swizzle is not enabled, having a non-default swizzle property generates a validation error.
  `
  )
  .params(u =>
    u
      .beginSubcases()
      .combine('swizzleSpec', kSwizzleTests)
  )
  .fn(t => {
    const { swizzleSpec } = t.params;
    const swizzle = swizzleSpecToGPUTextureComponentSwizzle(swizzleSpec);
    const texture = t.createTextureTracked({
      format: 'rgba8unorm',
      size: [1],
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    const shouldError = !isIdentitySwizzle(swizzle);
    t.expectValidationError(() => {
      texture.createView({ swizzle });
    }, shouldError);
  });

g.test('no_render_nor_storage')
  .desc(
    `
  Test that setting the swizzle on the texture with RENDER_ATTACHMENT or STORAGE_BINDING usage works
  if the swizzle is the identity but generates a validation error otherwise.
  `
  )
  .params(u =>
    u
      .combine('usage', [
        GPUConst.TextureUsage.COPY_SRC,
        GPUConst.TextureUsage.COPY_DST,
        GPUConst.TextureUsage.TEXTURE_BINDING,
        GPUConst.TextureUsage.RENDER_ATTACHMENT,
        GPUConst.TextureUsage.STORAGE_BINDING,
      ] as const)
      .beginSubcases()
      .combine('swizzleSpec', kSwizzleTests)
  )
  .beforeAllSubcases(t => {
    // MAINTENANCE_TODO: Remove this cast once texture-component-swizzle is added to @webgpu/types
    t.selectDeviceOrSkipTestCase('texture-component-swizzle' as GPUFeatureName);
  })
  .fn(t => {
    const { swizzleSpec, usage } = t.params;
    const swizzle = swizzleSpecToGPUTextureComponentSwizzle(swizzleSpec);
    const texture = t.createTextureTracked({
      format: 'rgba8unorm',
      size: [1],
      usage,
    });
    const badUsage =
      (usage &
        (GPUConst.TextureUsage.RENDER_ATTACHMENT | GPUConst.TextureUsage.STORAGE_BINDING)) !==
      0;
    const shouldError = badUsage && !isIdentitySwizzle(swizzle);
    t.expectValidationError(() => {
      texture.createView({ swizzle });
    }, shouldError);
  });
