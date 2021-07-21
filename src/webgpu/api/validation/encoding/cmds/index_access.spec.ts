export const description = `
indexed draws validation tests.

TODO: review and make sure these notes are covered:
> - indexed draws:
>     - index access out of bounds (make sure this doesn't overlap with robust access)
>         - bound index buffer **range** is {exact size, just under exact size} needed for draws with:
>             - indexCount largeish
>             - firstIndex {=, >} 0
>     - x= {drawIndexed, drawIndexedIndirect}
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

class F extends ValidationTest {
  createIndexBuffer(indexData: Iterable<number>): GPUBuffer {
    const indexArray = new Uint32Array(indexData);

    const indexBuffer = this.device.createBuffer({
      mappedAtCreation: true,
      size: indexArray.byteLength,
      usage: GPUBufferUsage.INDEX,
    });
    new Uint32Array(indexBuffer.getMappedRange()).set(indexArray);
    indexBuffer.unmap();

    return indexBuffer;
  }

  createRenderPipeline(): GPURenderPipeline {
    return this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: `
            [[stage(vertex)]] fn main() -> [[builtin(position)]] vec4<f32> {
              return vec4<f32>(0.0, 0.0, 0.0, 1.0);
            }`,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: this.device.createShaderModule({
          code: `
            [[stage(fragment)]] fn main() -> [[location(0)]] vec4<f32> {
              return vec4<f32>(0.0, 1.0, 0.0, 1.0);
            }`,
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: 'uint32',
      },
    });
  }

  beginRenderPass(encoder: GPUCommandEncoder) {
    const colorAttachment = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    return encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorAttachment.createView(),
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
  }

  drawIndexed(
    indexBuffer: GPUBuffer,
    indexCount: number,
    instanceCount: number,
    firstIndex: number,
    baseVertex: number,
    firstInstance: number,
    isSuccess: boolean
  ) {
    const pipeline = this.createRenderPipeline();

    const encoder = this.device.createCommandEncoder();
    const pass = this.beginRenderPass(encoder);
    pass.setPipeline(pipeline);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
    pass.endPass();

    if (isSuccess) {
      this.device.queue.submit([encoder.finish()]);
    } else {
      this.expectValidationError(() => {
        encoder.finish();
      });
    }
  }

  drawIndexedIndirect(
    indexBuffer: GPUBuffer,
    bufferArray: Uint32Array,
    indirectOffset: number,
    isSuccess: boolean
  ) {
    const indirectBuffer = this.device.createBuffer({
      mappedAtCreation: true,
      size: bufferArray.byteLength,
      usage: GPUBufferUsage.INDIRECT,
    });
    new Uint32Array(indirectBuffer.getMappedRange()).set(bufferArray);
    indirectBuffer.unmap();

    const pipeline = this.createRenderPipeline();

    const encoder = this.device.createCommandEncoder();
    const pass = this.beginRenderPass(encoder);
    pass.setPipeline(pipeline);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexedIndirect(indirectBuffer, indirectOffset);
    pass.endPass();

    if (isSuccess) {
      this.device.queue.submit([encoder.finish()]);
    } else {
      this.expectValidationError(() => {
        encoder.finish();
      });
    }
  }
}

export const g = makeTestGroup(F);

g.test('out_of_bounds')
  .desc(
    `Test drawing with out of bound index access to make sure encoder validation catch the
    following indexCount and firstIndex OOB conditions
    - either is within bound but indexCount + firstIndex is out of bound
    - only firstIndex is out of bound
    - only indexCount is out of bound
    - firstIndex much larger than indexCount
    - indexCount much larger than firstIndex
    - max uint32 value for both to make sure the sum doesn't overflow
    - max uint32 indexCount and small firstIndex
    - max uint32 firstIndex and small indexCount
    Together with normal and large instanceCount`
  )
  .params(
    u =>
      u
        .combine('indirect', [false, true])
        .combineWithParams([
          { indexCount: 5, firstIndex: 1 }, // draw the last 5 out of 6 index
          { indexCount: 1, firstIndex: 5 }, // draw the last 1 out of 6 index
          { indexCount: 6, firstIndex: 1 }, // indexCount + firstIndex out of bound
          { indexCount: 0, firstIndex: 6 }, // firstIndex point to the one after last, but (indexCount + firstIndex) * stride <= bufferSize, valid
          { indexCount: 0, firstIndex: 7 }, // (indexCount + firstIndex) * stride > bufferSize, invalid
          { indexCount: 1, firstIndex: 6 }, // indexCount valid, but (indexCount + firstIndex) out of bound
          { indexCount: 6, firstIndex: 10000 }, // firstIndex much larger than the bound
          { indexCount: 7, firstIndex: 0 }, // only indexCount out of bound
          { indexCount: 10000, firstIndex: 0 }, // indexCount much larger than the bound
          { indexCount: 0xffffffff, firstIndex: 0xffffffff }, // max uint32 value
          { indexCount: 0xffffffff, firstIndex: 2 }, // max uint32 indexCount and small firstIndex
          { indexCount: 2, firstIndex: 0xffffffff }, // small indexCount and max uint32 firstIndex
        ] as const)
        .combine('instanceCount', [1, 10000]) // normal and large instanceCount
  )
  .fn(t => {
    const { indirect, indexCount, firstIndex, instanceCount } = t.params;

    const indexBuffer = t.createIndexBuffer([0, 1, 2, 3, 1, 2]);
    const isSuccess: boolean = indexCount + firstIndex <= 6;

    if (indirect) {
      t.drawIndexedIndirect(
        indexBuffer,
        new Uint32Array([indexCount, instanceCount, firstIndex, 0, 0]),
        0,
        isSuccess
      );
    } else {
      t.drawIndexed(indexBuffer, indexCount, instanceCount, firstIndex, 0, 0, isSuccess);
    }
  });

g.test('out_of_bounds_zero_sized_index_buffer')
  .desc(
    `Test drawing with an empty index buffer to make sure the encoder validation catch the
    following indexCount and firstIndex conditions
    - indexCount + firstIndex is out of bound
    - indexCount is 0 but firstIndex is out of bound
    - only indexCount is out of bound
    - both are 0s (not out of bound) but index buffer size is 0
    Together with normal and large instanceCount`
  )
  .params(
    u =>
      u
        .combine('indirect', [false, true])
        .combineWithParams([
          { indexCount: 3, firstIndex: 1 }, // indexCount + firstIndex out of bound
          { indexCount: 0, firstIndex: 1 }, // indexCount is 0 but firstIndex out of bound
          { indexCount: 3, firstIndex: 0 }, // only indexCount out of bound
          { indexCount: 0, firstIndex: 0 }, // just zeros, valid
        ] as const)
        .combine('instanceCount', [1, 10000]) // normal and large instanceCount
  )
  .fn(t => {
    const { indirect, indexCount, firstIndex, instanceCount } = t.params;

    const indexBuffer = t.createIndexBuffer([]);
    const isSuccess: boolean = indexCount + firstIndex <= 0;

    if (indirect) {
      t.drawIndexedIndirect(
        indexBuffer,
        new Uint32Array([indexCount, instanceCount, firstIndex, 0, 0]),
        0,
        isSuccess
      );
    } else {
      t.drawIndexed(indexBuffer, indexCount, instanceCount, firstIndex, 0, 0, isSuccess);
    }
  });
