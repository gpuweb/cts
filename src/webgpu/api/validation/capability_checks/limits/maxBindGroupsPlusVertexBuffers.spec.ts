import { assert, range } from '../../../../../common/util/util.js';

import {
  kRenderEncoderTypes,
  kMaximumLimitBaseParams,
  makeLimitTestGroup,
  LimitsRequest,
  getWGSLBindingDeclarationEntriesForStage,
  getTotalPossibleBindingsPerStage,
} from './limit_utils.js';

const kPriorities = ['vertexBuffers', 'bindGroups'] as const;
type Priority = (typeof kPriorities)[number];

/**
 * Given testValue, choose more vertex buffers or more bind groups based on priority
 */
function getNumBindGroupsAndNumVertexBuffers(
  device: GPUDevice,
  priority: Priority,
  testValue: number
) {
  switch (priority) {
    case 'bindGroups': {
      const numBindGroups = Math.min(testValue, device.limits.maxBindGroups);
      const numVertexBuffers = Math.max(0, testValue - numBindGroups);
      return { numVertexBuffers, numBindGroups };
    }
    case 'vertexBuffers': {
      const numVertexBuffers = Math.min(testValue, device.limits.maxVertexBuffers);
      const numBindGroups = Math.max(0, testValue - numVertexBuffers);
      return { numVertexBuffers, numBindGroups };
    }
  }
}

/**
 * Generate a render pipeline that uses testValue bindGroups + vertex buffers
 */
function getPipelineDescriptor(device: GPUDevice, priority: Priority, testValue: number) {
  const { numVertexBuffers, numBindGroups } = getNumBindGroupsAndNumVertexBuffers(
    device,
    priority,
    testValue
  );

  const vertexInput =
    numVertexBuffers === 0
      ? ''
      : `
    struct VInput {
${range(numVertexBuffers, i => `      @location(${i}) p${i}: vec4f,`).join('\n')}
    };
  `;

  const maxBindingsPerStage = getTotalPossibleBindingsPerStage(device);
  assert(numBindGroups < maxBindingsPerStage * 2);
  const numBindingsVertStage = Math.min(maxBindingsPerStage, numBindGroups);
  const numBindingsFragStage = Math.max(0, numBindGroups - numBindingsVertStage);

  const vsIter = getWGSLBindingDeclarationEntriesForStage(device, 'bgVS');
  const fsIter = getWGSLBindingDeclarationEntriesForStage(device, 'bgFS');
  const code = `
${range(numBindingsVertStage, i => `@group(${i}) @binding(0) ${vsIter.next().value};`).join('\n')}
${vertexInput}
    @vertex fn vs(${numVertexBuffers ? 'vin: VInput' : ''}) -> @builtin(position) vec4f {
${range(numBindingsVertStage, i => `      _ = bgVS${i};`).join('\n')}
      return vec4f(0)
${range(numVertexBuffers, i => `     + vin.p${i}`).join('\n')}
      ;
    }

${range(numBindingsFragStage, i => `@group(${i}) @binding(0) ${fsIter.next().value};`).join('\n')}
    @fragment fn fs() -> @location(0) vec4f {
${range(numBindingsFragStage, i => `      _ = bgFS${i};`).join('\n')}
      return vec4f(0);
    }
    `;

  const module = device.createShaderModule({ code });
  const buffers = range<GPUVertexBufferLayout>(numVertexBuffers, i => ({
    arrayStride: 16,
    attributes: [{ shaderLocation: i, offset: 0, format: 'float32' }],
  }));

  return {
    code,
    descriptor: {
      layout: 'auto',
      vertex: {
        module,
        buffers,
      },
      fragment: {
        module,
        targets: [{ format: 'rgba8unorm' }],
      },
    } as GPURenderPipelineDescriptor,
  };
}

const kExtraLimits: LimitsRequest = {
  maxBindGroups: 'adapterLimit',
  maxSampledTexturesPerShaderStage: 'adapterLimit',
  maxSamplersPerShaderStage: 'adapterLimit',
  maxStorageBuffersPerShaderStage: 'adapterLimit',
  maxStorageTexturesPerShaderStage: 'adapterLimit',
  maxUniformBuffersPerShaderStage: 'adapterLimit',
  maxVertexAttributes: 'adapterLimit',
  maxVertexBuffers: 'adapterLimit',
};

const limit = 'maxBindGroupsPlusVertexBuffers';
export const { g, description } = makeLimitTestGroup(limit);

