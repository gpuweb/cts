export const description = `
drawIndirect and drawIndexedIndirect validation tests.
`;

import { TestGroup, pcombine } from '../../../framework/index.js';
import GLSL from '../../../tools/glsl.macro.js';

import { ValidationTest } from './validation_test.js';

export const g = new TestGroup(ValidationTest);

g.test('out of bounds indirect draw calls are caught early', async t => {
  const { data, offset, indexed, success } = t.params;

  const vertexModule = t.device.createShaderModule({
    code: GLSL(
      'vertex',
      `#version 450
        void main() {
          gl_Position = vec4(0);
        }
      `
    ),
  });

  const fragmentModule = t.device.createShaderModule({
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

  const pipelineLayout = t.device.createPipelineLayout({
    bindGroupLayouts: [],
  });

  const pipeline = t.device.createRenderPipeline({
    vertexStage: { module: vertexModule, entryPoint: 'main' },
    fragmentStage: { module: fragmentModule, entryPoint: 'main' },
    layout: pipelineLayout,
    primitiveTopology: 'triangle-list',
    colorStates: [{ format: 'rgba8unorm' }],
  });

  const [indirectBuffer, arrayBuffer] = await t.device.createBufferMappedAsync({
    size: data.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.INDIRECT,
  });
  new Uint32Array(arrayBuffer).set(data);

  const attachmentTexture = t.device.createTexture({
    format: 'rgba8unorm',
    size: { width: 16, height: 16, depth: 1 },
    usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
  });

  const commandEncoder = t.device.createCommandEncoder();
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
    const indexBuffer = t.device.createBuffer({
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
    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
}).params([
  ...pcombine([
    [{ indexed: false }],
    [
      { data: [1, 2, 3, 4], offset: 0, success: true }, // In bounds
      { data: [1, 2, 3, 4, 5, 6, 7], offset: 0, success: true }, // In bounds, bigger buffer
      { data: [1, 2, 3, 4, 5, 6, 7, 8], offset: 4, success: true }, // In bounds, bigger buffer, positive offset
      { data: [1, 2, 3], offset: 0, success: false }, // Out of bounds, buffer too small
      { data: [1, 2, 3, 4], offset: 1, success: false }, // Out of bounds, index too big
      { data: [1, 2, 3, 4], offset: 5, success: false }, // Out of bounds, past buffer
      { data: [1, 2, 3, 4, 5, 6, 7], offset: Number.MAX_SAFE_INTEGER, success: false }, // Out of bounds, offset is very large
    ],
  ]),
  ...pcombine([
    [{ indexed: true }],
    [
      { data: [1, 2, 3, 4, 5], offset: 0, success: true }, // In bounds
      { data: [1, 2, 3, 4, 5, 6, 7, 8, 9], offset: 0, success: true }, // In bounds, bigger buffer
      { data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], offset: 5, success: true }, // In bounds, bigger buffer, positive offset
      { data: [1, 2, 3, 4], offset: 0, success: false }, // Out of bounds, buffer too small
      { data: [1, 2, 3, 4, 5], offset: 1, success: false }, // Out of bounds, index too big
      { data: [1, 2, 3, 4, 5], offset: 5, success: false }, // Out of bounds, past buffer
      { data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], offset: Number.MAX_SAFE_INTEGER, success: false }, // Out of bounds, offset is very large
    ],
  ]),
]);
