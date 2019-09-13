export const description = `
setViewport validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

// TODO: Move beginRenderPass to a Fixture class.
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

g.test('an empty viewport is not allowed', async t => {
  {
    // Width of viewport is zero
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const width = 0;
    renderPass.setViewport(0, 0, width, 1, 0, 1);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
  {
    // Height of viewport is zero
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const height = 0;
    renderPass.setViewport(0, 0, 0, height, 0, 1);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
  {
    // Both width and height of viewport are zero
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const width = 0;
    const height = 0;
    renderPass.setViewport(0, 0, width, height, 0, 1);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
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

g.test('negative x and y in viewport are allowed', t => {
  {
    //  negative x in viewport is allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const x = -1;
    renderPass.setViewport(x, 0, 1, 1, 0, 1);
    renderPass.endPass();
    commandEncoder.finish();
  }
  {
    //  negative y in viewport is allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const y = -1;
    renderPass.setViewport(0, y, 1, 1, 0, 1);
    renderPass.endPass();
    commandEncoder.finish();
  }
});

g.test('negative width and height in viewport are not allowed', async t => {
  {
    //  negative width in viewport is not allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const width = -1;
    renderPass.setViewport(0, 0, width, 1, 0, 1);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
  {
    //  negative height in viewport is not allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const height = -1;
    renderPass.setViewport(0, 0, 1, height, 0, 1);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
});

g.test('minDepth between 0 and 1 is required', async t => {
  {
    //  negative minDepth in viewport is not allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const minDepth = -1;
    renderPass.setViewport(0, 0, 1, 1, minDepth, 1);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
  {
    //  minDepth > 1 in viewport is not allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const minDepth = 2;
    renderPass.setViewport(0, 0, 1, 1, minDepth, 1);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
});

g.test('maxDepth between 0 and 1 is required', async t => {
  {
    //  negative maxDepth in viewport is not allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const maxDepth = -1;
    renderPass.setViewport(0, 0, 1, 1, 0, maxDepth);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
  {
    //  maxDepth > 1 in viewport is not allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const maxDepth = 2;
    renderPass.setViewport(0, 0, 1, 1, 0, maxDepth);
    renderPass.endPass();

    await t.expectValidationError(() => {
      commandEncoder.finish();
    });
  }
});

g.test('minDepth equal or greater than maxDepth is allowed', t => {
  {
    //  minDepth equal to maxDepth is allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const minDepth = 0.5;
    const maxDepth = 0.5;
    renderPass.setViewport(0, 0, 1, 1, minDepth, maxDepth);
    renderPass.endPass();
    commandEncoder.finish();
  }
  {
    // minDepth greater than maxDepth is allowed
    const commandEncoder = t.device.createCommandEncoder();
    const renderPass = t.beginRenderPass(commandEncoder);
    const minDepth = 0.8;
    const maxDepth = 0.5;
    renderPass.setViewport(0, 0, 1, 1, minDepth, maxDepth);
    renderPass.endPass();
    commandEncoder.finish();
  }
});
