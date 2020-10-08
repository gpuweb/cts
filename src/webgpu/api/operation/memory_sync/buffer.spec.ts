export const description = `
Memory Synchronization Tests for Buffer.

- Test write-after-write on a single buffer. Create one single buffer and initiate it to 0.
Write a number (say 1) into the buffer via render pass, compute pass, or copy. Write another
number (say 2) into the same buffer via render pass, compute pass, or copy.
  - x= 1st write type: {storage buffer in {render, compute}, T2B, B2B}
  - x= 2nd write type: {storage buffer in {render, compute}, T2B, B2B}
  - for each write, if render, x= {bundle, non-bundle}
  - if pass type is the same, x= {single pass, separate passes} (note: render has loose guarantees)
  - if not single pass, x= writes in {same cmdbuf, separate cmdbufs, separate queues}
`;

import { pbool, poptions, params } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/framework/util/util.js';
import { GPUTest } from '../../../gpu_test.js';

const SIZE = 4;
class BufferSyncTest extends GPUTest {
  // Create a buffer, and initiate it to zero.
  createBuffer(): GPUBuffer {
    const data = new Uint32Array(SIZE / 4);
    for (let i = 0; i < SIZE / 4; ++i) {
      data[i] = 0;
    }
    const buffer = this.device.createBuffer({
      mappedAtCreation: true,
      size: SIZE,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });
    new Uint8Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
  }

  createBindGroup(
    pipeline: GPURenderPipeline | GPUComputePipeline,
    buffer: GPUBuffer
  ): GPUBindGroup {
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    });
  }

  // Create a compute pipeline and write given data into storage buffer.
  createStorageWriteComputePipeline(value: number): GPUComputePipeline {
    const wgslCompute = `
      type Data = [[block]] struct {
        [[offset 0]] a : i32;
      };

      [[binding 0, set 0]] var<storage_buffer> data : Data;
      fn main() -> void {
	data.a = ${value};
        return;
      }

      entry_point compute = main;
    `;

    return this.device.createComputePipeline({
      computeStage: {
        module: this.device.createShaderModule({
          code: wgslCompute,
        }),
        entryPoint: 'main',
      },
    });
  }

  // Create a render pipeline and write given data into storage buffer at fragment stage.
  createStorageWriteRenderPipeline(value: number): GPURenderPipeline {
    const wgslVertex = `
    [[builtin position]] var<out> Position : vec4<f32>;
      fn vert_main() -> void {
        Position = vec4<f32>(0.5, 0.5, 0.0, 1.0);
        return;
      }

      entry_point vertex = vert_main;
    `;

    const wgslFragment = `
    [[location 0]] var<out> outColor : vec4<f32>;
      type Data = [[block]] struct {
        [[offset 0]] a : i32;
      };

      [[binding 0, set 0]] var<storage_buffer> data : Data;
      fn frag_main() -> void {
	data.a = ${value};
	outColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
        return;
      }

      entry_point fragment = frag_main;
    `;

    return this.device.createRenderPipeline({
      vertexStage: {
        module: this.device.createShaderModule({
          code: wgslVertex,
        }),
        entryPoint: 'vert_main',
      },
      fragmentStage: {
        module: this.device.createShaderModule({
          code: wgslFragment,
        }),
        entryPoint: 'frag_main',
      },
      primitiveTopology: 'point-list',
      colorStates: [{ format: 'rgba8unorm' }],
    });
  }

  beginSimpleRenderPass(encoder: GPUCommandEncoder): GPURenderPassEncoder {
    const view = this.device
      .createTexture({
        size: { width: 4, height: 4, depth: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.OUTPUT_ATTACHMENT,
      })
      .createView();
    return encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: view,
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
        },
      ],
    });
  }

  // Write storage buffer via draw call in render pass. Use bundle if needed.
  writeByRenderPass(bundle: boolean, buffer: GPUBuffer, value: number, encoder: GPUCommandEncoder) {
    const pipeline = this.createStorageWriteRenderPipeline(value);
    const bindGroup = this.createBindGroup(pipeline, buffer);
    const pass = this.beginSimpleRenderPass(encoder);
    if (bundle) {
      const bundleEncoder = this.device.createRenderBundleEncoder({
        colorFormats: ['rgba8unorm'],
      });
      bundleEncoder.setBindGroup(0, bindGroup);
      bundleEncoder.setPipeline(pipeline);
      bundleEncoder.draw(1, 1, 0, 0);
      const bundles = bundleEncoder.finish();
      pass.executeBundles([bundles]);
    } else {
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(1, 1, 0, 0);
    }
    pass.endPass();
  }

  // Write storage buffer via dispatch call in compute pass.
  writeByComputePass(buffer: GPUBuffer, value: number, encoder: GPUCommandEncoder) {
    const pipeline = this.createStorageWriteComputePipeline(value);
    const bindGroup = this.createBindGroup(pipeline, buffer);
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatch(1);
    pass.endPass();
  }

  // Issue write operation via render pass, compute pass, copy, etc.
  issueWriteOp(
    writeOp: string,
    bundle: boolean,
    buffer: GPUBuffer,
    value: number,
    encoder: GPUCommandEncoder
  ) {
    const isRenderPass = writeOp === 'render';
    assert(!bundle || isRenderPass);
    if (isRenderPass) {
      this.writeByRenderPass(bundle, buffer, value, encoder);
    } else {
      assert(writeOp === 'compute');
      this.writeByComputePass(buffer, value, encoder);
    }
  }

  createCommandBufferAndIssueWriteOp(
    writeOp: string,
    bundle: boolean,
    buffer: GPUBuffer,
    value: number
  ): GPUCommandBuffer {
    const encoder = this.device.createCommandEncoder();
    this.issueWriteOp(writeOp, bundle, buffer, value, encoder);
    return encoder.finish();
  }

  verifyData(buffer: GPUBuffer, expectedValue: number) {
    const bufferData = new Uint32Array(1);
    bufferData[0] = expectedValue;
    this.expectContents(buffer, bufferData);
  }
}

