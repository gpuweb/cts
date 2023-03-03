/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { kMaximumLimitBaseParams, makeLimitTestGroup } from './limit_utils.js';const limit = 'maxComputeWorkgroupSizeZ';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createComputePipeline,at_over').
desc(`Test using createComputePipeline at and over ${limit} limit`).
params(kMaximumLimitBaseParams).
fn(async (t) => {
  const { limitTest, testValueName } = t.params;
  await t.testDeviceWithRequestedMaximumLimits(
  limitTest,
  testValueName,
  async ({ device, testValue, actualLimit, shouldError }) => {
    const module = t.getModuleForWorkgroupSize([1, 1, testValue]);

    await t.testForValidationErrorWithPossibleOutOfMemoryError(
    () => {
      device.createComputePipeline({
        layout: 'auto',
        compute: {
          module,
          entryPoint: 'main'
        }
      });
    },
    shouldError,
    `size: ${testValue}, limit: ${actualLimit}`);

  });

});

g.test('createComputePipelineAsync,at_over').
desc(`Test using createComputePipeline at and over ${limit} limit`).
params(kMaximumLimitBaseParams).
fn(async (t) => {
  const { limitTest, testValueName } = t.params;
  await t.testDeviceWithRequestedMaximumLimits(
  limitTest,
  testValueName,
  async ({ device, testValue, shouldError }) => {
    const module = t.getModuleForWorkgroupSize([1, 1, testValue]);

    const promise = device.createComputePipelineAsync({
      layout: 'auto',
      compute: {
        module,
        entryPoint: 'main'
      }
    });
    await t.shouldRejectConditionally('OperationError', promise, shouldError);
  });

});
//# sourceMappingURL=maxComputeWorkgroupSizeZ.spec.js.map