export const description = `
Memory Synchronization Tests for Buffer.

- Test write-after-write on a single buffer. Create one single buffer and initiate it to 0.
Write a number (say 1) into the buffer via render pass, compute pass, or copy. Write another
number (say 2) into the same buffer via render pass, compute pass, or copy.
  - x= 1st write type: {storage buffer in {render, compute}, T2B, B2B, WriteBuffer}
  - x= 2nd write type: {storage buffer in {render, compute}, T2B, B2B, WriteBuffer}
  - for each write, if render, x= {bundle, non-bundle}
  - if pass type is the same, x= {single pass, separate passes} (note: render has loose guarantees)
  - if not single pass, x= writes in {same cmdbuf, separate cmdbufs, separate submits, separate queues}
`;

import { pbool, poptions, params } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/framework/util/util.js';
import { GPUTest } from '../../../gpu_test.js';

const SIZE = 4;
class BufferSyncTest extends GPUTest {
  // Create a buffer, and initiate it to a specified value for all elements.
  createBufferWithValue(initValue: number): GPUBuffer {
    const data = new Uint32Array(SIZE / 4);
    for (let i = 0; i < SIZE / 4; ++i) {
      data[i] = initValue;
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
        [[offset(0)]] a : i32;
      };

      [[binding(0), set(0)]] var<storage_buffer> data : Data;
      [[stage(compute)]] fn main() -> void {
        data.a = ${value};
        return;
      }
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
      [[builtin(position)]] var<out> Position : vec4<f32>;
      [[stage(vertex)]] fn vert_main() -> void {
        Position = vec4<f32>(0.5, 0.5, 0.0, 1.0);
        return;
      }
    `;

    const wgslFragment = `
      [[location(0)]] var<out> outColor : vec4<f32>;
      type Data = [[block]] struct {
        [[offset(0)]] a : i32;
      };

      [[binding(0), set(0)]] var<storage_buffer> data : Data;
      [[stage(fragment)]] fn frag_main() -> void {
        data.a = ${value};
        outColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
        return;
      }
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

  // Write buffer via draw call in render pass. Use bundle if needed.
  writeByRenderPass(bundle: boolean, buffer: GPUBuffer, value: number, encoder: GPUCommandEncoder) {
    const pipeline = this.createStorageWriteRenderPipeline(value);
    const bindGroup = this.createBindGroup(pipeline, buffer);

    const pass = this.beginSimpleRenderPass(encoder);
    const renderer = bundle
      ? this.device.createRenderBundleEncoder({ colorFormats: ['rgba8unorm'] })
      : pass;
    renderer.setBindGroup(0, bindGroup);
    renderer.setPipeline(pipeline);
    renderer.draw(1, 1, 0, 0);

    if (bundle) pass.executeBundles([(renderer as GPURenderBundleEncoder).finish()]);
    pass.endPass();
  }

  // Write buffer via dispatch call in compute pass.
  writeByComputePass(buffer: GPUBuffer, value: number, encoder: GPUCommandEncoder) {
    const pipeline = this.createStorageWriteComputePipeline(value);
    const bindGroup = this.createBindGroup(pipeline, buffer);
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatch(1);
    pass.endPass();
  }

  // Write bufer via BuferToBuffer copy.
  writeByB2BCopy(buffer: GPUBuffer, value: number, encoder: GPUCommandEncoder) {
    const tmpBuffer = this.createBufferWithValue(value);
    encoder.copyBufferToBuffer(tmpBuffer, 0, buffer, 0, SIZE);
  }

  // Write buffer via TextureToBuffer copy.
  writeByT2BCopy(buffer: GPUBuffer, value: number, encoder: GPUCommandEncoder) {
    const tmpBuffer = this.createBufferWithValue(value);
    const tmpTexture = this.device.createTexture({
      size: { width: 1, height: 1, depth: 1 },
      format: 'rgba8uint',
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });
    encoder.copyBufferToTexture(
      { buffer: tmpBuffer, bytesPerRow: 256 },
      { texture: tmpTexture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
      { width: 1, height: 1, depth: 1 }
    );
    encoder.copyTextureToBuffer(
      { texture: tmpTexture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
      { buffer, bytesPerRow: 256 },
      { width: 1, height: 1, depth: 1 }
    );
  }

  // Write buffer via writeBuffer API on queue
  writeByWriteBuffer(buffer: GPUBuffer, value: number) {
    const data = new Uint32Array(SIZE / 4);
    for (let i = 0; i < SIZE / 4; ++i) {
      data[i] = value;
    }

    this.device.defaultQueue.writeBuffer(buffer, 0, data);
  }

  // Issue write operation via render pass, compute pass, copy, etc.
  issueWriteOp(
    writeOp: string,
    bundle: boolean,
    buffer: GPUBuffer,
    value: number,
    encoder: GPUCommandEncoder
  ) {
    assert(!bundle || writeOp === 'render');
    switch (writeOp) {
      case 'render':
        this.writeByRenderPass(bundle, buffer, value, encoder);
        break;
      case 'compute':
        this.writeByComputePass(buffer, value, encoder);
        break;
      case 'b2bCopy':
        this.writeByB2BCopy(buffer, value, encoder);
        break;
      case 't2bCopy':
        this.writeByT2BCopy(buffer, value, encoder);
        break;
      default:
        assert(true);
        break;
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

  createQueueSubmitsAndIssueWriteOp(
    writeOp: string,
    bundle: boolean,
    buffer: GPUBuffer,
    value: number
  ) {
    if (writeOp === 'writeBuffer') {
      this.writeByWriteBuffer(buffer, value);
    } else {
      const encoder = this.device.createCommandEncoder();
      this.issueWriteOp(writeOp, bundle, buffer, value, encoder);
      this.device.defaultQueue.submit([encoder.finish()]);
    }
  }

  verifyData(buffer: GPUBuffer, expectedValue: number) {
    const bufferData = new Uint32Array(1);
    bufferData[0] = expectedValue;
    this.expectContents(buffer, bufferData);
  }
}

export const g = makeTestGroup(BufferSyncTest);

g.test('write_after_write')
  .desc(
    `Test write-after-write operations. The first write will write 1 into a storage buffer.
    The second write will write 2 into the same storage buffer. So, expected data in buffer is 2.
    The two writes can be in the same command buffer, or separate command buffers, or separate
    submits, or separate queues. Each write operation can be done via render, compute, copy,
    writeBuffer, map write, etc. If the write operation is done by a render pass, it may use bundle.`
  )
  .params(
    params()
      // TODO (yunchao.he@intel.com): add multi-queue.
      .combine(
        poptions('writeScopes', ['sameCmdbuf', 'separateCmdbufs', 'separateSubmits'] as const)
      )
      .combine(
        poptions('firstWriteOp', [
          'render',
          'compute',
          'b2bCopy',
          't2bCopy',
          'writeBuffer',
        ] as const)
      )
      .combine(
        poptions('secondWriteOp', [
          'render',
          'compute',
          'b2bCopy',
          't2bCopy',
          'writeBuffer',
        ] as const)
      )
      .combine(pbool('firstWriteInBundle'))
      .combine(pbool('secondWriteInBundle'))
      .unless(
        p =>
          (p.firstWriteInBundle && p.firstWriteOp !== 'render') ||
          (p.secondWriteInBundle && p.secondWriteOp !== 'render') ||
          ((p.firstWriteOp === 'writeBuffer' || p.secondWriteOp === 'writeBuffer') &&
            p.writeScopes !== 'separateSubmits')
      )
  )
  .fn(async t => {
    const {
      writeScopes,
      firstWriteOp,
      secondWriteOp,
      firstWriteInBundle,
      secondWriteInBundle,
    } = t.params;

    const buffer = t.createBufferWithValue(0);

    const writeInBundle = [firstWriteInBundle, secondWriteInBundle];
    const writeOp = [firstWriteOp, secondWriteOp];
    switch (writeScopes) {
      case 'sameCmdbuf': {
        const encoder = t.device.createCommandEncoder();
        for (let i = 0; i < 2; i++) {
          t.issueWriteOp(writeOp[i], writeInBundle[i], buffer, i + 1, encoder);
        }
        t.device.defaultQueue.submit([encoder.finish()]);
        break;
      }
      case 'separateCmdbufs': {
        const command_buffers: GPUCommandBuffer[] = [];
        for (let i = 0; i < 2; i++) {
          command_buffers.push(
            t.createCommandBufferAndIssueWriteOp(writeOp[i], writeInBundle[i], buffer, i + 1)
          );
        }
        t.device.defaultQueue.submit(command_buffers);
        break;
      }
      case 'separateSubmits': {
        for (let i = 0; i < 2; i++) {
          t.createQueueSubmitsAndIssueWriteOp(writeOp[i], writeInBundle[i], buffer, i + 1);
        }
        break;
      }
      default:
        assert(true);
        break;
    }

    t.verifyData(buffer, 2);
  });

// TODO (yunchao.he@intel.com):
// * Add write-after-write tests for two-draws-or-dispatches in same pass. Note that the expected
// value is not one single fixed value for two draws in render.
// * Add read-before-write tests and read-after-write tests.
