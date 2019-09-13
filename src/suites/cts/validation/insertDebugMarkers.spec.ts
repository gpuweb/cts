export const description = `
insertDebugMarker validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

// TODO: Move beginPass & cie to a Fixture class.
export class F extends ValidationTest {
  beginPass(
    type: string,
    commandEncoder: GPUCommandEncoder
  ): GPURenderPassEncoder | GPUComputePassEncoder {
    if (type === 'render') {
      return this.beginRenderPass(commandEncoder);
    } else if (type === 'compute') {
      return this.beginComputePass(commandEncoder);
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

g.test('correct usage of debug markers should succeed in pass', async t => {
  const { type } = t.params;

  const commandEncoder = t.device.createCommandEncoder();
  const pass = t.beginPass(type, commandEncoder);
  pass.pushDebugGroup('Event Start');
  pass.pushDebugGroup('Event Start');
  pass.insertDebugMarker('Marker');
  pass.popDebugGroup();
  pass.popDebugGroup();
  pass.endPass();
  commandEncoder.finish();
}).params([
  { type: 'render' }, // (blank comment to enforce newlines on autoformat)
  { type: 'compute' },
]);

g.test('push without a following pop produces an error in pass', async t => {
  const { type } = t.params;

  const commandEncoder = t.device.createCommandEncoder();
  const pass = t.beginPass(type, commandEncoder);
  pass.pushDebugGroup('Event Start');
  pass.pushDebugGroup('Event Start');
  pass.insertDebugMarker('Marker');
  pass.popDebugGroup();
  pass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
}).params([
  { type: 'render' }, // (blank comment to enforce newlines on autoformat)
  { type: 'compute' },
]);

g.test('pop without a preceding push produces an error in pass', async t => {
  const { type } = t.params;

  const commandEncoder = t.device.createCommandEncoder();
  const pass = t.beginPass(type, commandEncoder);
  pass.pushDebugGroup('Event Start');
  pass.insertDebugMarker('Marker');
  pass.popDebugGroup();
  pass.popDebugGroup();
  pass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
}).params([
  { type: 'render' }, // (blank comment to enforce newlines on autoformat)
  { type: 'compute' },
]);

g.test('correct usage of debug markers should succeed in command encoder', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.pushDebugGroup('Event Start');
  commandEncoder.pushDebugGroup('Event Start');
  commandEncoder.insertDebugMarker('Marker');
  commandEncoder.popDebugGroup();
  commandEncoder.popDebugGroup();
  commandEncoder.finish();
});

g.test('push without a following pop produces an error in command encoder', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.pushDebugGroup('Event Start');
  commandEncoder.pushDebugGroup('Event Start');
  commandEncoder.insertDebugMarker('Marker');
  commandEncoder.popDebugGroup();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('pop without a preceding push produces an error in command encoder', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  commandEncoder.pushDebugGroup('Event Start');
  commandEncoder.insertDebugMarker('Marker');
  commandEncoder.popDebugGroup();
  commandEncoder.popDebugGroup();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

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
}).params([
  { type: 'render' }, // (blank comment to enforce newlines on autoformat)
  { type: 'compute' },
]);

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
}).params([
  { type: 'render' }, // (blank comment to enforce newlines on autoformat)
  { type: 'compute' },
]);
