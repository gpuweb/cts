import {
  range,
  reorder,
  ReorderOrder,
  kReorderOrderKeys,
} from '../../../../../common/util/util.js';
import { GPUConst } from '../../../../constants.js';

import {
  kLimitBaseParams,
  makeLimitTestGroup,
  kBindGroupTests,
  getPipelineTypeForBindingCombination,
  getPipelineAsyncTypeForBindingCombination,
  getPerStageWGSLForBindingCombinationStorageTextures,
  BindingCombination,
} from './limit_utils.js';

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
    kLimitBaseParams
      .combine('visibility', [
        GPUConst.ShaderStage.FRAGMENT,
        GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
      ])
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order } = t.params;
    await t.testDeviceWithRequestedLimits(
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
    kLimitBaseParams
      .combine('visibility', [
        GPUConst.ShaderStage.FRAGMENT,
        GPUConst.ShaderStage.COMPUTE,
        GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
      ])
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order } = t.params;
    await t.testDeviceWithRequestedLimits(
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
  Test using createRenderPipeline and createComputePipeline at and over ${limit} limit
  
  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  `
  )
  .params(
    kLimitBaseParams
      .combine('bindingCombination', ['fragment', 'compute'] as BindingCombination[])
      .combine('order', kReorderOrderKeys)
      .combine('bindGroupTest', kBindGroupTests)
  )
  .fn(async t => {
    const { limitTest, testValueName, bindingCombination, order, bindGroupTest } = t.params;
    const pipelineType = getPipelineTypeForBindingCombination(bindingCombination);

    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const code = getPerStageWGSLForBindingCombinationStorageTextures(
          bindingCombination,
          order,
          bindGroupTest,
          (i, j) => `var u${j}_${i}: texture_storage_2d<rgba8unorm, write>`,
          (i, j) => `textureStore(u${j}_${i}, vec2u(0), vec4f(1));`,
          testValue
        );
        const module = device.createShaderModule({ code });

        await t.expectValidationError(
          () => {
            t.createPipeline(pipelineType, module);
          },
          shouldError,
          `actualLimit: ${actualLimit}, testValue: ${testValue}\n:${code}`
        );
      }
    );
  });

g.test('createPipelineAsync,at_over')
  .desc(
    `
  Test using createRenderPipelineAsync and createComputePipelineAsync at and over ${limit} limit
  
  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  `
  )
  .params(
    kLimitBaseParams
      .combine('bindingCombination', ['fragment', 'compute'] as BindingCombination[])
      .combine('order', kReorderOrderKeys)
      .combine('bindGroupTest', kBindGroupTests)
  )
  .fn(async t => {
    const { limitTest, testValueName, bindingCombination, order, bindGroupTest } = t.params;
    const pipelineType = getPipelineAsyncTypeForBindingCombination(bindingCombination);

    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const code = getPerStageWGSLForBindingCombinationStorageTextures(
          bindingCombination,
          order,
          bindGroupTest,
          (i, j) => `var u${j}_${i}: texture_storage_2d<rgba8unorm, write>`,
          (i, j) => `textureStore(u${j}_${i}, vec2u(0), vec4f(1));`,
          testValue
        );
        const module = device.createShaderModule({ code });

        await t.shouldRejectConditionally(
          'GPUPipelineError',
          t.createPipelineAsync(pipelineType, module),
          shouldError,
          `actualLimit: ${actualLimit}, testValue: ${testValue}\n:${code}`
        );
      }
    );
  });
