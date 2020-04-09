export const description = `
setVertexBuffer validation tests.
`;

import { initGLSL } from '../../../common/framework/glsl.js';
import { TestGroup } from '../../../common/framework/test_group.js';
import { range } from '../../../common/framework/util/util.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  async init(): Promise<void> {
    await super.init();
    await initGLSL();
  }

  getVertexBuffer(): GPUBuffer {
    return this.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.VERTEX,
    });
  }

  createRenderPipeline(bufferCount: number): GPURenderPipeline {
    const descriptor: GPURenderPipelineDescriptor = {
      vertexStage: this.getVertexStage(bufferCount),
      fragmentStage: this.getFragmentStage(),
      layout: this.getPipelineLayout(),
      primitiveTopology: 'triangle-list',
      colorStates: [{ format: 'rgba8unorm' }],
      vertexState: {
        vertexBuffers: [
          {
            arrayStride: 3 * 4,
            attributes: range(bufferCount, i => ({
              format: 'float3',
              offset: 0,
              shaderLocation: i,
            })),
          },
        ],
      },
    };
    return this.device.createRenderPipeline(descriptor);
  }

  getVertexStage(bufferCount: number): GPUProgrammableStageDescriptor {
    const glsl = `
      #version 450
      ${range(bufferCount, i => `\nlayout(location = ${i}) in vec3 a_position${i};`).join('')}
      void main() {
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
       }
    `;
    return {
      module: this.makeShaderModule('vertex', { glsl }),
      entryPoint: 'main',
    };
  }

  getFragmentStage(): GPUProgrammableStageDescriptor {
    const glsl = `
      #version 450
      layout(location = 0) out vec4 fragColor;
      void main() {
        fragColor = vec4(0.0, 1.0, 0.0, 1.0);
      }
    `;
    return {
      module: this.makeShaderModule('fragment', { glsl }),
      entryPoint: 'main',
    };
  }

  getPipelineLayout(): GPUPipelineLayout {
    return this.device.createPipelineLayout({ bindGroupLayouts: [] });
  }

  beginRenderPass(commandEncoder: GPUCommandEncoder): GPURenderPassEncoder {
    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depth: 1 },
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    return commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: attachmentTexture.createView(),
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
  }
}

export const g = new TestGroup(F);

g.test('vertex buffers inherit from previous pipeline', async t => {
  const pipeline1 = t.createRenderPipeline(1);
  const pipeline2 = t.createRenderPipeline(2);

  const vertexBuffer1 = t.getVertexBuffer();
  const vertexBuffer2 = t.getVertexBuffer();

  {
    // Check failure when vertex buffer is not set
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    renderPass.setPipeline(pipeline1);
    renderPass.draw(3, 1, 0, 0);
    renderPass.endPass();

    t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
  {
    // Check success when vertex buffer is inherited from previous pipeline
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    renderPass.setPipeline(pipeline2);
    renderPass.setVertexBuffer(0, vertexBuffer1);
    renderPass.setVertexBuffer(1, vertexBuffer2);
    renderPass.draw(3, 1, 0, 0);
    renderPass.setPipeline(pipeline1);
    renderPass.draw(3, 1, 0, 0);
    renderPass.endPass();

    commandEncoder.finish();
  }
});

g.test('vertex buffers do not inherit between render passes', async t => {
  const pipeline1 = t.createRenderPipeline(1);
  const pipeline2 = t.createRenderPipeline(2);

  const vertexBuffer1 = t.getVertexBuffer();
  const vertexBuffer2 = t.getVertexBuffer();

  {
    // Check success when vertex buffer is set for each render pass
    const commandEncoder = t.device.createCommandEncoder();
    {
      const renderPass = t.beginRenderPass(commandEncoder);
      renderPass.setPipeline(pipeline2);
      renderPass.setVertexBuffer(0, vertexBuffer1);
      renderPass.setVertexBuffer(1, vertexBuffer2);
      renderPass.draw(3, 1, 0, 0);
      renderPass.endPass();
    }
    {
      const renderPass = t.beginRenderPass(commandEncoder);
      renderPass.setPipeline(pipeline1);
      renderPass.setVertexBuffer(0, vertexBuffer1);
      renderPass.draw(3, 1, 0, 0);
      renderPass.endPass();
    }
    commandEncoder.finish();
  }
  {
    // Check failure because vertex buffer is not inherited in second subpass
    const commandEncoder = t.device.createCommandEncoder();
    {
      const renderPass = t.beginRenderPass(commandEncoder);
      renderPass.setPipeline(pipeline2);
      renderPass.setVertexBuffer(0, vertexBuffer1);
      renderPass.setVertexBuffer(1, vertexBuffer2);
      renderPass.draw(3, 1, 0, 0);
      renderPass.endPass();
    }
    {
      const renderPass = t.beginRenderPass(commandEncoder);
      renderPass.setPipeline(pipeline1);
      renderPass.draw(3, 1, 0, 0);
      renderPass.endPass();
    }

    t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
});
