import { assert } from '../../../../../common/util/util.js';

import {
  getRenderPipelineBindingLayoutEntries,
  getTotalPossibleBindingsPerRenderPipeline,
  kCreatePipelineTypes,
  kEncoderTypes,
  kMaximumLimitBaseParams,
  makeLimitTestGroup,
} from './limit_utils.js';

const limit = 'maxBindGroups';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createPipelineLayout,at_over')
  .desc(`Test using createPipelineLayout at and over ${limit} limit`)
  .params(kMaximumLimitBaseParams)
  .fn(async t => {
    const { limitTest, testValueName } = t.params;

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError, actualLimit }) => {
        const totalPossibleBindingsPerPipeline = getTotalPossibleBindingsPerRenderPipeline(device);
        // Not sure what to do if we ever hit this but I think it's better to assert than silently skip.
        assert(
          testValue < totalPossibleBindingsPerPipeline,
          `not enough possible bindings(${totalPossibleBindingsPerPipeline}) to test ${testValue} bindGroups`
        );

        const bindingDescriptions: string[] = [];
        const bindGroupLayouts = [...getRenderPipelineBindingLayoutEntries(device, testValue)].map(
          entry => {
            bindingDescriptions.push(
              `${JSON.stringify(entry)} // group(${bindingDescriptions.length})`
            );
            return device.createBindGroupLayout({
              entries: [entry],
            });
          }
        );

        await t.expectValidationError(
          () => {
            device.createPipelineLayout({ bindGroupLayouts });
          },
          shouldError,
          `testing ${testValue} bindGroups on maxBindGroups = ${actualLimit} with \n${bindingDescriptions.join(
            '\n'
          )}`
        );
      }
    );
  });

g.test('createPipeline,at_over')
  .desc(
    `Test using createRenderPipeline(Async) and createComputePipeline(Async) at and over ${limit} limit`
  )
  .params(
    kMaximumLimitBaseParams
      .combine('createPipelineType', kCreatePipelineTypes)
      .combine('async', [false, true] as const)
  )
  .fn(async t => {
    const { limitTest, testValueName, createPipelineType, async } = t.params;

    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const lastIndex = testValue - 1;

        const code = t.getGroupIndexWGSLForPipelineType(createPipelineType, lastIndex);
        const module = device.createShaderModule({ code });

        await t.testCreatePipeline(createPipelineType, async, module, shouldError);
      }
    );
  });

g.test('setBindGroup,at_over')
  .desc(`Test using setBindGroup at and over ${limit} limit`)
  .params(kMaximumLimitBaseParams.combine('encoderType', kEncoderTypes))
  .fn(async t => {
    const { limitTest, testValueName, encoderType } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ testValue, actualLimit, shouldError }) => {
        const lastIndex = testValue - 1;
        await t.testGPUBindingCommandsMixin(
          encoderType,
          ({ mixin, bindGroup }) => {
            mixin.setBindGroup(lastIndex, bindGroup);
          },
          shouldError,
          `shouldError: ${shouldError}, actualLimit: ${actualLimit}, testValue: ${lastIndex}`
        );
      }
    );
  });

g.test('validate,maxBindGroupsPlusVertexBuffers')
  .desc(`Test that ${limit} <= maxBindGroupsPlusVertexBuffers`)
  .fn(t => {
    const { adapter, defaultLimit, adapterLimit } = t;
    t.expect(defaultLimit <= t.getDefaultLimit('maxBindGroupsPlusVertexBuffers'));
    t.expect(adapterLimit <= adapter.limits.maxBindGroupsPlusVertexBuffers);
  });
