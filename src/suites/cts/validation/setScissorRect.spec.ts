export const description = `
setScissorRect validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

// TODO: Move this fixture class to a common file.
export class F extends ValidationTest {
  textureWidth: number = 16;
  textureHeight: number = 16;

  beginRenderPass(commandEncoder: GPUCommandEncoder): GPURenderPassEncoder {
    const attachmentTexture = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: this.textureWidth, height: this.textureHeight, depth: 1 },
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

g.test('basic use of setScissorRect', t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  renderPass.setScissorRect(0, 0, 1, 1);
  renderPass.endPass();
  commandEncoder.finish();
});

g.test('a scissor rect width of zero is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const width = 0;
  renderPass.setScissorRect(0, 0, width, 1);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('a scissor rect height of zero is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const height = 0;
  renderPass.setScissorRect(0, 0, 0, height);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('both scissor rect width and height of zero are not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const width = 0;
  const height = 0;
  renderPass.setScissorRect(0, 0, width, height);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('scissor larger than the framebuffer is allowed', t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const width = t.textureWidth + 1;
  const height = t.textureHeight + 1;
  renderPass.setScissorRect(0, 0, width, height);
  renderPass.endPass();
  commandEncoder.finish();
});
