export const description = `
Debug markers and debug groups validation tests.
`;

import { TestGroup, pcombine, poptions } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

// TODO: Move this fixture class to a common file.
class F extends ValidationTest {
  beginPass(
    type: string,
    commandEncoder: GPUCommandEncoder
  ): GPURenderPassEncoder | GPUComputePassEncoder {
    if (type === 'compute') {
      return this.beginComputePass(commandEncoder);
    } else if (type === 'renderpass') {
      return this.beginRenderPass(commandEncoder);
    } else {
      throw new Error('Unexpected pass encoder type');
    }
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

  beginComputePass(commandEncoder: GPUCommandEncoder): GPUComputePassEncoder {
    return commandEncoder.beginComputePass();
  }
}

export const g = new TestGroup(F);

g.test('debug markers push and pop counts must be equal', async t => {
  const { type, pushCount, popCount, success } = t.params;

  let commandEncoder: GPUCommandEncoder | GPURenderBundleEncoder;
  let passEncoder: GPURenderPassEncoder | GPUComputePassEncoder | undefined;

  if (type === 'commandencoder') {
    commandEncoder = t.device.createCommandEncoder();
  } else if (type === 'compute' || type === 'renderpass') {
    commandEncoder = t.device.createCommandEncoder();
    passEncoder = t.beginPass(type, commandEncoder);
  } else if (type === 'renderbundle') {
    commandEncoder = t.device.createRenderBundleEncoder({
      colorFormats: ['rgba8unorm'],
    });
  } else {
    throw new Error('Unexpected type');
  }

  const encoder = passEncoder || commandEncoder;

  for (let i = 0; i < pushCount; i++) {
    encoder.pushDebugGroup('Event Start');
  }
  encoder.insertDebugMarker('Marker');
  for (let i = 0; i < popCount; i++) {
    encoder.popDebugGroup();
  }

  if (passEncoder) {
    passEncoder.endPass();
  }

  if (success) {
    commandEncoder.finish();
  } else {
    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
}).params([
  ...pcombine([
    poptions('type', ['compute', 'renderpass', 'renderbundle', 'commandencoder']),
    [
      { pushCount: 0, popCount: 0, success: true }, // Correct usage
      { pushCount: 1, popCount: 1, success: true }, // Correct usage
      { pushCount: 2, popCount: 2, success: true }, // Correct usage
      { pushCount: 1, popCount: 0, success: false }, // Push without a following pop produces an error
      { pushCount: 0, popCount: 1, success: false }, // Pop without a preceding push produces an error
      { pushCount: 1, popCount: 2, success: false }, // Pop without a preceding push produces an error
      { pushCount: 2, popCount: 1, success: false }, // Push without a following pop produces an error
    ],
  ]),
]);

g.test('nested pushes are allowed in a pass in a command encoder', async t => {
  const { type } = t.params;

  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.pushDebugGroup('Event Start');

  const pass = t.beginPass(type, commandEncoder);
  pass.pushDebugGroup('Event Start');
  pass.insertDebugMarker('Marker');
  pass.popDebugGroup();
  pass.endPass();

  commandEncoder.popDebugGroup();
  commandEncoder.finish();
}).params(poptions('type', ['compute', 'renderpass']));

g.test('command encoder and pass pushes must be balanced independently', async t => {
  const { type } = t.params;

  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.pushDebugGroup('Event Start');

  const pass = t.beginPass(type, commandEncoder);
  pass.insertDebugMarker('Marker');
  pass.popDebugGroup();
  pass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
}).params(poptions('type', ['compute', 'renderpass']));
