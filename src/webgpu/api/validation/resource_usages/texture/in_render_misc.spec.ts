export const description = `
TODO:
- 2 views: upon the same subresource, or different subresources of the same texture
    - texture usages in copies and in render pass
    - unused bind groups
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { unreachable } from '../../../../../common/util/util.js';
import { ValidationTest } from '../../validation_test.js';

class F extends ValidationTest {
  createBindGroupForTest(
    textureView: GPUTextureView,
    textureUsage: 'texture' | 'storage',
    sampleType: 'float' | 'depth' | 'uint'
  ) {
    const bindGroupLayoutEntry: GPUBindGroupLayoutEntry = {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
    };
    switch (textureUsage) {
      case 'texture':
        bindGroupLayoutEntry.texture = { viewDimension: '2d-array', sampleType };
        break;
      case 'storage':
        bindGroupLayoutEntry.storageTexture = {
          access: 'write-only',
          format: 'rgba8unorm',
          viewDimension: '2d-array',
        };
        break;
      default:
        unreachable();
        break;
    }
    const layout = this.device.createBindGroupLayout({
      entries: [bindGroupLayoutEntry],
    });
    return this.device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: textureView }],
    });
  }
}

export const g = makeTestGroup(F);

const kTextureSize = 16;
const kTextureLayers = 3;

g.test('subresources,set_bind_group_on_same_index_color_texture')
  .desc(
    `
  Test that when one color texture subresource is bound to different bind groups, whether the
  conflicted bind groups are reset by another compatible ones or not, its list of internal usages
  within one usage scope can only be a compatible usage list.`
  )
  .params(u =>
    u.combineWithParams([
      { useDifferentTextureAsTexture2: true, baseLayer2: 0, view2Binding: 'texture' },
      { useDifferentTextureAsTexture2: false, baseLayer2: 0, view2Binding: 'texture' },
      { useDifferentTextureAsTexture2: false, baseLayer2: 1, view2Binding: 'texture' },
      { useDifferentTextureAsTexture2: false, baseLayer2: 0, view2Binding: 'storage' },
      { useDifferentTextureAsTexture2: false, baseLayer2: 1, view2Binding: 'storage' },
    ] as const)
  )
  .fn(async t => {
    const { useDifferentTextureAsTexture2, baseLayer2, view2Binding } = t.params;

    const texture0 = t.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      size: [kTextureSize, kTextureSize, kTextureLayers],
    });
    // We always bind the first layer of the texture to bindGroup0.
    const textureView0 = texture0.createView({
      dimension: '2d-array',
      baseArrayLayer: 0,
      arrayLayerCount: 1,
    });
    const bindGroup0 = t.createBindGroupForTest(textureView0, view2Binding, 'float');

    // In one renderPassEncoder it is an error to set both conflictedBindGroup and bindGroup0.
    const view1Binding = view2Binding === 'texture' ? 'storage' : 'texture';
    const conflictedBindGroup = t.createBindGroupForTest(textureView0, view1Binding, 'float');

    const texture2 = useDifferentTextureAsTexture2
      ? t.device.createTexture({
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
          size: [kTextureSize, kTextureSize, kTextureLayers],
        })
      : texture0;
    const textureView2 = texture2.createView({
      dimension: '2d-array',
      baseArrayLayer: baseLayer2,
      arrayLayerCount: kTextureLayers - baseLayer2,
    });
    // There should be no conflict between bindGroup0 and validBindGroup2.
    const validBindGroup2 = t.createBindGroupForTest(textureView2, view2Binding, 'float');

    const colorTexture = t.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [kTextureSize, kTextureSize, 1],
    });
    const encoder = t.device.createCommandEncoder();
    const renderPassEncoder = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorTexture.createView(),
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
    });
    renderPassEncoder.setBindGroup(0, bindGroup0);
    renderPassEncoder.setBindGroup(1, conflictedBindGroup);
    renderPassEncoder.setBindGroup(1, validBindGroup2);
    renderPassEncoder.end();

    t.expectValidationError(() => {
      encoder.finish();
    }, true);
  });
