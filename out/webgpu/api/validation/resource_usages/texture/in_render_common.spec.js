/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
TODO:
- 2 views:
    - x= {upon the same subresource, or different subresources {mip level, array layer, aspect} of
         the same texture}
    - x= possible resource usages on each view:
         - both in bind group {texture_binding, storage_binding}
    - x= different shader stages: {0, ..., 7}
        - maybe first view vis = {1, 2, 4}, second view vis = {0, ..., 7}
    - x= bindings are in {
        - same draw call
        - same pass, different draw call
        - different pass
        - }
(It's probably not necessary to test EVERY possible combination of options in this whole
block, so we could break it down into a few smaller ones (one for different types of
subresources, one for same draw/same pass/different pass, one for visibilities).)
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { assert, unreachable } from '../../../../../common/util/util.js';
import { ValidationTest } from '../../validation_test.js';

class F extends ValidationTest {
  getColorAttachment(
  texture,
  textureViewDescriptor)
  {
    const view = texture.createView(textureViewDescriptor);

    return {
      view,
      clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store' };

  }

  createBindGroupForTest(
  textureView,
  textureUsage,
  sampleType)
  {
    const bindGroupLayoutEntry = {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT };

    switch (textureUsage) {
      case 'texture':
        bindGroupLayoutEntry.texture = { viewDimension: '2d-array', sampleType };
        break;
      case 'storage':
        bindGroupLayoutEntry.storageTexture = {
          access: 'write-only',
          format: 'rgba8unorm',
          viewDimension: '2d-array' };

        break;
      default:
        unreachable();
        break;}

    const layout = this.device.createBindGroupLayout({
      entries: [bindGroupLayoutEntry] });

    return this.device.createBindGroup({
      layout,
      entries: [{ binding: 0, resource: textureView }] });

  }

  isRangeNotOverlapped(start0, end0, start1, end1) {
    assert(start0 <= end0 && start1 <= end1);
    // There are only two possibilities for two non-overlapped ranges:
    // [start0, end0] [start1, end1] or
    // [start1, end1] [start0, end0]
    return end0 < start1 || end1 < start0;
  }}


export const g = makeTestGroup(F);

const kTextureSize = 16;
const kTextureLevels = 3;
const kTextureLayers = 3;

g.test('subresources_from_same_texture_as_color_attachments').
desc(
`
  Test that the different subresource of the same texture are allowed to be used as color
  attachments in same / different render pass encoder, while the same subresource is only allowed
  to be used as different color attachments in different render pass encoders.`).

params((u) =>
u.
combine('baseLayer0', [0, 1]).
combine('baseLevel0', [0, 1]).
combine('baseLayer1', [0, 1]).
combine('baseLevel1', [0, 1]).
combine('inSamePass', [true, false]).
unless((t) => t.inSamePass && t.baseLevel0 !== t.baseLevel1)).

fn(async (t) => {
  const { baseLayer0, baseLevel0, baseLayer1, baseLevel1, inSamePass } = t.params;

  const texture = t.device.createTexture({
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    size: [kTextureSize, kTextureSize, kTextureLayers],
    mipLevelCount: kTextureLevels });


  const colorAttachment1 = t.getColorAttachment(texture, {
    baseArrayLayer: baseLayer0,
    arrayLayerCount: 1,
    baseMipLevel: baseLevel0,
    mipLevelCount: 1 });

  const colorAttachment2 = t.getColorAttachment(texture, {
    baseArrayLayer: baseLayer1,
    baseMipLevel: baseLevel1,
    mipLevelCount: 1 });

  const encoder = t.device.createCommandEncoder();
  if (inSamePass) {
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [colorAttachment1, colorAttachment2] });

    renderPass.end();
  } else {
    const renderPass1 = encoder.beginRenderPass({
      colorAttachments: [colorAttachment1] });

    renderPass1.end();
    const renderPass2 = encoder.beginRenderPass({
      colorAttachments: [colorAttachment2] });

    renderPass2.end();
  }

  const success = inSamePass ? baseLayer0 !== baseLayer1 : true;
  t.expectValidationError(() => {
    encoder.finish();
  }, !success);
});

g.test('subresources_from_same_texture_as_color_attachment_and_in_bind_group').
desc(
`
  Test that when one subresource of a texture is used as a color attachment, it cannot be used in a
  bind group simultaneously in the same render pass encoder. It is allowed when the bind group is
  used in another render pass encoder instead of the same one.`).

