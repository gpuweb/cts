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
  swizzlesAreTheSame,
  swizzleSpecToGPUTextureComponentSwizzle,
} from './texture_component_swizzle_utils.js';

export const g = makeTestGroup(UniqueFeaturesOrLimitsGPUTest);

g.test('only_identity_swizzle')
  .desc(
    `
  Test that if texture-component-swizzle is not enabled, having a non-default swizzle property generates a validation error.
  `
  )
  .params(u => u.beginSubcases().combine('swizzleSpec', kSwizzleTests))
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

g.test('compatibility_mode')
  .desc(
    `
  Test that in compatibility mode, swizzles must be equivalent.
  `
  )
  .beforeAllSubcases(t => {
    // MAINTENANCE_TODO: Remove this cast once texture-component-swizzle is added to @webgpu/types
    t.selectDeviceOrSkipTestCase('texture-component-swizzle' as GPUFeatureName);
  })
  .params(u =>
    u
      .beginSubcases()
      .combine('swizzleSpec', kSwizzleTests)
      .combine('otherSwizzleSpec', kSwizzleTests)
      .combine('pipelineType', ['render', 'compute'] as const)
  )
  .fn(t => {
    const { swizzleSpec, otherSwizzleSpec, pipelineType } = t.params;
    const swizzle = swizzleSpecToGPUTextureComponentSwizzle(swizzleSpec);
    const otherSwizzle = swizzleSpecToGPUTextureComponentSwizzle(otherSwizzleSpec);

    const module = t.device.createShaderModule({
      code: `
        @group(0) @binding(0) var tex0: texture_2d<f32>;
        @group(1) @binding(0) var tex1: texture_2d<f32>;

        @compute @workgroup_size(1) fn cs() {
          _ = tex0;
          _ = tex1;
        }

        @vertex fn vs() -> @builtin(position) vec4f {
          return vec4f(0);
        }

        @fragment fn fs() -> @location(0) vec4f {
          _ = tex0;
          _ = tex1;
          return vec4f(0);
        }
      `,
    });

    const pipeline =
      pipelineType === 'compute'
        ? t.device.createComputePipeline({
            layout: 'auto',
            compute: { module },
          })
        : t.device.createRenderPipeline({
            layout: 'auto',
            vertex: { module },
            fragment: { module, targets: [{ format: 'rgba8unorm' }] },
          });

    const texture = t.createTextureTracked({
      size: [1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING,
    });

    const bindGroup0 = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView({ swizzle }),
        },
      ],
    });

    const bindGroup1 = t.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView({ swizzle: otherSwizzle }),
        },
      ],
    });

    const encoder = t.device.createCommandEncoder();
    switch (pipelineType) {
      case 'compute': {
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline as GPUComputePipeline);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.dispatchWorkgroups(1);
        pass.end();
        break;
      }
      case 'render': {
        const view = t.createTextureTracked({
          size: [1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        const pass = encoder.beginRenderPass({
          colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }],
        });
        pass.setPipeline(pipeline as GPURenderPipeline);
        pass.setBindGroup(0, bindGroup0);
        pass.setBindGroup(1, bindGroup1);
        pass.draw(3);
        pass.end();
      }
    }

    const shouldError = t.isCompatibility && !swizzlesAreTheSame(swizzle, otherSwizzle);

    t.expectValidationError(() => {
      encoder.finish();
    }, shouldError);
  });