g.test('createRenderPipeline,at_over')
  .desc(`Test using at and over ${limit} limit in createRenderPipeline(Async)`)
  .params(
    kMaximumLimitBaseParams
      .combine('async', [false, true])
      .beginSubcases()
      .combine('priority', kPriorities)
  )
  .fn(async t => {
    const { limitTest, testValueName, async, priority } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError, actualLimit }) => {
        const maxUsableVertexBuffers = Math.min(
          device.limits.maxVertexBuffers,
          device.limits.maxVertexAttributes
        );
        const maxUsableBindGroupsPlusVertexBuffers =
          device.limits.maxBindGroups + maxUsableVertexBuffers;
        t.skipIf(
          actualLimit > maxUsableBindGroupsPlusVertexBuffers,
          `can not test because the max usable bindGroups + vertexBuffers (${maxUsableBindGroupsPlusVertexBuffers}) is < the maxBindGroupsAndVertexBuffers(${actualLimit})`
        );

        const { code, descriptor } = getPipelineDescriptor(device, priority, testValue);

        await t.testCreateRenderPipeline(
          descriptor,
          async,
          shouldError,
          `testValue: ${testValue}, actualLimit: ${actualLimit}, shouldError: ${shouldError}\n${code}`
        );
      },
      kExtraLimits
    );
  });

g.test('draw,at_over')
  .desc(`Test using at and over ${limit} limit draw/drawIndexed/drawIndirect/drawIndexedIndirect`)
  .params(
    kMaximumLimitBaseParams
      .combine('encoderType', kRenderEncoderTypes)
      .beginSubcases()
      .combine('priority', kPriorities)
      .combine('drawType', ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect'] as const)
  )
  .fn(async t => {
    const { limitTest, testValueName, encoderType, drawType, priority } = t.params;
    await t.testDeviceWithRequestedMaximumLimits(
      limitTest,
      testValueName,
      async ({ device, testValue, shouldError, actualLimit }) => {
        const maxUsableVertexBuffers = Math.min(
          device.limits.maxVertexBuffers,
          device.limits.maxVertexAttributes
        );
        const maxUsableBindGroupsPlusVertexBuffers =
          device.limits.maxBindGroups + maxUsableVertexBuffers;
        t.skipIf(
          actualLimit > maxUsableBindGroupsPlusVertexBuffers,
          `can not test because the max usable bindGroups + vertexBuffers (${maxUsableBindGroupsPlusVertexBuffers}) is < the maxBindGroupsAndVertexBuffers(${actualLimit})`
        );

        const { numVertexBuffers, numBindGroups } = getNumBindGroupsAndNumVertexBuffers(
          device,
          priority,
          testValue
        );

        const module = device.createShaderModule({
          code: `
        @vertex fn vs() -> @builtin(position) vec4f {
          return vec4f(0);
        }
        `,
        });
        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module },
        });

        const buffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.VERTEX,
        });
        t.trackForCleanup(buffer);

        await t.testGPURenderCommandsMixin(
          encoderType,
          ({ bindGroup, mixin }) => {
            if (numVertexBuffers) {
              mixin.setVertexBuffer(numVertexBuffers - 1, buffer);
            }

            if (numBindGroups) {
              mixin.setBindGroup(numBindGroups - 1, bindGroup);
            }

            mixin.setPipeline(pipeline);

            const indirectBuffer = device.createBuffer({
              size: 4,
              usage: GPUBufferUsage.INDIRECT,
            });
            t.trackForCleanup(indirectBuffer);

            const indexBuffer = device.createBuffer({
              size: 4,
              usage: GPUBufferUsage.INDEX,
            });
            t.trackForCleanup(indexBuffer);

            switch (drawType) {
              case 'draw':
                mixin.draw(0);
                break;
              case 'drawIndexed':
                mixin.setIndexBuffer(indexBuffer, 'uint16');
                mixin.drawIndexed(0);
                break;
              case 'drawIndirect':
                mixin.drawIndirect(indirectBuffer, 0);
                break;
              case 'drawIndexedIndirect':
                mixin.setIndexBuffer(indexBuffer, 'uint16');
                mixin.drawIndexedIndirect(indirectBuffer, 0);
                break;
            }
          },
          shouldError,
          `testValue: ${testValue}, actualLimit: ${actualLimit}, shouldError: ${shouldError}`
        );

        buffer.destroy();
      },
      kExtraLimits
    );
  });
