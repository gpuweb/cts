export const description = `
Buffer Usages Validation Tests in Render Pass and Compute Pass.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { unreachable } from '../../../../../common/util/util.js';
import { ValidationTest } from '../../validation_test.js';

const kBoundBufferSize = 256;

class F extends ValidationTest {
  createBindGroupForTest(
    buffer: GPUBuffer,
    offset: number,
    type: 'uniform' | 'storage' | 'read-only-storage',
    resourceVisibility: 'compute' | 'fragment'
  ) {
    const bindGroupLayoutEntry: GPUBindGroupLayoutEntry = {
      binding: 0,
      visibility:
        resourceVisibility === 'compute' ? GPUShaderStage.COMPUTE : GPUShaderStage.FRAGMENT,
      buffer: {
        type,
      },
    };
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [bindGroupLayoutEntry],
    });

    return this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer, offset, size: kBoundBufferSize },
        },
      ],
    });
  }

  beginSimpleRenderPass(encoder: GPUCommandEncoder) {
    const colorTexture = this.device.createTexture({
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      size: [16, 16, 1],
    });
    return encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorTexture.createView(),
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
    });
  }
}

function IsBufferUsageInBindGroup(
  bufferUsage:
    | 'uniform'
    | 'storage'
    | 'read-only-storage'
    | 'vertex'
    | 'index'
    | 'drawIndirect'
    | 'drawIndexedIndirect'
): boolean {
  switch (bufferUsage) {
    case 'uniform':
    case 'storage':
    case 'read-only-storage':
      return true;
    case 'vertex':
    case 'index':
    case 'drawIndirect':
    case 'drawIndexedIndirect':
      return false;
    default:
      unreachable();
  }
}

export const g = makeTestGroup(F);

g.test('subresources,buffer_usage_in_render_pass_encoder')
  .desc(
    `
Test that when one buffer is used in one render pass encoder, its list of internal usages within one
usage scope can only be a compatible usage list; while there is no such restriction when it is used
in different render pass encoders. The usage scope rules are not related to the buffer offset or the
bind group layout visibility.`
  )
  .params(u =>
    u
      .combine('bufferUsage0', [
        'uniform',
        'storage',
        'read-only-storage',
        'vertex',
        'index',
        'drawIndirect',
        'drawIndexedIndirect',
      ] as const)
      .combine('bindGroupVisibility0', ['compute', 'fragment'] as const)
      .unless(
        t => t.bindGroupVisibility0 === 'compute' && !IsBufferUsageInBindGroup(t.bufferUsage0)
      )
      .combine('bufferUsage1', [
        'uniform',
        'storage',
        'read-only-storage',
        'vertex',
        'index',
        'drawIndirect',
        'drawIndexedIndirect',
      ] as const)
      .combine('bindGroupVisibility1', ['compute', 'fragment'] as const)
      .unless(
        t => t.bindGroupVisibility1 === 'compute' && !IsBufferUsageInBindGroup(t.bufferUsage1)
      )
      .combine('inSamePass', [true, false])
      .combine('hasOverlap', [true, false])
  )
  .fn(async t => {
    const {
      bufferUsage0,
      bindGroupVisibility0,
      bufferUsage1,
      bindGroupVisibility1,
      inSamePass,
      hasOverlap,
    } = t.params;

    const UseBufferOnRenderPassEncoder = (
      buffer: GPUBuffer,
      offset: number,
      type:
        | 'uniform'
        | 'storage'
        | 'read-only-storage'
        | 'vertex'
        | 'index'
        | 'drawIndirect'
        | 'drawIndexedIndirect',
      bindGroupVisibility: 'compute' | 'fragment',
      renderPassEncoder: GPURenderPassEncoder
    ) => {
      switch (type) {
        case 'uniform':
        case 'storage':
        case 'read-only-storage': {
          const bindGroup = t.createBindGroupForTest(buffer, offset, type, bindGroupVisibility);
          renderPassEncoder.setBindGroup(0, bindGroup);
          break;
        }
        case 'vertex': {
          renderPassEncoder.setVertexBuffer(0, buffer, offset, kBoundBufferSize);
          break;
        }
        case 'index': {
          renderPassEncoder.setIndexBuffer(buffer, 'uint16', offset, kBoundBufferSize);
          break;
        }
        case 'drawIndirect': {
          const renderPipeline = t.createNoOpRenderPipeline();
          renderPassEncoder.setPipeline(renderPipeline);
          renderPassEncoder.drawIndirect(buffer, offset);
          break;
        }
        case 'drawIndexedIndirect': {
          const renderPipeline = t.createNoOpRenderPipeline();
          renderPassEncoder.setPipeline(renderPipeline);
          const indexBuffer = t.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.INDEX,
          });
          renderPassEncoder.setIndexBuffer(indexBuffer, 'uint16');
          renderPassEncoder.drawIndexedIndirect(buffer, offset);
          break;
        }
      }
    };

    const buffer = t.device.createBuffer({
      size: kBoundBufferSize * 2,
      usage:
        GPUBufferUsage.UNIFORM |
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.INDEX |
        GPUBufferUsage.INDIRECT,
    });

    const encoder = t.device.createCommandEncoder();
    const renderPassEncoder = t.beginSimpleRenderPass(encoder);
    const offset0 = 0;
    UseBufferOnRenderPassEncoder(
      buffer,
      offset0,
      bufferUsage0,
      bindGroupVisibility0,
      renderPassEncoder
    );
    const offset1 = hasOverlap ? offset0 : kBoundBufferSize;
    if (inSamePass) {
      UseBufferOnRenderPassEncoder(
        buffer,
        offset1,
        bufferUsage1,
        bindGroupVisibility1,
        renderPassEncoder
      );
      renderPassEncoder.end();
    } else {
      renderPassEncoder.end();
      const anotherRenderPassEncoder = t.beginSimpleRenderPass(encoder);
      UseBufferOnRenderPassEncoder(
        buffer,
        offset1,
        bufferUsage1,
        bindGroupVisibility1,
        anotherRenderPassEncoder
      );
      anotherRenderPassEncoder.end();
    }

    const fail =
      inSamePass &&
      ((bufferUsage0 === 'storage' && bufferUsage1 !== 'storage') ||
        (bufferUsage0 !== 'storage' && bufferUsage1 === 'storage'));
    t.expectValidationError(() => {
      encoder.finish();
    }, fail);
  });
