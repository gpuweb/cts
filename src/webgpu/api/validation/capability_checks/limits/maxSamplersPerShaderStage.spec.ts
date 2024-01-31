import {
  range,
  reorder,
  kReorderOrderKeys,
  ReorderOrder,
  assert,
} from '../../../../../common/util/util.js';
import { kShaderStageCombinationsWithStage } from '../../../../capability_info.js';

import {
  kMaximumLimitBaseParams,
  makeLimitTestGroup,
  kBindGroupTests,
  kBindingCombinations,
  getPipelineTypeForBindingCombination,
  getPerStageWGSLForBindingCombination,
  LimitsRequest,
} from './limit_utils.js';

const kExtraLimits: LimitsRequest = {
  maxBindingsPerBindGroup: 'adapterLimit',
  maxBindGroups: 'adapterLimit',
};

const limit = 'maxSamplersPerShaderStage';
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
        sampler: {},
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
      .combine('visibility', kShaderStageCombinationsWithStage)
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        t.skipIf(
          t.adapter.limits.maxBindingsPerBindGroup < testValue,
          `maxBindingsPerBindGroup = ${t.adapter.limits.maxBindingsPerBindGroup} which is less than ${testValue}`
        );

        await t.expectValidationError(
          () => createBindGroupLayout(device, visibility, order, testValue),
          shouldError
        );
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
      .combine('order', kReorderOrderKeys)
  )
  .fn(async t => {
    const { limitTest, testValueName, visibility, order } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError, actualLimit }) => {
        const maxBindingsPerBindGroup = Math.min(
          t.device.limits.maxBindingsPerBindGroup,
          actualLimit
        );
        const kNumGroups = Math.ceil(testValue / maxBindingsPerBindGroup);

        // Not sure what to do in this case but best we get notified if it happens.
        assert(kNumGroups < t.device.limits.maxBindGroups);

        const bindGroupLayouts = range(kNumGroups, i => {
          const numInGroup = Math.min(
            testValue - i * maxBindingsPerBindGroup,
            maxBindingsPerBindGroup
          );
          return createBindGroupLayout(device, visibility, order, numInGroup);
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

        // If this was false the texture binding would overlap the sampler bindings.
        assert(testValue < device.limits.maxBindGroups * device.limits.maxBindingsPerBindGroup);

        // Put the texture on the last possible binding.
        const groupNdx = device.limits.maxBindGroups - 1;
        const bindingNdx = device.limits.maxBindingsPerBindGroup - 1;

        const code = getPerStageWGSLForBindingCombination(
          bindingCombination,
          order,
          bindGroupTest,
          (i, j) => `var u${j}_${i}: sampler`,
          (i, j) => `_ = textureGather(0, tex, u${j}_${i}, vec2f(0));`,
          device.limits.maxBindGroups,
          testValue,
          `@group(${groupNdx}) @binding(${bindingNdx}) var tex: texture_2d<f32>;`
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
