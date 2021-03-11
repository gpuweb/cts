export const description = `
Destroying a texture more than once is allowed.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUConst } from '../../../constants.js';
import { ValidationTest } from '../validation_test.js';

const descriptor: GPUTextureDescriptor = {
  size: [1, 1, 1],
  format: 'rgba8unorm',
  usage: GPUConst.TextureUsage.RENDER_ATTACHMENT | GPUConst.TextureUsage.SAMPLED,
};

export const g = makeTestGroup(ValidationTest);

g.test('it_is_valid_to_destroy_a_texture').fn(t => {
  const texture = t.device.createTexture(descriptor);
  texture.destroy();
});

g.test('it_is_valid_to_destroy_a_destroyed_texture').fn(t => {
  const texture = t.device.createTexture(descriptor);
  texture.destroy();
  texture.destroy();
});

g.test('it_is_invalid_to_submit_a_destroyed_texture_before_and_after_encode')
  .params([
    { destroyBeforeEncode: false, destroyAfterEncode: false, _success: true },
    { destroyBeforeEncode: true, destroyAfterEncode: false, _success: false },
    { destroyBeforeEncode: false, destroyAfterEncode: true, _success: false },
  ])
  .fn(async t => {
    const { destroyBeforeEncode, destroyAfterEncode, _success } = t.params;

    const texture = t.device.createTexture(descriptor);
    const textureView = texture.createView();

    if (destroyBeforeEncode) {
      texture.destroy();
    }

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

    if (destroyAfterEncode) {
      texture.destroy();
    }

    t.expectValidationError(() => {
      t.queue.submit([commandBuffer]);
    }, !_success);
  });
