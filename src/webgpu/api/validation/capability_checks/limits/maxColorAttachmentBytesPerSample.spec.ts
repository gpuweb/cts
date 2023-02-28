import { assert, range } from '../../../../../common/util/util.js';
import { kTextureSampleCounts, kTextureFormatInfo } from '../../../../capability_info.js';
import { align } from '../../../../util/math.js';

import {
  kLimitBaseParams,
  kLimitModes,
  LimitTestsImpl,
  makeLimitTestGroup,
} from './limit_utils.js';

const kFormatsToUseBySize: GPUTextureFormat[] = [
  'rgba32float',
  'rgba16float',
  'rgba8unorm',
  'rg8unorm',
  'r8unorm',
];

const kInterleaveFormats: GPUTextureFormat[] = [
  'rgba16float',
  'rg16float',
  'rgba8unorm',
  'rg8unorm',
  'r8unorm',
];

function getAttachments(interleaveFormat: GPUTextureFormat, testValue: number) {
  let bytesPerSample = 0;
  const targets: GPUColorTargetState[] = [];

  const addTexture = (format: GPUTextureFormat) => {
    const { renderTargetPixelByteCost, renderTargetComponentAlignment } = kTextureFormatInfo[
      format
    ];
    const alignedBytesPerSample = align(bytesPerSample, renderTargetComponentAlignment!);
    const bytesRemaining = testValue - alignedBytesPerSample;
    if (renderTargetPixelByteCost! > bytesRemaining) {
      return false;
    }
    targets.push({ format, writeMask: 0 });
    bytesPerSample = alignedBytesPerSample + renderTargetPixelByteCost!;
    return true;
  };

  while (bytesPerSample < testValue) {
    addTexture(interleaveFormat);
    for (const format of kFormatsToUseBySize) {
      if (addTexture(format)) {
        break;
      }
    }
  }

  assert(bytesPerSample === testValue);
  return targets;
}

function getDescription(
  testValue: number,
  actualLimit: number,
  sampleCount: number,
  targets: GPUColorTargetState[]
) {
  return `
    // testValue  : ${testValue}
    // actualLimit: ${actualLimit}
    // sampleCount: ${sampleCount}
    // targets:
    ${(() => {
      let offset = 0;
      return targets
        .map(({ format }) => {
          const { renderTargetPixelByteCost, renderTargetComponentAlignment } = kTextureFormatInfo[
            format
          ];
          offset = align(offset, renderTargetComponentAlignment!);
          const s = `//   ${format.padEnd(11)} (offset: ${offset
            .toString()
            .padStart(
              2
            )}, align: ${renderTargetComponentAlignment}, size: ${renderTargetPixelByteCost})`;
          offset += renderTargetPixelByteCost!;
          return s;
        })
        .join('\n    ');
    })()}
  `;
}

function getPipelineDescriptor(
  device: GPUDevice,
  actualLimit: number,
  interleaveFormat: GPUTextureFormat,
  sampleCount: number,
  testValue: number
): { pipelineDescriptor: GPURenderPipelineDescriptor; code: string } | undefined {
  const targets = getAttachments(interleaveFormat, testValue);
  if (!targets) {
    return;
  }

  const code = `
    ${getDescription(testValue, actualLimit, sampleCount, targets)}
    @vertex fn vs() -> @builtin(position) vec4f {
      return vec4f(0);
    }

    @fragment fn fs() -> @location(0) vec4f {
      return vec4f(0);
    }
  `;
  const module = device.createShaderModule({ code });
  const pipelineDescriptor: GPURenderPipelineDescriptor = {
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
    },
    fragment: {
      module,
      entryPoint: 'fs',
      targets,
    },
    multisample: {
      count: sampleCount,
    },
  };
  return { pipelineDescriptor, code };
}

