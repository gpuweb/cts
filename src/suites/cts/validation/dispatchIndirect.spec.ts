export const description = `
dispatchIndirect validation tests.
`;

import { TestGroup } from '../../../framework/index.js';
import GLSL from '../../../tools/glsl.macro.js';

import { ValidationTest } from './validation_test.js';

export const g = new TestGroup(ValidationTest);

g.test('out of bounds indirect dispatch calls are caught early', async t => {
  const { data, offset, success } = t.params;

  const module = t.device.createShaderModule({
    code: GLSL(
      'compute',
      `#version 450
        void main() {
        }
      `
    ),
  });

  const pipelineLayout = t.device.createPipelineLayout({
    bindGroupLayouts: [],
  });

  const pipeline = t.device.createComputePipeline({
    computeStage: { module, entryPoint: 'main' },
    layout: pipelineLayout,
  });

  const [indirectBuffer, arrayBuffer] = await t.device.createBufferMappedAsync({
    size: data.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.INDIRECT,
  });
  new Uint32Array(arrayBuffer).set(data);

  const commandEncoder = t.device.createCommandEncoder();
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(pipeline);
  computePass.dispatchIndirect(indirectBuffer, offset * Uint32Array.BYTES_PER_ELEMENT);
  computePass.endPass();

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
  { data: [1, 2, 3], offset: 0, success: true }, // In bounds
  { data: [1, 2, 3, 4, 5, 6], offset: 0, success: true }, // In bounds, bigger buffer
  { data: [1, 2, 3, 4, 5, 6], offset: 3, success: true }, // In bounds, bigger buffer, positive offset
  { data: [1, 2], offset: 0, success: false }, //Out of bounds, buffer too small
  { data: [1, 2, 3], offset: 1, success: false }, //Out of bounds, index too big
  { data: [1, 2, 3], offset: 4, success: false }, //Out of bounds, index past buffer
  { data: [1, 2, 3, 4, 5, 6], offset: Number.MAX_SAFE_INTEGER, success: false }, // Out of bounds, offset is very large
]);
