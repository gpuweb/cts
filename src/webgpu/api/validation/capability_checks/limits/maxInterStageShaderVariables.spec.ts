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
    depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'always' },
  };
}

const limit = 'maxInterStageShaderVariables';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createRenderPipeline,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipeline(Async)`)
  .params(kMaximumLimitBaseParams.combine('async', [false, true]))
  .fn(async t => {
    const { limitTest, testValueName, async } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const lastIndex = testValue - 1;
        const pipelineDescriptor = getPipelineDescriptor(device, lastIndex);

        await t.testCreateRenderPipeline(pipelineDescriptor, async, shouldError);
      }
    );
  });
