import { range } from '../../../../../common/util/util.js';

import { kLimitBaseParams, getDefaultLimit, makeLimitTestGroup } from './limit_utils.js';

function getPipelineDescriptor(device: GPUDevice, testValue: number): GPURenderPipelineDescriptor {
  const code = `
    @vertex fn vs() -> @builtin(position) vec4f {
      return vec4f(0);
    }

    @fragment fn fs() -> @location(0) vec4f {
      return vec4f(0);
    }
  `;
  const module = device.createShaderModule({ code });
  return {
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets: new Array(testValue).fill({ format: 'r8unorm', writeMask: 0 }),
    },
  };
}

const limit = 'maxColorAttachments';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createRenderPipeline,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipeline`)
  .params(kLimitBaseParams)
  .fn(async t => {
    const { limitTest, testValueName } = t.params;
    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const pipelineDescriptor = getPipelineDescriptor(device, testValue);

        await t.expectValidationError(() => {
          device.createRenderPipeline(pipelineDescriptor);
        }, shouldError);
      }
    );
  });

g.test('createRenderPipelineAsync,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipelineAsync`)
  .params(kLimitBaseParams)
  .fn(async t => {
    const { limitTest, testValueName } = t.params;
    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const pipelineDescriptor = getPipelineDescriptor(device, testValue);
        await t.shouldRejectConditionally(
          'GPUPipelineError',
          device.createRenderPipelineAsync(pipelineDescriptor),
          shouldError
        );
      }
    );
  });

g.test('beginRenderPass,at_over')
  .desc(`Test using at and over ${limit} limit in beginRenderPass`)
  .params(kLimitBaseParams)
  .fn(async t => {
    const { limitTest, testValueName } = t.params;
    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const encoder = device.createCommandEncoder();

        const textures = range(testValue, _ =>
          t.trackForCleanup(
            device.createTexture({
              size: [1, 1],
              format: 'r8unorm',
              usage: GPUTextureUsage.RENDER_ATTACHMENT,
            })
          )
        );

        const pass = encoder.beginRenderPass({
          colorAttachments: range(testValue, i => ({
            view: textures[i].createView(),
            loadOp: 'clear',
            storeOp: 'store',
          })),
        });
        pass.end();

        await t.expectValidationError(() => {
          encoder.finish();
        }, shouldError);
      }
    );
  });

g.test('createRenderBundle,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderBundle`)
  .params(kLimitBaseParams)
  .fn(async t => {
    const { limitTest, testValueName } = t.params;
    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        await t.expectValidationError(() => {
          device.createRenderBundleEncoder({
            colorFormats: new Array(testValue).fill('r8unorm'),
          });
        }, shouldError);
      }
    );
  });

g.test('validate')
  .desc(`Test ${limit} against maxColorAttachmentBytesPerSample`)
  .fn(t => {
    const { adapter, defaultLimit, maximumLimit } = t;
    const minColorAttachmentBytesPerSample = getDefaultLimit('maxColorAttachmentBytesPerSample');
    // The smallest attachment is 1 byte
    // so make sure maxColorAttachments < maxColorAttachmentBytesPerSample
    t.expect(defaultLimit <= minColorAttachmentBytesPerSample);
    t.expect(maximumLimit <= adapter.limits.maxColorAttachmentBytesPerSample);
  });
