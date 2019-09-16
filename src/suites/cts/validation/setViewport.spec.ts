export const description = `
setViewport validation tests.
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

g.test('basic use of setViewport', t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  renderPass.setViewport(0, 0, 1, 1, 0, 1);
  renderPass.endPass();
  commandEncoder.finish();
});

g.test('a viewport width of zero is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const width = 0;
  renderPass.setViewport(0, 0, width, 1, 0, 1);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('a viewport height of zero is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const height = 0;
  renderPass.setViewport(0, 0, 0, height, 0, 1);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('both viewport width and height of zero are not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const width = 0;
  const height = 0;
  renderPass.setViewport(0, 0, width, height, 0, 1);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('viewport larger than the framebuffer is allowed', t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const width = t.textureWidth + 1;
  const height = t.textureHeight + 1;
  renderPass.setViewport(0, 0, width, height, 0, 1);
  renderPass.endPass();
  commandEncoder.finish();
});

g.test('negative x in viewport is not allowed', t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const x = -1;
  renderPass.setViewport(x, 0, 1, 1, 0, 1);
  renderPass.endPass();
  commandEncoder.finish();
});

g.test('negative y in viewport is not allowed', t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const y = -1;
  renderPass.setViewport(0, y, 1, 1, 0, 1);
  renderPass.endPass();
  commandEncoder.finish();
});

g.test('negative width in viewport is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const width = -1;
  renderPass.setViewport(0, 0, width, 1, 0, 1);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('negative height in viewport is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const height = -1;
  renderPass.setViewport(0, 0, 1, height, 0, 1);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('negative minDepth in viewport is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const minDepth = -1;
  renderPass.setViewport(0, 0, 1, 1, minDepth, 1);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('minDepth greater than 1 in viewport is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const minDepth = 2;
  renderPass.setViewport(0, 0, 1, 1, minDepth, 1);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('maxDepth between 0 and 1 is required', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const maxDepth = -1;
  renderPass.setViewport(0, 0, 1, 1, 0, maxDepth);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('maxDepth greater than 1 in viewport is not allowed', async t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const maxDepth = 2;
  renderPass.setViewport(0, 0, 1, 1, 0, maxDepth);
  renderPass.endPass();

  await t.expectValidationError(() => {
    commandEncoder.finish();
  });
});

g.test('minDepth equal to maxDepth is allowed', t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const minDepth = 0.5;
  const maxDepth = 0.5;
  renderPass.setViewport(0, 0, 1, 1, minDepth, maxDepth);
  renderPass.endPass();
  commandEncoder.finish();
});

g.test('minDepth greater than maxDepth is allowed', t => {
  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = t.beginRenderPass(commandEncoder);
  const minDepth = 0.8;
  const maxDepth = 0.5;
  renderPass.setViewport(0, 0, 1, 1, minDepth, maxDepth);
  renderPass.endPass();
  commandEncoder.finish();
});
