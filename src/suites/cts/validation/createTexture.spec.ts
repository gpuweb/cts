export const description = `
createTexture validation tests.
`;

import { TestGroup } from '../../../framework/index.js';

import { ValidationTest } from './validation_test.js';

class F extends ValidationTest {
  getDescriptor(
    options: {
      width?: number;
      height?: number;
      arrayLayerCount?: number;
      mipLevelCount?: number;
      sampleCount?: number;
      format?: GPUTextureFormat;
    } = {}
  ): GPUTextureDescriptor {
    const {
      width = 32,
      height = 32,
      arrayLayerCount = 1,
      mipLevelCount = 1,
      sampleCount = 1,
      format = 'rgba8unorm',
    } = options;
    return {
      size: { width, height, depth: 1 },
      arrayLayerCount,
      mipLevelCount,
      sampleCount,
      dimension: '2d',
      format,
      usage: GPUTextureUsage.OUTPUT_ATTACHMENT | GPUTextureUsage.SAMPLED,
    };
  }
}

export const g = new TestGroup(F);

g.test('validation of sampleCount', async t => {
  const { sampleCount, mipLevelCount, arrayLayerCount, success } = t.params;

  const descriptor = t.getDescriptor({ sampleCount, mipLevelCount, arrayLayerCount });

  await t.expectValidationError(() => {
    t.device.createTexture(descriptor);
  }, !success);
}).params([
  { sampleCount: 1, success: true }, // sampleCount of 1 is allowed
  { sampleCount: 4, success: true }, // sampleCount of 4 is allowed
  { sampleCount: 3, success: false }, // sampleCount of 3 is not allowed
  { sampleCount: 4, mipLevelCount: 2, success: false }, // it is an error to create a multisampled texture with mipLevelCount > 1.
  { sampleCount: 4, arrayLayerCount: 2, success: false }, // TODO: Remove when Chrome supports multisampled 2D array textures.
]);

g.test('validation of mipLevelCount', async t => {
  const { width, height, mipLevelCount, success } = t.params;

  const descriptor = t.getDescriptor({ width, height, mipLevelCount });

  await t.expectValidationError(() => {
    t.device.createTexture(descriptor);
  }, !success);
}).params([
  { width: 32, height: 32, mipLevelCount: 1, success: true }, // mipLevelCount of 1 is allowed
  { width: 32, height: 32, mipLevelCount: 0, success: false }, // mipLevelCount of 0 is not allowed
  { width: 32, height: 32, mipLevelCount: 6, success: true }, // full mip chains are allowed (Mip level sizes: 32, 16, 8, 4, 2, 1)
  { width: 31, height: 32, mipLevelCount: 7, success: false }, // too big mip chains on width are disallowed (Mip level width: 31, 15, 7, 3, 1, 1)
  { width: 32, height: 31, mipLevelCount: 7, success: false }, // too big mip chains on height are disallowed (Mip level width: 31, 15, 7, 3, 1, 1)
  { width: 32, height: 32, mipLevelCount: 100, success: false }, // undefined shift check if miplevel is bigger than the integer bit width
  { width: 32, height: 8, mipLevelCount: 6, success: true }, // non square mip map halves the resolution until a 1x1 dimension. (Mip maps: 32 * 8, 16 * 4, 8 * 2, 4 * 1, 2 * 1, 1 * 1)
]);

g.test('it is valid to destroy a texture', t => {
  const descriptor = t.getDescriptor();
  const texture = t.device.createTexture(descriptor);
  texture.destroy();
});

g.test('it is valid to destroy a destroyed texture', t => {
  const descriptor = t.getDescriptor();
  const texture = t.device.createTexture(descriptor);
  texture.destroy();
  texture.destroy();
});

g.test('it is invalid to submit a destroyed texture before encode', async t => {
  const descriptor = t.getDescriptor();
  const texture = t.device.createTexture(descriptor);
  const textureView = texture.createView();

  // Destroy texture
  texture.destroy();

  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        attachment: textureView,
        loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    ],
  });
  renderPass.endPass();
  const commandBuffer = commandEncoder.finish();

  await t.expectValidationError(() => {
    t.queue.submit([commandBuffer]);
  });
});

g.test('it is invalid to submit a destroyed texture after encode', async t => {
  const descriptor = t.getDescriptor();
  const texture = t.device.createTexture(descriptor);
  const textureView = texture.createView();

  const commandEncoder = t.device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        attachment: textureView,
        loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    ],
  });
  renderPass.endPass();
  const commandBuffer = commandEncoder.finish();

  // Destroy texture
  texture.destroy();

  await t.expectValidationError(() => {
    t.queue.submit([commandBuffer]);
  });
});

g.test('it is invalid to have an output attachment texture with non renderable format', async t => {
  const { format, success } = t.params;

  const descriptor = t.getDescriptor({ width: 1, height: 1, format });

  await t.expectValidationError(() => {
    t.device.createTexture(descriptor);
  }, !success);
}).params([
  { format: 'rgba8unorm', success: true }, // rgba8unorm is renderable
  { format: 'rg11b10float', success: false }, // rg11b10float is not renderable
  { format: 'rg8snorm', success: false }, // rg8snorm is not renderable
  { format: 'r8snorm', success: false }, // r8snorm is not renderable
  { format: 'rgba8snorm', success: false }, // rgba8snorm is not renderable
]);

// TODO: Add tests for compressed texture formats
