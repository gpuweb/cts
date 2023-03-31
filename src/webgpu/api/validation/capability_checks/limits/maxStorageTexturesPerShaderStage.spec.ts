import {
  range,
  reorder,
  ReorderOrder,
  kReorderOrderKeys,
} from '../../../../../common/util/util.js';
import { GPUConst } from '../../../../constants.js';

import {
  kMaximumLimitBaseParams,
  makeLimitTestGroup,
  kBindGroupTests,
  LimitsRequest,
  getPerStageWGSLForBindingCombinationStorageTextures,
  BindingCombination,
} from './limit_utils.js';

const kExtraLimits: LimitsRequest = {
  maxFragmentCombinedOutputResources: 'adapterLimit',
};

const limit = 'maxStorageTexturesPerShaderStage';
export const { g, description } = makeLimitTestGroup(limit);

function createBindGroupLayout(
  device: GPUDevice,
  visibility: number,
  order: ReorderOrder,
  numBindings: number
) {
  return device.createBindGroupLayout({
    entries: reorder(
      order,
      range(numBindings, i => ({
        binding: i,
        visibility,
        storageTexture: { format: 'rgba8unorm' },
      }))
    ),
  });
}

g.test('createBindGroupLayout,at_over')
  .desc(
    `
  Test using at and over ${limit} limit in createBindGroupLayout
  
  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  `
  )
  .params(
    kMaximumLimitBaseParams
      .combine('visibility', [
        GPUConst.ShaderStage.FRAGMENT,
        GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
      ])
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        await t.expectValidationError(
          () => createBindGroupLayout(device, visibility, order, testValue),
          shouldError
        );
      }
    );
  });

g.test('createPipelineLayout,at_over')
  .desc(
    `
  Test using at and over ${limit} limit in createPipelineLayout
  
  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  `
  )
  .params(
    kMaximumLimitBaseParams
      .combine('visibility', [
        GPUConst.ShaderStage.FRAGMENT,
        GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
      ])
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const kNumGroups = 3;
        const bindGroupLayouts = range(kNumGroups, i => {
          const minInGroup = Math.floor(testValue / kNumGroups);
          const numInGroup = i ? minInGroup : testValue - minInGroup * (kNumGroups - 1);
          return createBindGroupLayout(device, visibility, order, numInGroup);
        });
        await t.expectValidationError(
          () => device.createPipelineLayout({ bindGroupLayouts }),
          shouldError
        );
      }
    );
  });

g.test('createPipeline,at_over')
  .desc(
    `
  Test using createRenderPipeline(Async) and createComputePipeline(Async) at and over ${limit} limit
  
  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  And the combination of storage buffers, storage textures and color attachments in
  GPURenderPipelineDescriptor has been tested in maxFragmentCombinedOutputResources.spec.ts,
  we just test single resource for ${limit} limit, so we need to trun on depth stencil
  because empty attachments are not allowed.
  `
  )
  .params(
    kMaximumLimitBaseParams
      .combine('async', [false, true] as const)
      .combine('bindingCombination', ['fragment', 'compute'] as BindingCombination[])
      .combine('order', kReorderOrderKeys)
      .combine('bindGroupTest', kBindGroupTests)
  )
  .fn(async t => {
    const { limitTest, testValueName, async, bindingCombination, order, bindGroupTest } = t.params;

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        if (
          bindingCombination === 'fragment' &&
          testValue > device.limits.maxFragmentCombinedOutputResources
        ) {
          return;
        }

        const code = getPerStageWGSLForBindingCombinationStorageTextures(
          bindingCombination,
          order,
          bindGroupTest,
          (i, j) => `var u${j}_${i}: texture_storage_2d<rgba8unorm, write>`,
          (i, j) => `textureStore(u${j}_${i}, vec2u(0), vec4f(1));`,
          testValue
        );
        const module = device.createShaderModule({ code });
        const msg = `actualLimit: ${actualLimit}, testValue: ${testValue}\n:${code}`;

        if (bindingCombination === 'compute') {
          const pipelineDescriptor: GPUComputePipelineDescriptor = {
            layout: 'auto',
            compute: {
              module,
              entryPoint: 'main',
            },
          };
          await t.testCreateComputePipeline(pipelineDescriptor, async, shouldError, msg);
        } else {
          const pipelineDescriptor: GPURenderPipelineDescriptor = {
            layout: 'auto',
            vertex: {
              module,
              entryPoint: 'mainVS',
            },
            fragment: {
              module,
              entryPoint: 'mainFS',
              targets: [],
            },
            depthStencil: {
              format: 'depth24plus-stencil8',
              depthWriteEnabled: true,
              depthCompare: 'always',
            },
          };
          await t.testCreateRenderPipeline(pipelineDescriptor, async, shouldError, msg);
        }
      },
      kExtraLimits
    );
  });
