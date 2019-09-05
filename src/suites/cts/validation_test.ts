import GLSL from '../../tools/glsl.macro.js';

import { GPUTest } from './gpu_test.js';

export class ValidationTest extends GPUTest {
  uniformBuffer: GPUBuffer = undefined!;
  storageBuffer: GPUBuffer = undefined!;
  sampler: GPUSampler = undefined!;
  sampledTexture: GPUTexture = undefined!;

  async init(): Promise<void> {
    await super.init();

    this.uniformBuffer = this.device.createBuffer({
      size: 1024,
      usage: GPUBufferUsage.UNIFORM,
    });

    this.storageBuffer = this.device.createBuffer({
      size: 1024,
      usage: GPUBufferUsage.STORAGE,
    });

    this.sampler = this.device.createSampler();

    this.sampledTexture = this.device.createTexture({
      size: { width: 16, height: 16, depth: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.SAMPLED,
    });
  }

  getErrorBuffer(): GPUBuffer {
    return this.device.createBuffer({
      size: 1024,
      usage: 0xffff, // Invalid GPUBufferUsage
    });
  }

  expectUncapturedError(commandBuffer: GPUCommandBuffer[] = []): Promise<void> {
    this.queue.submit(commandBuffer);
    return this.asyncExpectation(async () => {
      await new Promise(resolve => {
        this.device.addEventListener('uncapturederror', resolve, { once: true });
      });
    });
  }

  async expectBindGroupValidationErrors(
    bindGroupLayout: GPUBindGroupLayout,
    mismatchedResources: GPUBindingResource[]
  ): Promise<void> {
    for (const resource of mismatchedResources) {
      this.device.createBindGroup({
        bindings: [
          {
            binding: 0,
            resource,
          },
        ],
        layout: bindGroupLayout,
      });

      await this.expectUncapturedError();
    }
  }

  setupTestForDynamicOffsets(): { bindGroup: GPUBindGroup; bindGroupLayout: GPUBindGroupLayout } {
    const MIN_DYNAMIC_BUFFER_OFFSET_ALIGNMENT = 256;

    const uniformBuffer = this.device.createBuffer({
      size: 2 * MIN_DYNAMIC_BUFFER_OFFSET_ALIGNMENT + 8,
      usage: GPUBufferUsage.UNIFORM,
    });

    const storageBuffer = this.device.createBuffer({
      size: 2 * MIN_DYNAMIC_BUFFER_OFFSET_ALIGNMENT + 8,
      usage: GPUBufferUsage.STORAGE,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      bindings: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          type: 'uniform-buffer',
          dynamic: true,
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          type: 'storage-buffer',
          dynamic: true,
        },
      ],
    });

    const BINDING_SIZE = 9;

    const bindGroup = this.device.createBindGroup({
      bindings: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
            offset: 0,
            size: BINDING_SIZE,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: storageBuffer,
            offset: 0,
            size: BINDING_SIZE,
          },
        },
      ],
      layout: bindGroupLayout,
    });

    return { bindGroup, bindGroupLayout };
  }

  async expectUncapturedErrorInComputePass(dynamicOffsets: number[]): Promise<void> {
    const { bindGroup, bindGroupLayout } = this.setupTestForDynamicOffsets();
    const module = this.device.createShaderModule({
      code: GLSL(
        'compute',
        `#version 450
          const uint kTileSize = 4;
          const uint kInstances = 11;

          layout(local_size_x = kTileSize, local_size_y = kTileSize, local_size_z = 1) in;
          layout(std140, set = 0, binding = 0) uniform UniformBuffer {
              float value1;
          };
          layout(std140, set = 0, binding = 1) buffer SBuffer {
              float value2;
          } dst;
          void main() {
          }
        `
      ),
    });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });
    const pipeline = this.device.createComputePipeline({
      computeStage: { module, entryPoint: 'main' },
      layout: pipelineLayout,
    });
    const encoder = this.device.createCommandEncoder();
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(pipeline);

    //@ts-ignore TODO:Update @webgpu/types
    computePass.setBindGroup(0, bindGroup, dynamicOffsets);
    computePass.dispatch(1, 1, 1);
    computePass.endPass();

    const commandBuffer = encoder.finish();
    await this.expectUncapturedError([commandBuffer]);
  }

  async expectUncapturedErrorInRenderPass(dynamicOffsets: number[]): Promise<void> {
    const { bindGroup, bindGroupLayout } = this.setupTestForDynamicOffsets();

    const vertexModule = this.device.createShaderModule({
      code: GLSL(
        'vertex',
        `#version 450
          void main() {
          }
        `
      ),
    });
    const fragmentModule = this.device.createShaderModule({
      code: GLSL(
        'fragment',
        `#version 450
          layout(std140, set = 0, binding = 0) uniform uBuffer {
              vec2 value1;
          };
          layout(std140, set = 0, binding = 1) buffer SBuffer {
              vec2 value2;
          } sBuffer;
          layout(location = 0) out uvec4 fragColor;
          void main() {
          }
        `
      ),
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    //@ts-ignore TODO:Update @webgpu/types
    const pipeline = this.device.createRenderPipeline({
      vertexStage: { module: vertexModule, entryPoint: 'main' },
      fragmentStage: { module: fragmentModule, entryPoint: 'main' },
      layout: pipelineLayout,
      primitiveTopology: 'triangle-list',
      colorStates: [{ format: 'rgba8unorm' }],
    });

    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depth: 1 },
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    const encoder = this.device.createCommandEncoder({});
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        //@ts-ignore TODO:Update @webgpu/types
        {
          attachment: attachmentTexture.createView(),
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    renderPass.setPipeline(pipeline);
    //@ts-ignore TODO:Update @webgpu/types
    renderPass.setBindGroup(0, bindGroup, dynamicOffsets);
    renderPass.draw(3, 1, 0, 0);
    renderPass.endPass();

    const commandBuffer = encoder.finish();
    await this.expectUncapturedError([commandBuffer]);
  }
}
