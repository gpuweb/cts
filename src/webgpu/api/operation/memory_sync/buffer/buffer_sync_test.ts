import { assert } from '../../../../../common/framework/util/util.js';
import { GPUTest } from '../../../../gpu_test.js';

const SIZE = 4;
export class BufferSyncTest extends GPUTest {
  // Create a buffer, and initiate it to a specified value for all elements.
  async createBufferWithValue(initValue: number): Promise<GPUBuffer> {
    const fence = this.queue.createFence();
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
    this.queue.signal(fence, 1);
    await fence.onCompletion(1);
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
        size: { width: 1, height: 1, depth: 1 },
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
  async writeByB2BCopy(buffer: GPUBuffer, value: number, encoder: GPUCommandEncoder) {
    const tmpBuffer = await this.createBufferWithValue(value);
    encoder.copyBufferToBuffer(tmpBuffer, 0, buffer, 0, SIZE);
  }

  // Write buffer via TextureToBuffer copy.
  async writeByT2BCopy(buffer: GPUBuffer, value: number, encoder: GPUCommandEncoder) {
    const tmpBuffer = await this.createBufferWithValue(value);
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
  async issueWriteOp(
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
        await this.writeByB2BCopy(buffer, value, encoder);
        break;
      case 't2bCopy':
        await this.writeByT2BCopy(buffer, value, encoder);
        break;
      default:
        assert(true);
        break;
    }
  }

  async createCommandBufferAndIssueWriteOp(
    writeOp: string,
    bundle: boolean,
    buffer: GPUBuffer,
    value: number
  ): Promise<GPUCommandBuffer> {
    const encoder = this.device.createCommandEncoder();
    await this.issueWriteOp(writeOp, bundle, buffer, value, encoder);
    return encoder.finish();
  }

  async createQueueSubmitsAndIssueWriteOp(
    writeOp: string,
    bundle: boolean,
    buffer: GPUBuffer,
    value: number
  ) {
    if (writeOp === 'writeBuffer') {
      this.writeByWriteBuffer(buffer, value);
    } else {
      const encoder = this.device.createCommandEncoder();
      await this.issueWriteOp(writeOp, bundle, buffer, value, encoder);
      this.device.defaultQueue.submit([encoder.finish()]);
    }
  }

  verifyData(buffer: GPUBuffer, expectedValue: number) {
    const bufferData = new Uint32Array(1);
    bufferData[0] = expectedValue;
    this.expectContents(buffer, bufferData);
  }
}