export const g = makeTestGroup(BufferSyncTest);

// Test write-after-write operations. The first write will write 1 into a storage buffer.
// The second write will write 2 into the same storage buffer. So, expected data in buffer is 2.
// The two writes can be in the same command buffer, or separate command buffers, or separate
// queues. Each write operation can be done via render, compute, or copy, etc. If the write
// operation is done by a render pass, it may use bundle.
g.test('write_after_write,passes')
  .params(
    params()
      // TODO (yunchao.he@intel.com): add multi-queue.
      // Then the pbool 'sameCommandBuffer' can be a poption which consits of 3 options:
      // same command buffer, separate command buffers, separate queues.
      .combine(pbool('sameCommandBuffer'))
      .combine(poptions('firstWriteOp', ['render', 'compute'] as const))
      .combine(poptions('secondWriteOp', ['render', 'compute'] as const))
      .combine(pbool('firstWriteInBundle'))
      .combine(pbool('secondWriteInBundle'))
      .unless(
        p =>
          (p.firstWriteInBundle && p.firstWriteOp !== 'render') ||
          (p.secondWriteInBundle && p.secondWriteOp !== 'render')
      )
  )
  .fn(async t => {
    const {
      sameCommandBuffer,
      firstWriteOp,
      secondWriteOp,
      firstWriteInBundle,
      secondWriteInBundle,
    } = t.params;
    const buffer = t.createBuffer();
    if (sameCommandBuffer) {
      const encoder = t.device.createCommandEncoder();
      t.issueWriteOp(firstWriteOp, firstWriteInBundle, buffer, 1, encoder);
      t.issueWriteOp(secondWriteOp, secondWriteInBundle, buffer, 2, encoder);
      t.device.defaultQueue.submit([encoder.finish()]);
    } else {
      const command_buffers: GPUCommandBuffer[] = [];
      command_buffers.push(
        t.createCommandBufferAndIssueWriteOp(firstWriteOp, firstWriteInBundle, buffer, 1)
      );
      command_buffers.push(
        t.createCommandBufferAndIssueWriteOp(secondWriteOp, secondWriteInBundle, buffer, 2)
      );
      t.device.defaultQueue.submit(command_buffers);
    }
    t.verifyData(buffer, 2);
  });

// TODO (yunchao.he@intel.com):
// * Add other write operations like copy, writeBuffer, etc. for write-after-write tests.
// * Add write-after-write tests for two-draws-or-dispatches in same pass. Note that the expected
// value is not one single fixed value for two draws in render.
// * Add read-before-write tests and read-after-write tests.