params((u) =>
u.
combine('colorAttachmentLevel', [0, 1]).
combine('colorAttachmentLayer', [0, 1]).
combineWithParams([
{ bindGroupViewBaseLevel: 0, bindGroupViewLevelCount: 1 },
{ bindGroupViewBaseLevel: 1, bindGroupViewLevelCount: 1 },
{ bindGroupViewBaseLevel: 1, bindGroupViewLevelCount: 2 }]).

combineWithParams([
{ bindGroupViewBaseLayer: 0, bindGroupViewLayerCount: 1 },
{ bindGroupViewBaseLayer: 1, bindGroupViewLayerCount: 1 },
{ bindGroupViewBaseLayer: 1, bindGroupViewLayerCount: 2 }]).

combine('bindGroupUsage', ['texture', 'storage']).
unless((t) => t.bindGroupUsage === 'storage' && t.bindGroupViewLevelCount > 1).
combine('inSamePass', [true, false])).

fn(async (t) => {
  const {
    colorAttachmentLevel,
    colorAttachmentLayer,
    bindGroupViewBaseLevel,
    bindGroupViewLevelCount,
    bindGroupViewBaseLayer,
    bindGroupViewLayerCount,
    bindGroupUsage,
    inSamePass } =
  t.params;

  const texture = t.device.createTexture({
    format: 'rgba8unorm',
    usage:
    GPUTextureUsage.RENDER_ATTACHMENT |
    GPUTextureUsage.TEXTURE_BINDING |
    GPUTextureUsage.STORAGE_BINDING,
    size: [kTextureSize, kTextureSize, kTextureLayers],
    mipLevelCount: kTextureLevels });

  const bindGroupView = texture.createView({
    dimension: '2d-array',
    baseArrayLayer: bindGroupViewBaseLayer,
    arrayLayerCount: bindGroupViewLayerCount,
    baseMipLevel: bindGroupViewBaseLevel,
    mipLevelCount: bindGroupViewLevelCount });

  const bindGroup = t.createBindGroupForTest(bindGroupView, bindGroupUsage, 'float');

  const colorAttachment = t.getColorAttachment(texture, {
    baseArrayLayer: colorAttachmentLayer,
    arrayLayerCount: 1,
    baseMipLevel: colorAttachmentLevel,
    mipLevelCount: 1 });


  const encoder = t.device.createCommandEncoder();
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [colorAttachment] });

  if (inSamePass) {
    renderPass.setBindGroup(0, bindGroup);
    renderPass.end();
  } else {
    renderPass.end();

    const texture2 = t.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [kTextureSize, kTextureSize, 1],
      mipLevelCount: 1 });

    const colorAttachment2 = t.getColorAttachment(texture2);
    const renderPass2 = encoder.beginRenderPass({
      colorAttachments: [colorAttachment2] });

    renderPass2.setBindGroup(0, bindGroup);
    renderPass2.end();
  }

  const isMipLevelNotOverlapped = t.isRangeNotOverlapped(
  colorAttachmentLevel,
  colorAttachmentLevel,
  bindGroupViewBaseLevel,
  bindGroupViewBaseLevel + bindGroupViewLevelCount - 1);

  const isArrayLayerNotOverlapped = t.isRangeNotOverlapped(
  colorAttachmentLayer,
  colorAttachmentLayer,
  bindGroupViewBaseLayer,
  bindGroupViewBaseLayer + bindGroupViewLayerCount - 1);

  const isNotOverlapped = isMipLevelNotOverlapped || isArrayLayerNotOverlapped;

  const success = inSamePass ? isNotOverlapped : true;
  t.expectValidationError(() => {
    encoder.finish();
  }, !success);
});

g.test('subresources_from_same_texture_as_depth_stencil_attachment_and_in_bind_group').
desc(
`
  Test that when one subresource of a texture is used as a depth stencil attachment, it cannot be
  used in a bind group simultaneously in the same render pass encoder. It is allowed when the bind
  group is used in another render pass encoder instead of the same one, or the subresource is used
  as a read-only depth stencil attachment.`).

