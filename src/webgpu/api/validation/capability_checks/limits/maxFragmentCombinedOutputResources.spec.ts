import { range } from '../../../../../common/util/util.js';

import {
  computeBytesPerSample,
  kMaximumLimitBaseParams,
  makeLimitTestGroup,
  LimitsRequest,
} from './limit_utils.js';

function select<T>(array: T[], i: number) {
  return array[i % array.length];
}

const kTextureStorageTypes = [
  { type: 'texture_storage_1d', coords: '0' },
  { type: 'texture_storage_2d', coords: 'vec2u(0)' },
  { type: 'texture_storage_2d_array', coords: 'vec2u(0), 0' },
  { type: 'texture_storage_3d', coords: 'vec3u(0)' },
];

function getPipelineDescriptor(device: GPUDevice, testValue: number) {
  const numStorageResources = ((testValue * 2) / 3) | 0;
  const numTargets = testValue - numStorageResources;

  const bindingAndGroup = (i: number) => `@group(${i % 3}) @binding(${(i / 3) | 0})`;
  const textureDecl = (i: number) =>
    `var usedTexture${i}: ${select(kTextureStorageTypes, i).type}<rgba32float, write>;`;
  const bufferDecl = (i: number) => `var<storage, read_write> usedBuffer${i}: array<f32>;`;
  const textureUsage = (i: number) =>
    `textureStore(usedTexture${i}, ${select(kTextureStorageTypes, i).coords}, vec4f(0));`;
  const bufferUsage = (i: number) => `usedBuffer${i}[0] = 0.0;`;

  const code = `
    @vertex fn vs() -> @builtin(position) vec4f {
      return vec4f(0);
    }

    // these are unused and so should not affect the test.
    @group(3) @binding(0) var unusedTexture1d: texture_storage_1d<rgba32float, write>;
    @group(3) @binding(1) var unusedTexture2d: texture_storage_2d<rgba32float, write>;
    @group(3) @binding(2) var unusedTexture2dArray: texture_storage_2d_array<rgba32float, write>;
    @group(3) @binding(3) var unusedTexture3d: texture_storage_3d<rgba32float, write>;

    // testValue: ${testValue}
    // numStorageTextures: ${numStorageResources}
    // numTargets: ${numTargets}

    // We use rgba32float format storage textures as they take the most size and so are most likely
    // to trigger any invalid validation.

    ${range(
      numStorageResources,
      i => `${bindingAndGroup(i)} ${i % 2 ? textureDecl(i) : bufferDecl(i)}`
    ).join('\n    ')}

    @fragment fn fs() -> @location(0) vec4f {
      ${range(numStorageResources, i => (i % 2 ? textureUsage(i) : bufferUsage(i))).join(
        '\n      '
      )}
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
      targets: new Array(numTargets).fill({ format: 'r8unorm', writeMask: 0 }),
    },
  };
  return {
    pipelineDescriptor,
    code,
    numStorageTextures: ((numStorageResources + 1) / 2) | 0,
    numStorageBuffers: (numStorageResources / 2) | 0,
  };
}

const kExtraLimits: LimitsRequest = {
  maxColorAttachments: 'adapterLimit',
  maxColorAttachmentBytesPerSample: 'adapterLimit',
  maxStorageBuffersPerShaderStage: 'adapterLimit',
  maxStorageTexturesPerShaderStage: 'adapterLimit',
};

const limit = 'maxFragmentCombinedOutputResources';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createRenderPipeline,async,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipeline(Async)`)
  .params(kMaximumLimitBaseParams.combine('async', [false, true] as const))
  .fn(async t => {
    const { limitTest, testValueName, async } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError }) => {
        const {
          pipelineDescriptor,
          code,
          numStorageBuffers,
          numStorageTextures,
        } = getPipelineDescriptor(device, testValue);
        const targets = pipelineDescriptor.fragment?.targets as GPUColorTargetState[];
        const bytesPerSample = computeBytesPerSample(targets);
        if (
          targets.length > device.limits.maxColorAttachments ||
          bytesPerSample > device.limits.maxColorAttachmentBytesPerSample ||
          numStorageBuffers > device.limits.maxStorageBuffersPerShaderStage ||
          numStorageTextures > device.limits.maxStorageTexturesPerShaderStage
        ) {
          return;
        }

        await t.testCreateRenderPipeline(pipelineDescriptor, async, shouldError, code);
      },
      kExtraLimits
    );
  });
