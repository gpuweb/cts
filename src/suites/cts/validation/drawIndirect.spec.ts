export const description = `
drawIndirect and drawIndexedIndirect validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';
import GLSL from '../../../tools/glsl.macro.js';

export class F extends ValidationTest {
  async testIndirectOffset(
    data: number[],
    offset: number,
    indexed: boolean,
    success: boolean
  ): Promise<void> {
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
          layout(location = 0) out vec4 fragColor;
          void main() {
            fragColor = vec4(0.0);
          }
        `
      ),
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [],
    });

    const pipeline = this.device.createRenderPipeline({
      vertexStage: { module: vertexModule, entryPoint: 'main' },
      fragmentStage: { module: fragmentModule, entryPoint: 'main' },
      layout: pipelineLayout,
      primitiveTopology: 'triangle-list',
      colorStates: [{ format: 'rgba8unorm' }],
    });

    const [indirectBuffer, arrayBuffer] = await this.device.createBufferMappedAsync({
      size: data.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDIRECT,
    });
    new Uint32Array(arrayBuffer).set(data);

    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 16, height: 16, depth: 1 },
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: attachmentTexture.createView(),
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    renderPass.setPipeline(pipeline);

    const indirectOffset = offset * Uint32Array.BYTES_PER_ELEMENT;
    if (indexed) {
      const indexBuffer = this.device.createBuffer({
        size: 100,
        usage: GPUBufferUsage.INDEX,
      });
      renderPass.setIndexBuffer(indexBuffer, 0);
      renderPass.drawIndexedIndirect(indirectBuffer, indirectOffset);
    } else {
      renderPass.drawIndirect(indirectBuffer, indirectOffset);
    }
    renderPass.endPass();

    if (success) {
      // Control case
      commandEncoder.finish();
    } else {
      // Out of bounds indirect calls are caught
      await this.expectValidationError(() => {
        commandEncoder.finish();
      });
    }
  }
}

export const g = new TestGroup(F);

g.test('out of bounds indirect draw calls are caught early', async t => {
  const { data, offset, success } = t.params;

  await t.testIndirectOffset(data, offset, false /* indexed */, success);
}).params([
  { data: [1, 2, 3, 4], offset: 0, success: true }, // In bounds
  { data: [1, 2, 3, 4, 5, 6, 7], offset: 0, success: true }, // In bounds, bigger buffer
  { data: [1, 2, 3, 4, 5, 6, 7, 8], offset: 4, success: true }, // In bounds, bigger buffer, positive offset
  { data: [1, 2, 3], offset: 0, success: false }, // Out of bounds, buffer too small
  { data: [1, 2, 3, 4], offset: 1, success: false }, // Out of bounds, index too big
  { data: [1, 2, 3, 4], offset: 5, success: false }, // Out of bounds, past buffer
  { data: [1, 2, 3, 4, 5, 6, 7], offset: Number.MAX_SAFE_INTEGER, success: false }, // In bounds,index + size of command overflows
]);

g.test('out of bounds indirect draw indexed calls are caught early', async t => {
  const { data, offset, success } = t.params;

  await t.testIndirectOffset(data, offset, true /* indexed */, success);
}).params([
  { data: [1, 2, 3, 4, 5], offset: 0, success: true }, // In bounds
  { data: [1, 2, 3, 4, 5, 6, 7, 8, 9], offset: 0, success: true }, // In bounds, bigger buffer
  { data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], offset: 5, success: true }, // In bounds, bigger buffer, positive offset
  { data: [1, 2, 3, 4], offset: 0, success: false }, // Out of bounds, buffer too small
  { data: [1, 2, 3, 4, 5], offset: 1, success: false }, // Out of bounds, index too big
  { data: [1, 2, 3, 4, 5], offset: 5, success: false }, // Out of bounds, past buffer
  { data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], offset: Number.MAX_SAFE_INTEGER, success: false }, // In bounds,index + size of command overflows
]);
