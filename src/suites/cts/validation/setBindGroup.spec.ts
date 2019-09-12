export const description = `
setBindGroup validation tests.
`;

import { TestGroup } from '../../../framework/index.js';
import GLSL from '../../../tools/glsl.macro.js';

import { ValidationTest } from './validation_test.js';

export class F extends ValidationTest {
  setup(): { bindGroup: GPUBindGroup; pipelineLayout: GPUPipelineLayout } {
    // Dynamic buffer offsets require offset to be divisible by 256
    const MIN_DYNAMIC_BUFFER_OFFSET_ALIGNMENT = 256;
    const BINDING_SIZE = 9;

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

    const uniformBuffer = this.device.createBuffer({
      size: 2 * MIN_DYNAMIC_BUFFER_OFFSET_ALIGNMENT + 8,
      usage: GPUBufferUsage.UNIFORM,
    });

    const storageBuffer = this.device.createBuffer({
      size: 2 * MIN_DYNAMIC_BUFFER_OFFSET_ALIGNMENT + 8,
      usage: GPUBufferUsage.STORAGE,
    });

    const bindGroup = this.device.createBindGroup({
      bindings: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
            size: BINDING_SIZE,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: storageBuffer,
            size: BINDING_SIZE,
          },
        },
      ],
      layout: bindGroupLayout,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    return { bindGroup, pipelineLayout };
  }

  testComputePass(dynamicOffsets: number[]): void {
    const { bindGroup, pipelineLayout } = this.setup();

    const module = this.device.createShaderModule({
      code: GLSL(
        'compute',
        `#version 450
          layout(std140, set = 0, binding = 0) uniform UniformBuffer {
              float value1;
          };
          layout(std140, set = 0, binding = 1) buffer StorageBuffer {
              float value2;
          };
          void main() {
          }
        `
      ),
    });

    const pipeline = this.device.createComputePipeline({
      computeStage: { module, entryPoint: 'main' },
      layout: pipelineLayout,
    });

    const encoder = this.device.createCommandEncoder();
    const computePass = encoder.beginComputePass();
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup, dynamicOffsets);
    computePass.dispatch(1, 1, 1);
    computePass.endPass();

    encoder.finish();
  }

  testRenderPass(dynamicOffsets: number[]): void {
    const { bindGroup, pipelineLayout } = this.setup();

    const vertexModule = this.device.createShaderModule({
      code: GLSL(
        'vertex',
        `#version 450
          void main() {
            gl_Position = vec4(0);
          }
        `
      ),
    });

    const fragmentModule = this.device.createShaderModule({
      code: GLSL(
        'fragment',
        `#version 450
          layout(std140, set = 0, binding = 0) uniform UniformBuffer {
              vec2 value1;
          };
          layout(std140, set = 0, binding = 1) buffer StorageBuffer {
              vec2 value2;
          };
          void main() {
          }
        `
      ),
    });

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

    const encoder = this.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: attachmentTexture.createView(),
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup, dynamicOffsets);
    renderPass.draw(3, 1, 0, 0);
    renderPass.endPass();

    encoder.finish();
  }
}

export const g = new TestGroup(F);

g.test('dynamic offsets match expectations in pass encoder', async t => {
  const { dynamicOffsets, success } = t.params;

  if (success) {
    // Control case
    t.testComputePass(dynamicOffsets);
    t.testRenderPass(dynamicOffsets);
  } else {
    // Dynamic offsets don't match expectations in compute pass.
    await t.expectValidationError(() => {
      t.testComputePass(dynamicOffsets);
    });
    // Dynamic offsets don't match expectations in render pass.
    await t.expectValidationError(() => {
      t.testRenderPass(dynamicOffsets);
    });
  }
}).params([
  { dynamicOffsets: [256, 0], success: true }, // Dynamic offsets aligned
  { dynamicOffsets: [], success: false }, // No dynamic offsets
  { dynamicOffsets: [1, 2], success: false }, // Dynamic offsets not aligned
  { dynamicOffsets: [1024, 0], success: false }, // Dynamic uniform buffer out of bounds
  { dynamicOffsets: [0, 1024], success: false }, // Dynamic storage buffer out of bounds
  { dynamicOffsets: [512, 0], success: false }, // Dynamic uniform buffer out of bounds because of binding size
  { dynamicOffsets: [0, 512], success: false }, // Dynamic storage buffer out of bounds because of binding size
]);
