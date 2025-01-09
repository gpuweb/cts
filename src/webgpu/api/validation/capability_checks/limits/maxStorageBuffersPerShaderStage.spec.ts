import {
  range,
  reorder,
  kReorderOrderKeys,
  ReorderOrder,
  assert,
} from '../../../../../common/util/util.js';
import { kShaderStageCombinationsWithStage } from '../../../../capability_info.js';
import { GPUConst } from '../../../../constants.js';

import {
  kMaximumLimitBaseParams,
  makeLimitTestGroup,
  kBindGroupTests,
  kBindingCombinations,
  getPipelineTypeForBindingCombination,
  getPerStageWGSLForBindingCombination,
  LimitsRequest,
  getStageVisibilityForBinidngCombination,
} from './limit_utils.js';

const kExtraLimits: LimitsRequest = {
  maxBindingsPerBindGroup: 'adapterLimit',
  maxBindGroups: 'adapterLimit',
  maxStorageBuffersInFragmentStage: 'adapterLimit',
  maxStorageBuffersInVertexStage: 'adapterLimit',
};

const limit = 'maxStorageBuffersPerShaderStage';
export const { g, description } = makeLimitTestGroup(limit);

function createBindGroupLayout(
  device: GPUDevice,
  visibility: number,
  type: GPUBufferBindingType,
  order: ReorderOrder,
  numBindings: number
) {
  const bindGroupLayoutDescription = {
    entries: reorder(
      order,
      range(numBindings, i => ({
        binding: i,
        visibility,
        buffer: { type },
      }))
    ),
  };
  return device.createBindGroupLayout(bindGroupLayoutDescription);
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
      .combine('visibility', kShaderStageCombinationsWithStage)
      .combine('type', ['storage', 'read-only-storage'] as GPUBufferBindingType[])
      .combine('order', kReorderOrderKeys)
      .filter(
        ({ visibility, type }) =>
          (visibility & GPUConst.ShaderStage.VERTEX) === 0 || type !== 'storage'
      )
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order, type } = t.params;

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        t.skipIf(
          t.adapter.limits.maxBindingsPerBindGroup < testValue,
          `maxBindingsPerBindGroup = ${t.adapter.limits.maxBindingsPerBindGroup} which is less than ${testValue}`
        );

        t.skipIfNotEnoughStorageBuffersInStage(visibility, testValue);

        await t.expectValidationError(() => {
          createBindGroupLayout(device, visibility, type, order, testValue);
        }, shouldError);
      },
      kExtraLimits
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
      .combine('visibility', kShaderStageCombinationsWithStage)
      .combine('type', ['storage', 'read-only-storage'] as GPUBufferBindingType[])
      .combine('order', kReorderOrderKeys)
      .filter(
        ({ visibility, type }) =>
          (visibility & GPUConst.ShaderStage.VERTEX) === 0 || type !== 'storage'
      )
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order, type } = t.params;

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError, actualLimit }) => {
        t.skipIfNotEnoughStorageBuffersInStage(visibility, testValue);

        const maxBindingsPerBindGroup = Math.min(
          t.device.limits.maxBindingsPerBindGroup,
          actualLimit
        );

        const kNumGroups = Math.ceil(testValue / maxBindingsPerBindGroup);

        // Not sure what to do in this case but best we get notified if it happens.
        assert(kNumGroups <= t.device.limits.maxBindGroups);

        const bindGroupLayouts = range(kNumGroups, i => {
          const numInGroup = Math.min(
            testValue - i * maxBindingsPerBindGroup,
            maxBindingsPerBindGroup
          );
          return createBindGroupLayout(device, visibility, type, order, numInGroup);
        });

        await t.expectValidationError(
          () => device.createPipelineLayout({ bindGroupLayouts }),
          shouldError
        );
      },
      kExtraLimits
    );
  });

g.test('createPipeline,at_over')
  .desc(
    `
  Test using createRenderPipeline(Async) and createComputePipeline(Async) at and over ${limit} limit

  Note: We also test order to make sure the implementation isn't just looking
  at just the last entry.
  `
  )
  .params(
    kMaximumLimitBaseParams
      .combine('async', [false, true] as const)
      .combine('bindingCombination', kBindingCombinations)
      .beginSubcases()
      .combine('order', kReorderOrderKeys)
      .combine('bindGroupTest', kBindGroupTests)
  )
  .fn(async t => {
    const { limitTest, testValueName, async, bindingCombination, order, bindGroupTest } = t.params;
    const pipelineType = getPipelineTypeForBindingCombination(bindingCombination);

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        t.skipIf(
          bindGroupTest === 'sameGroup' && testValue > device.limits.maxBindingsPerBindGroup,
          `can not test ${testValue} bindings in same group because maxBindingsPerBindGroup = ${device.limits.maxBindingsPerBindGroup}`
        );

        const visibility = getStageVisibilityForBinidngCombination(bindingCombination);
        t.skipIfNotEnoughStorageBuffersInStage(visibility, testValue);

        const code = getPerStageWGSLForBindingCombination(
          bindingCombination,
          order,
          bindGroupTest,
          (i, j) => `var<storage> u${j}_${i}: f32`,
          (i, j) => `_ = u${j}_${i};`,
          device.limits.maxBindGroups,
          testValue
        );
        const module = device.createShaderModule({ code });

        await t.testCreatePipeline(
          pipelineType,
          async,
          module,
          shouldError,
          `actualLimit: ${actualLimit}, testValue: ${testValue}\n:${code}`
        );
      },
      kExtraLimits
    );
  });
