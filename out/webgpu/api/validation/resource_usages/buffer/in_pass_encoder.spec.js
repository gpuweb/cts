/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Buffer Usages Validation Tests in Render Pass and Compute Pass.
`;import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { unreachable } from '../../../../../common/util/util.js';
import { ValidationTest } from '../../validation_test.js';

const kBoundBufferSize = 256;

class F extends ValidationTest {
  createBindGroupForTest(
  buffer,
  offset,
  type,
  resourceVisibility)
  {
    const bindGroupLayoutEntry = {
      binding: 0,
      visibility:
      resourceVisibility === 'compute' ? GPUShaderStage.COMPUTE : GPUShaderStage.FRAGMENT,
      buffer: {
        type } };


    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [bindGroupLayoutEntry] });


    return this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
      {
        binding: 0,
        resource: { buffer, offset, size: kBoundBufferSize } }] });



  }

  beginSimpleRenderPass(encoder) {
    const colorTexture = this.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [16, 16, 1] });

    return encoder.beginRenderPass({
      colorAttachments: [
      {
        view: colorTexture.createView(),
        loadOp: 'load',
        storeOp: 'store' }] });



  }}


function IsBufferUsageInBindGroup(
bufferUsage)







{
  switch (bufferUsage) {
    case 'uniform':
    case 'storage':
    case 'read-only-storage':
      return true;
    case 'vertex':
    case 'index':
    case 'indirect':
    case 'indexedIndirect':
      return false;
    default:
      unreachable();}

}

export const g = makeTestGroup(F);

g.test('subresources,buffer_usage_in_render_pass').
desc(
`
Test that when one buffer is used in one render pass encoder, its list of internal usages within one
usage scope can only be a compatible usage list; while there is no such restriction when it is used
in different render pass encoders. The usage scope rules are not related to the buffer offset or the
bind group layout visibility.`).

params((u) =>
u.
combine('inSamePass', [true, false]).
combine('hasOverlap', [true, false]).
beginSubcases().
combine('usage0', [
'uniform',
'storage',
'read-only-storage',
'vertex',
'index',
'indirect',
'indexedIndirect']).

combine('visibility0', ['compute', 'fragment']).
unless((t) => t.visibility0 === 'compute' && !IsBufferUsageInBindGroup(t.usage0)).
combine('usage1', [
'uniform',
'storage',
'read-only-storage',
'vertex',
'index',
'indirect',
'indexedIndirect']).

combine('visibility1', ['compute', 'fragment'])
// The situation that the index buffer is reset by another setIndexBuffer call will be tested
// in another test case.
.unless(
(t) =>
t.visibility1 === 'compute' && !IsBufferUsageInBindGroup(t.usage1) ||
t.usage0 === 'index' && t.usage1 === 'index')).


fn(async (t) => {
  const { usage0, visibility0, usage1, visibility1, inSamePass, hasOverlap } = t.params;

  const UseBufferOnRenderPassEncoder = (
  buffer,
  index,
  offset,
  type,







  bindGroupVisibility,
  renderPassEncoder) =>
  {
    switch (type) {
      case 'uniform':
      case 'storage':
      case 'read-only-storage':{
          const bindGroup = t.createBindGroupForTest(buffer, offset, type, bindGroupVisibility);
          renderPassEncoder.setBindGroup(index, bindGroup);
          break;
        }
      case 'vertex':{
          renderPassEncoder.setVertexBuffer(index, buffer, offset, kBoundBufferSize);
          break;
        }
      case 'index':{
          renderPassEncoder.setIndexBuffer(buffer, 'uint16', offset, kBoundBufferSize);
          break;
        }
      case 'indirect':{
          const renderPipeline = t.createNoOpRenderPipeline();
          renderPassEncoder.setPipeline(renderPipeline);
          renderPassEncoder.drawIndirect(buffer, offset);
          break;
        }
      case 'indexedIndirect':{
          const renderPipeline = t.createNoOpRenderPipeline();
          renderPassEncoder.setPipeline(renderPipeline);
          const indexBuffer = t.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.INDEX });

          renderPassEncoder.setIndexBuffer(indexBuffer, 'uint16');
          renderPassEncoder.drawIndexedIndirect(buffer, offset);
          break;
        }}

  };

  const buffer = t.device.createBuffer({
    size: kBoundBufferSize * 2,
    usage:
    GPUBufferUsage.UNIFORM |
    GPUBufferUsage.STORAGE |
    GPUBufferUsage.VERTEX |
    GPUBufferUsage.INDEX |
    GPUBufferUsage.INDIRECT });


  const encoder = t.device.createCommandEncoder();
  const renderPassEncoder = t.beginSimpleRenderPass(encoder);
  const offset0 = 0;
  const index0 = 0;
  UseBufferOnRenderPassEncoder(buffer, index0, offset0, usage0, visibility0, renderPassEncoder);
  const offset1 = hasOverlap ? offset0 : kBoundBufferSize;
  const index1 = 1;
  if (inSamePass) {
    UseBufferOnRenderPassEncoder(buffer, index1, offset1, usage1, visibility1, renderPassEncoder);
    renderPassEncoder.end();
  } else {
    renderPassEncoder.end();
    const anotherRenderPassEncoder = t.beginSimpleRenderPass(encoder);
    UseBufferOnRenderPassEncoder(
    buffer,
    index1,
    offset1,
    usage1,
    visibility1,
    anotherRenderPassEncoder);

    anotherRenderPassEncoder.end();
  }

  const fail =
  inSamePass && (
  usage0 === 'storage' && usage1 !== 'storage' ||
  usage0 !== 'storage' && usage1 === 'storage');
  t.expectValidationError(() => {
    encoder.finish();
  }, fail);
});
//# sourceMappingURL=in_pass_encoder.spec.js.map