function createTextures(t: LimitTestsImpl, targets: GPUColorTargetState[]) {
  return targets.map(({ format }) =>
    t.trackForCleanup(
      t.device.createTexture({
        size: [1, 1],
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
    )
  );
}

const limit = 'maxColorAttachmentBytesPerSample';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createRenderPipeline,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipeline`)
  .params(
    kLimitBaseParams
      .combine('maxColorAttachmentsLimitMode', kLimitModes)
      .combine('sampleCount', kTextureSampleCounts)
      .combine('interleaveFormat', kInterleaveFormats)
  )
  .fn(async t => {
    const {
      limitTest,
      testValueName,
      maxColorAttachmentsLimitMode,
      sampleCount,
      interleaveFormat,
    } = t.params;
    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const result = getPipelineDescriptor(
          device,
          actualLimit,
          interleaveFormat,
          sampleCount,
          testValue
        );
        if (!result) {
          return;
        }
        const { pipelineDescriptor, code } = result;

        await t.expectValidationError(
          () => {
            device.createRenderPipeline(pipelineDescriptor);
          },
          shouldError,
          code
        );
      },
      { maxColorAttachments: maxColorAttachmentsLimitMode }
    );
  });

g.test('createRenderPipelineAsync,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipelineAsync`)
  .params(
    kLimitBaseParams
      .combine('maxColorAttachmentsLimitMode', kLimitModes)
      .combine('sampleCount', kTextureSampleCounts)
      .combine('interleaveFormat', kInterleaveFormats)
  )
  .fn(async t => {
    const {
      limitTest,
      testValueName,
      maxColorAttachmentsLimitMode,
      sampleCount,
      interleaveFormat,
    } = t.params;
    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const result = getPipelineDescriptor(
          device,
          actualLimit,
          interleaveFormat,
          sampleCount,
          testValue
        );
        if (!result) {
          return;
        }
        const { pipelineDescriptor, code } = result;

        await t.shouldRejectConditionally(
          'GPUPipelineError',
          device.createRenderPipelineAsync(pipelineDescriptor),
          shouldError,
          code
        );
      },
      { maxColorAttachments: maxColorAttachmentsLimitMode }
    );
  });

g.test('beginRenderPass,at_over')
  .desc(`Test using at and over ${limit} limit in beginRenderPass`)
  .params(
    kLimitBaseParams
      .combine('maxColorAttachmentsLimitMode', kLimitModes)
      .combine('sampleCount', kTextureSampleCounts)
      .combine('interleaveFormat', kInterleaveFormats)
  )
  .fn(async t => {
    const {
      limitTest,
      testValueName,
      maxColorAttachmentsLimitMode,
      sampleCount,
      interleaveFormat,
    } = t.params;
    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const targets = getAttachments(interleaveFormat, testValue);
        const maxColorAttachments = device.limits.maxColorAttachments;
        if (targets.length > maxColorAttachments) {
          return;
        }

        const encoder = device.createCommandEncoder();
        const textures = createTextures(t, targets);

        const pass = encoder.beginRenderPass({
          colorAttachments: range(testValue, i => ({
            view: textures[i].createView(),
            loadOp: 'clear',
            storeOp: 'store',
          })),
        });
        pass.end();

        await t.expectValidationError(
          () => {
            encoder.finish();
          },
          shouldError,
          getDescription(testValue, actualLimit, sampleCount, targets)
        );
      },
      { maxColorAttachments: maxColorAttachmentsLimitMode }
    );
  });

g.test('createRenderBundle,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderBundle`)
  .params(
    kLimitBaseParams
      .combine('maxColorAttachmentsLimitMode', kLimitModes)
      .combine('sampleCount', kTextureSampleCounts)
      .combine('interleaveFormat', kInterleaveFormats)
  )
  .fn(async t => {
    const {
      limitTest,
      testValueName,
      maxColorAttachmentsLimitMode,
      sampleCount,
      interleaveFormat,
    } = t.params;
    await t.testDeviceWithRequestedLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, actualLimit, shouldError }) => {
        const targets = getAttachments(interleaveFormat, testValue);
        const maxColorAttachments = device.limits.maxColorAttachments;
        if (targets.length > maxColorAttachments) {
          return;
        }

        await t.expectValidationError(
          () => {
            device.createRenderBundleEncoder({
              colorFormats: targets.map(({ format }) => format),
            });
          },
          shouldError,
          getDescription(testValue, actualLimit, sampleCount, targets)
        );
      },
      { maxColorAttachments: maxColorAttachmentsLimitMode }
    );
  });