params((u) =>
u.
combine('depthStencilAttachmentLevel', [0, 1]).
combine('depthStencilAttachmentLayer', [0, 1]).
combineWithParams([
{ bindGroupViewBaseLevel: 0, bindGroupViewLevelCount: 1 },
{ bindGroupViewBaseLevel: 1, bindGroupViewLevelCount: 1 },
{ bindGroupViewBaseLevel: 1, bindGroupViewLevelCount: 2 }]).

combineWithParams([
{ bindGroupViewBaseLayer: 0, bindGroupViewLayerCount: 1 },
{ bindGroupViewBaseLayer: 1, bindGroupViewLayerCount: 1 },
{ bindGroupViewBaseLayer: 1, bindGroupViewLayerCount: 2 }]).

combine('depthStencilReadOnly', [true, false]).
combine('bindGroupAspect', ['depth-only', 'stencil-only']).
combine('inSamePass', [true, false])).

fn(async (t) => {
  const {
    depthStencilAttachmentLevel,
    depthStencilAttachmentLayer,
    bindGroupViewBaseLevel,
    bindGroupViewLevelCount,
    bindGroupViewBaseLayer,
    bindGroupViewLayerCount,
    depthStencilReadOnly,
    bindGroupAspect,
    inSamePass } =
  t.params;

  const texture = t.device.createTexture({
    format: 'depth24plus-stencil8',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    size: [kTextureSize, kTextureSize, kTextureLayers],
    mipLevelCount: kTextureLevels });

  const bindGroupView = texture.createView({
    dimension: '2d-array',
    baseArrayLayer: bindGroupViewBaseLayer,
    arrayLayerCount: bindGroupViewLayerCount,
    baseMipLevel: bindGroupViewBaseLevel,
    mipLevelCount: bindGroupViewLevelCount,
    aspect: bindGroupAspect });

  const sampleType = bindGroupAspect === 'depth-only' ? 'depth' : 'uint';
  const bindGroup = t.createBindGroupForTest(bindGroupView, 'texture', sampleType);

  const attachmentView = texture.createView({
    baseArrayLayer: depthStencilAttachmentLayer,
    arrayLayerCount: 1,
    baseMipLevel: depthStencilAttachmentLevel,
    mipLevelCount: 1 });

  const depthStencilAttachment = {
    view: attachmentView,
    depthReadOnly: depthStencilReadOnly,
    depthLoadOp: 'load',
    depthStoreOp: 'store',
    stencilReadOnly: depthStencilReadOnly,
    stencilLoadOp: 'load',
    stencilStoreOp: 'store' };


  const encoder = t.device.createCommandEncoder();
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [],
    depthStencilAttachment });

  if (inSamePass) {
    renderPass.setBindGroup(0, bindGroup);
    renderPass.end();
  } else {
    renderPass.end();

    const texture2 = t.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [kTextureSize, kTextureSize, 1],
      mipLevelCount: 1 });

    const colorAttachment2 = t.getColorAttachment(texture2);
    const renderPass2 = encoder.beginRenderPass({
      colorAttachments: [colorAttachment2] });

    renderPass2.setBindGroup(0, bindGroup);
    renderPass2.end();
  }

  const isMipLevelNotOverlapped = t.isRangeNotOverlapped(
  depthStencilAttachmentLevel,
  depthStencilAttachmentLevel,
  bindGroupViewBaseLevel,
  bindGroupViewBaseLevel + bindGroupViewLevelCount - 1);

  const isArrayLayerNotOverlapped = t.isRangeNotOverlapped(
  depthStencilAttachmentLayer,
  depthStencilAttachmentLayer,
  bindGroupViewBaseLayer,
  bindGroupViewBaseLayer + bindGroupViewLayerCount - 1);

  const isNotOverlapped = isMipLevelNotOverlapped || isArrayLayerNotOverlapped;

  const success = !inSamePass || isNotOverlapped || depthStencilReadOnly;
  t.expectValidationError(() => {
    encoder.finish();
  }, !success);
});

g.test('subresources_from_same_color_texture_in_bind_groups').
desc(
`
  Test that when one color texture subresource is bound to different bind groups, its list of
  internal usages within one usage scope can only be a compatible usage list. For texture
  subresources in bind groups, the compatible usage lists are {TEXTURE_BINDING} and
  {STORAGE_BINDING}, which means it can only be bound as both TEXTURE_BINDING and STORAGE_BINDING in
  different render pass encoders, otherwise a validation error will occur.`).

