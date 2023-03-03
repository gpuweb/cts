import { kMaximumLimitBaseParams, makeLimitTestGroup } from './limit_utils.js';

function getPipelineDescriptor(device: GPUDevice, testValue: number): GPURenderPipelineDescriptor {
  const code = `
    struct VSOut {
      @builtin(position) p: vec4f,
      @location(${testValue}) v: f32,
    }
    @vertex fn vs() -> VSOut {
      var o: VSOut;
      o.p = vec4f(0);
      o.v = 1.0;
      return o;
    }
  `;
  const module = device.createShaderModule({ code });
  return {
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
    },
  };
}

const limit = 'maxInterStageShaderVariables';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createRenderPipeline,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipeline`)
  .params(kMaximumLimitBaseParams)
  .fn(async t => {
    const { limitTest, testValueName } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const lastIndex = testValue - 1;
        const pipelineDescriptor = getPipelineDescriptor(device, lastIndex);

        await t.expectValidationError(() => {
          device.createRenderPipeline(pipelineDescriptor);
        }, shouldError);
      }
    );
  });

g.test('createRenderPipelineAsync,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipelineAsync`)
  .params(kMaximumLimitBaseParams)
  .fn(async t => {
    const { limitTest, testValueName } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const lastIndex = testValue - 1;
        const pipelineDescriptor = getPipelineDescriptor(device, lastIndex);
        await t.shouldRejectConditionally(
          'GPUPipelineError',
          device.createRenderPipelineAsync(pipelineDescriptor),
          shouldError
        );
      }
    );
  });
