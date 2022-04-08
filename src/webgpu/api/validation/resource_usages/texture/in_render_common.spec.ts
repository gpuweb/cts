export const description = `
Texture Usages Validation Tests in Same or Different Render Pass Encoders.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert, unreachable } from '../../../../../common/util/util.js';
import { ValidationTest } from '../../validation_test.js';

class F extends ValidationTest {
  getColorAttachment(
    texture: GPUTexture,
    textureViewDescriptor?: GPUTextureViewDescriptor
  ): GPURenderPassColorAttachment {
    const view = texture.createView(textureViewDescriptor);

    return {
      view,
      clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store',
    };
  }

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

  isRangeNotOverlapped(start0: number, end0: number, start1: number, end1: number): boolean {
    assert(start0 <= end0 && start1 <= end1);
    // There are only two possibilities for two non-overlapped ranges:
    // [start0, end0] [start1, end1] or
    // [start1, end1] [start0, end0]
    return end0 < start1 || end1 < start0;
  }
}

export const g = makeTestGroup(F);

const kTextureSize = 16;
const kTextureLevels = 3;
const kTextureLayers = 3;

g.test('subresources,color_attachments')
  .desc(
    `
  Test that the different subresource of the same texture are allowed to be used as color
  attachments in same / different render pass encoder, while the same subresource is only allowed
  to be used as different color attachments in different render pass encoders.`
  )
  .params(u =>
    u
      .combine('layer0', [0, 1])
      .combine('level0', [0, 1])
      .combine('layer1', [0, 1])
      .combine('level1', [0, 1])
      .combine('inSamePass', [true, false])
      .unless(t => t.inSamePass && t.level0 !== t.level1)
  )
  .fn(async t => {
    const { layer0, level0, layer1, level1, inSamePass } = t.params;

    const texture = t.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [kTextureSize, kTextureSize, kTextureLayers],
      mipLevelCount: kTextureLevels,
    });

    const colorAttachment1 = t.getColorAttachment(texture, {
      baseArrayLayer: layer0,
      arrayLayerCount: 1,
      baseMipLevel: level0,
      mipLevelCount: 1,
    });
    const colorAttachment2 = t.getColorAttachment(texture, {
      baseArrayLayer: layer1,
      baseMipLevel: level1,
      mipLevelCount: 1,
    });
    const encoder = t.device.createCommandEncoder();
    if (inSamePass) {
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [colorAttachment1, colorAttachment2],
      });
      renderPass.end();
    } else {
      const renderPass1 = encoder.beginRenderPass({
        colorAttachments: [colorAttachment1],
      });
      renderPass1.end();
      const renderPass2 = encoder.beginRenderPass({
        colorAttachments: [colorAttachment2],
      });
      renderPass2.end();
    }

    const success = inSamePass ? layer0 !== layer1 : true;
    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('subresources,color_attachment_and_bind_group')
  .desc(
    `
  Test that when one subresource of a texture is used as a color attachment, it cannot be used in a
  bind group simultaneously in the same render pass encoder. It is allowed when the bind group is
  used in another render pass encoder instead of the same one.`
  )
  .params(u =>
    u
      .combine('colorAttachmentLevel', [0, 1])
      .combine('colorAttachmentLayer', [0, 1])
      .combineWithParams([
        { bgLevel: 0, bgLevelCount: 1 },
        { bgLevel: 1, bgLevelCount: 1 },
        { bgLevel: 1, bgLevelCount: 2 },
      ])
      .combineWithParams([
        { bgLayer: 0, bgLayerCount: 1 },
        { bgLayer: 1, bgLayerCount: 1 },
        { bgLayer: 1, bgLayerCount: 2 },
      ])
      .combine('bgUsage', ['texture', 'storage'] as const)
      .unless(t => t.bgUsage === 'storage' && t.bgLevelCount > 1)
      .combine('inSamePass', [true, false])
  )
  .fn(async t => {
    const {
      colorAttachmentLevel,
      colorAttachmentLayer,
      bgLevel,
      bgLevelCount,
      bgLayer,
      bgLayerCount,
      bgUsage,
      inSamePass,
    } = t.params;

    const texture = t.device.createTexture({
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING,
      size: [kTextureSize, kTextureSize, kTextureLayers],
      mipLevelCount: kTextureLevels,
    });
    const bindGroupView = texture.createView({
      dimension: '2d-array',
      baseArrayLayer: bgLayer,
      arrayLayerCount: bgLayerCount,
      baseMipLevel: bgLevel,
      mipLevelCount: bgLevelCount,
    });
    const bindGroup = t.createBindGroupForTest(bindGroupView, bgUsage, 'float');

    const colorAttachment = t.getColorAttachment(texture, {
      baseArrayLayer: colorAttachmentLayer,
      arrayLayerCount: 1,
      baseMipLevel: colorAttachmentLevel,
      mipLevelCount: 1,
    });

    const encoder = t.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [colorAttachment],
    });
    if (inSamePass) {
      renderPass.setBindGroup(0, bindGroup);
      renderPass.end();
    } else {
      renderPass.end();

      const texture2 = t.device.createTexture({
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [kTextureSize, kTextureSize, 1],
        mipLevelCount: 1,
      });
      const colorAttachment2 = t.getColorAttachment(texture2);
      const renderPass2 = encoder.beginRenderPass({
        colorAttachments: [colorAttachment2],
      });
      renderPass2.setBindGroup(0, bindGroup);
      renderPass2.end();
    }

    const isMipLevelNotOverlapped = t.isRangeNotOverlapped(
      colorAttachmentLevel,
      colorAttachmentLevel,
      bgLevel,
      bgLevel + bgLevelCount - 1
    );
    const isArrayLayerNotOverlapped = t.isRangeNotOverlapped(
      colorAttachmentLayer,
      colorAttachmentLayer,
      bgLayer,
      bgLayer + bgLayerCount - 1
    );
    const isNotOverlapped = isMipLevelNotOverlapped || isArrayLayerNotOverlapped;

    const success = inSamePass ? isNotOverlapped : true;
    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('subresources,depth_stencil_attachment_and_bind_group')
  .desc(
    `
  Test that when one subresource of a texture is used as a depth stencil attachment, it cannot be
  used in a bind group simultaneously in the same render pass encoder. It is allowed when the bind
  group is used in another render pass encoder instead of the same one, or the subresource is used
  as a read-only depth stencil attachment.`
  )
  .params(u =>
    u
      .combine('dsLevel', [0, 1])
      .combine('dsLayer', [0, 1])
      .combineWithParams([
        { bgLevel: 0, bgLevelCount: 1 },
        { bgLevel: 1, bgLevelCount: 1 },
        { bgLevel: 1, bgLevelCount: 2 },
      ])
      .combineWithParams([
        { bgLayer: 0, bgLayerCount: 1 },
        { bgLayer: 1, bgLayerCount: 1 },
        { bgLayer: 1, bgLayerCount: 2 },
      ])
      .combine('dsReadOnly', [true, false])
      .combine('bgAspect', ['depth-only', 'stencil-only'] as const)
      .combine('inSamePass', [true, false])
  )
  .fn(async t => {
    const {
      dsLevel,
      dsLayer,
      bgLevel,
      bgLevelCount,
      bgLayer,
      bgLayerCount,
      dsReadOnly,
      bgAspect,
      inSamePass,
    } = t.params;

    const texture = t.device.createTexture({
      format: 'depth24plus-stencil8',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      size: [kTextureSize, kTextureSize, kTextureLayers],
      mipLevelCount: kTextureLevels,
    });
    const bindGroupView = texture.createView({
      dimension: '2d-array',
      baseArrayLayer: bgLayer,
      arrayLayerCount: bgLayerCount,
      baseMipLevel: bgLevel,
      mipLevelCount: bgLevelCount,
      aspect: bgAspect,
    });
    const sampleType = bgAspect === 'depth-only' ? 'depth' : 'uint';
    const bindGroup = t.createBindGroupForTest(bindGroupView, 'texture', sampleType);

    const attachmentView = texture.createView({
      baseArrayLayer: dsLayer,
      arrayLayerCount: 1,
      baseMipLevel: dsLevel,
      mipLevelCount: 1,
    });
    const depthStencilAttachment: GPURenderPassDepthStencilAttachment = {
      view: attachmentView,
      depthReadOnly: dsReadOnly,
      depthLoadOp: 'load',
      depthStoreOp: 'store',
      stencilReadOnly: dsReadOnly,
      stencilLoadOp: 'load',
      stencilStoreOp: 'store',
    };

    const encoder = t.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment,
    });
    if (inSamePass) {
      renderPass.setBindGroup(0, bindGroup);
      renderPass.end();
    } else {
      renderPass.end();

      const texture2 = t.device.createTexture({
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [kTextureSize, kTextureSize, 1],
        mipLevelCount: 1,
      });
      const colorAttachment2 = t.getColorAttachment(texture2);
      const renderPass2 = encoder.beginRenderPass({
        colorAttachments: [colorAttachment2],
      });
      renderPass2.setBindGroup(0, bindGroup);
      renderPass2.end();
    }

    const isMipLevelNotOverlapped = t.isRangeNotOverlapped(
      dsLevel,
      dsLevel,
      bgLevel,
      bgLevel + bgLevelCount - 1
    );
    const isArrayLayerNotOverlapped = t.isRangeNotOverlapped(
      dsLayer,
      dsLayer,
      bgLayer,
      bgLayer + bgLayerCount - 1
    );
    const isNotOverlapped = isMipLevelNotOverlapped || isArrayLayerNotOverlapped;

    const success = !inSamePass || isNotOverlapped || dsReadOnly;
    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('subresources,multiple_bind_groups')
  .desc(
    `
  Test that when one color texture subresource is bound to different bind groups, its list of
  internal usages within one usage scope can only be a compatible usage list. For texture
  subresources in bind groups, the compatible usage lists are {TEXTURE_BINDING} and
  {STORAGE_BINDING}, which means it can only be bound as both TEXTURE_BINDING and STORAGE_BINDING in
  different render pass encoders, otherwise a validation error will occur.`
  )
  .params(u =>
    u
      .combineWithParams([
        { bg0BaseLevel: 0, bg0LevelCount: 1 },
        { bg0BaseLevel: 1, bg0LevelCount: 1 },
        { bg0BaseLevel: 1, bg0LevelCount: 2 },
      ])
      .combineWithParams([
        { bg0BaseLayer: 0, bg0LayerCount: 1 },
        { bg0BaseLayer: 1, bg0LayerCount: 1 },
        { bg0BaseLayer: 1, bg0LayerCount: 2 },
      ])
      .combineWithParams([
        { bg1BaseLevel: 0, bg1LevelCount: 1 },
        { bg1BaseLevel: 1, bg1LevelCount: 1 },
        { bg1BaseLevel: 1, bg1LevelCount: 2 },
      ])
      .combineWithParams([
        { bg1BaseLayer: 0, bg1LayerCount: 1 },
        { bg1BaseLayer: 1, bg1LayerCount: 1 },
        { bg1BaseLayer: 1, bg1LayerCount: 2 },
      ])
      .combine('bgUsage0', ['texture', 'storage'] as const)
      .combine('bgUsage1', ['texture', 'storage'] as const)
      .unless(
        t =>
          (t.bgUsage0 === 'storage' && t.bg0LevelCount > 1) ||
          (t.bgUsage1 === 'storage' && t.bg1LevelCount > 1)
      )
      .combine('inSamePass', [true, false])
  )
  .fn(async t => {
    const {
      bg0BaseLevel,
      bg0LevelCount,
      bg0BaseLayer,
      bg0LayerCount,
      bg1BaseLevel,
      bg1LevelCount,
      bg1BaseLayer,
      bg1LayerCount,
      bgUsage0,
      bgUsage1,
      inSamePass,
    } = t.params;

    const texture = t.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      size: [kTextureSize, kTextureSize, kTextureLayers],
      mipLevelCount: kTextureLevels,
    });
    const bg0 = texture.createView({
      dimension: '2d-array',
      baseArrayLayer: bg0BaseLayer,
      arrayLayerCount: bg0LayerCount,
      baseMipLevel: bg0BaseLevel,
      mipLevelCount: bg0LevelCount,
    });
    const bg1 = texture.createView({
      dimension: '2d-array',
      baseArrayLayer: bg1BaseLayer,
      arrayLayerCount: bg1LayerCount,
      baseMipLevel: bg1BaseLevel,
      mipLevelCount: bg1LevelCount,
    });
    const bindGroup0 = t.createBindGroupForTest(bg0, bgUsage0, 'float');
    const bindGroup1 = t.createBindGroupForTest(bg1, bgUsage1, 'float');

    const colorTexture = t.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [kTextureSize, kTextureSize, 1],
      mipLevelCount: 1,
    });
    const colorAttachment = t.getColorAttachment(colorTexture);
    const encoder = t.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [colorAttachment],
    });
    if (inSamePass) {
      renderPass.setBindGroup(0, bindGroup0);
      renderPass.setBindGroup(1, bindGroup1);
      renderPass.end();
    } else {
      renderPass.setBindGroup(0, bindGroup0);
      renderPass.end();

      const renderPass2 = encoder.beginRenderPass({
        colorAttachments: [colorAttachment],
      });
      renderPass2.setBindGroup(1, bindGroup1);
      renderPass2.end();
    }

    const isMipLevelNotOverlapped = t.isRangeNotOverlapped(
      bg0BaseLevel,
      bg0BaseLevel + bg0LevelCount - 1,
      bg1BaseLevel,
      bg1BaseLevel + bg1LevelCount - 1
    );
    const isArrayLayerNotOverlapped = t.isRangeNotOverlapped(
      bg0BaseLayer,
      bg0BaseLayer + bg0LayerCount - 1,
      bg1BaseLayer,
      bg1BaseLayer + bg1LayerCount - 1
    );
    const isNotOverlapped = isMipLevelNotOverlapped || isArrayLayerNotOverlapped;

    const success = !inSamePass || isNotOverlapped || bgUsage0 === bgUsage1;
    t.expectValidationError(() => {
      encoder.finish();
    }, !success);
  });

g.test('subresources_from_same_depth_stencil_texture_in_bind_groups')
  .desc(
    `
  Test that when one depth stencil texture subresource is bound to different bind groups, we can
  always bind these two bind groups in either the same or different render pass encoder as the depth
  stencil texture can only be bound as TEXTURE_BINDING in the bind group.`
  )
  .params(u =>
    u
      .combineWithParams([
        { bindGroupView0BaseLevel: 0, bindGroupView0LevelCount: 1 },
        { bindGroupView0BaseLevel: 1, bindGroupView0LevelCount: 1 },
        { bindGroupView0BaseLevel: 1, bindGroupView0LevelCount: 2 },
      ])
      .combineWithParams([
        { bindGroupView0BaseLayer: 0, bindGroupView0LayerCount: 1 },
        { bindGroupView0BaseLayer: 1, bindGroupView0LayerCount: 1 },
        { bindGroupView0BaseLayer: 1, bindGroupView0LayerCount: 2 },
      ])
      .combineWithParams([
        { bindGroupView1BaseLevel: 0, bindGroupView1LevelCount: 1 },
        { bindGroupView1BaseLevel: 1, bindGroupView1LevelCount: 1 },
        { bindGroupView1BaseLevel: 1, bindGroupView1LevelCount: 2 },
      ])
      .combineWithParams([
        { bindGroupView1BaseLayer: 0, bindGroupView1LayerCount: 1 },
        { bindGroupView1BaseLayer: 1, bindGroupView1LayerCount: 1 },
        { bindGroupView1BaseLayer: 1, bindGroupView1LayerCount: 2 },
      ])
      .combine('bindGroupAspect0', ['depth-only', 'stencil-only'] as const)
      .combine('bindGroupAspect1', ['depth-only', 'stencil-only'] as const)
      .combine('inSamePass', [true, false])
  )
  .fn(async t => {
    const {
      bindGroupView0BaseLevel,
      bindGroupView0LevelCount,
      bindGroupView0BaseLayer,
      bindGroupView0LayerCount,
      bindGroupView1BaseLevel,
      bindGroupView1LevelCount,
      bindGroupView1BaseLayer,
      bindGroupView1LayerCount,
      bindGroupAspect0,
      bindGroupAspect1,
      inSamePass,
    } = t.params;

    const texture = t.device.createTexture({
      format: 'depth24plus-stencil8',
      usage: GPUTextureUsage.TEXTURE_BINDING,
      size: [kTextureSize, kTextureSize, kTextureLayers],
      mipLevelCount: kTextureLevels,
    });
    const bindGroupView0 = texture.createView({
      dimension: '2d-array',
      baseArrayLayer: bindGroupView0BaseLayer,
      arrayLayerCount: bindGroupView0LayerCount,
      baseMipLevel: bindGroupView0BaseLevel,
      mipLevelCount: bindGroupView0LevelCount,
      aspect: bindGroupAspect0,
    });
    const bindGroupView1 = texture.createView({
      dimension: '2d-array',
      baseArrayLayer: bindGroupView1BaseLayer,
      arrayLayerCount: bindGroupView1LayerCount,
      baseMipLevel: bindGroupView1BaseLevel,
      mipLevelCount: bindGroupView1LevelCount,
      aspect: bindGroupAspect1,
    });

    const sampleType0 = bindGroupAspect0 === 'depth-only' ? 'depth' : 'uint';
    const sampleType1 = bindGroupAspect1 === 'depth-only' ? 'depth' : 'uint';
    const bindGroup0 = t.createBindGroupForTest(bindGroupView0, 'texture', sampleType0);
    const bindGroup1 = t.createBindGroupForTest(bindGroupView1, 'texture', sampleType1);

    const colorTexture = t.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [kTextureSize, kTextureSize, 1],
      mipLevelCount: 1,
    });
    const colorAttachment = t.getColorAttachment(colorTexture);
    const encoder = t.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [colorAttachment],
    });
    if (inSamePass) {
      renderPass.setBindGroup(0, bindGroup0);
      renderPass.setBindGroup(1, bindGroup1);
      renderPass.end();
    } else {
      renderPass.setBindGroup(0, bindGroup0);
      renderPass.end();

      const renderPass2 = encoder.beginRenderPass({
        colorAttachments: [colorAttachment],
      });
      renderPass2.setBindGroup(1, bindGroup1);
      renderPass2.end();
    }

    t.expectValidationError(() => {
      encoder.finish();
    }, false);
  });