params((u) =>
u.
combineWithParams([
{ bindGroupView0BaseLevel: 0, bindGroupView0LevelCount: 1 },
{ bindGroupView0BaseLevel: 1, bindGroupView0LevelCount: 1 },
{ bindGroupView0BaseLevel: 1, bindGroupView0LevelCount: 2 }]).

combineWithParams([
{ bindGroupView0BaseLayer: 0, bindGroupView0LayerCount: 1 },
{ bindGroupView0BaseLayer: 1, bindGroupView0LayerCount: 1 },
{ bindGroupView0BaseLayer: 1, bindGroupView0LayerCount: 2 }]).

combineWithParams([
{ bindGroupView1BaseLevel: 0, bindGroupView1LevelCount: 1 },
{ bindGroupView1BaseLevel: 1, bindGroupView1LevelCount: 1 },
{ bindGroupView1BaseLevel: 1, bindGroupView1LevelCount: 2 }]).

combineWithParams([
{ bindGroupView1BaseLayer: 0, bindGroupView1LayerCount: 1 },
{ bindGroupView1BaseLayer: 1, bindGroupView1LayerCount: 1 },
{ bindGroupView1BaseLayer: 1, bindGroupView1LayerCount: 2 }]).

combine('bindGroupUsage0', ['texture', 'storage']).
combine('bindGroupUsage1', ['texture', 'storage']).
unless(
(t) =>
t.bindGroupUsage0 === 'storage' && t.bindGroupView0LevelCount > 1 ||
t.bindGroupUsage1 === 'storage' && t.bindGroupView1LevelCount > 1).

combine('inSamePass', [true, false])).

fn(async (t) => {
  const {
    bindGroupView0BaseLevel,
    bindGroupView0LevelCount,
    bindGroupView0BaseLayer,
    bindGroupView0LayerCount,
    bindGroupView1BaseLevel,
    bindGroupView1LevelCount,
    bindGroupView1BaseLayer,
    bindGroupView1LayerCount,
    bindGroupUsage0,
    bindGroupUsage1,
    inSamePass } =
  t.params;

  const texture = t.device.createTexture({
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    size: [kTextureSize, kTextureSize, kTextureLayers],
    mipLevelCount: kTextureLevels });

  const bindGroupView0 = texture.createView({
    dimension: '2d-array',
    baseArrayLayer: bindGroupView0BaseLayer,
    arrayLayerCount: bindGroupView0LayerCount,
    baseMipLevel: bindGroupView0BaseLevel,
    mipLevelCount: bindGroupView0LevelCount });

  const bindGroupView1 = texture.createView({
    dimension: '2d-array',
    baseArrayLayer: bindGroupView1BaseLayer,
    arrayLayerCount: bindGroupView1LayerCount,
    baseMipLevel: bindGroupView1BaseLevel,
    mipLevelCount: bindGroupView1LevelCount });

  const bindGroup0 = t.createBindGroupForTest(bindGroupView0, bindGroupUsage0, 'float');
  const bindGroup1 = t.createBindGroupForTest(bindGroupView1, bindGroupUsage1, 'float');

  const colorTexture = t.device.createTexture({
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    size: [kTextureSize, kTextureSize, 1],
    mipLevelCount: 1 });

  const colorAttachment = t.getColorAttachment(colorTexture);
  const encoder = t.device.createCommandEncoder();
  const renderPass = encoder.beginRenderPass({
    colorAttachments: [colorAttachment] });

  if (inSamePass) {
    renderPass.setBindGroup(0, bindGroup0);
    renderPass.setBindGroup(1, bindGroup1);
    renderPass.end();
  } else {
    renderPass.setBindGroup(0, bindGroup0);
    renderPass.end();

    const renderPass2 = encoder.beginRenderPass({
      colorAttachments: [colorAttachment] });

    renderPass2.setBindGroup(1, bindGroup1);
    renderPass2.end();
  }

  const isMipLevelNotOverlapped = t.isRangeNotOverlapped(
  bindGroupView0BaseLevel,
  bindGroupView0BaseLevel + bindGroupView0LevelCount - 1,
  bindGroupView1BaseLevel,
  bindGroupView1BaseLevel + bindGroupView1LevelCount - 1);

  const isArrayLayerNotOverlapped = t.isRangeNotOverlapped(
  bindGroupView0BaseLayer,
  bindGroupView0BaseLayer + bindGroupView0LayerCount - 1,
  bindGroupView1BaseLayer,
  bindGroupView1BaseLayer + bindGroupView1LayerCount - 1);

  const isNotOverlapped = isMipLevelNotOverlapped || isArrayLayerNotOverlapped;

  const success = !inSamePass || isNotOverlapped || bindGroupUsage0 === bindGroupUsage1;
  t.expectValidationError(() => {
    encoder.finish();
  }, !success);
});
//# sourceMappingURL=in_render_common.spec.js.map