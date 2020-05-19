export const description = '';

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';

export class IndexFormatTest extends GPUTest {
  private pipeline!: GPURenderPipeline;
  private colorAttachment!: GPUTexture;
  result!: GPUBuffer;

  async initResources(format: GPUIndexFormat): Promise<void> {
    this.pipeline = this.MakeRenderPipeline(format);

    this.colorAttachment = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 100, height: 100, depth: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    this.result = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
  }

  MakeRenderPipeline(format: GPUIndexFormat): GPURenderPipeline {
    const vertexModule = this.makeShaderModule('vertex', {
      glsl: `
        #version 310 es
        layout(location = 0) in vec4 pos;
        void main() {
            gl_Position = pos;
        }
      `,
    });

    const fragmentModule = this.makeShaderModule('fragment', {
      glsl: `
        #version 310 es
        precision mediump float;
        layout(location = 0) out vec4 fragColor;
        void main() {
            fragColor = vec4(0.0, 1.0, 0.0, 1.0);
        }
      `,
    });

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [] }),
      vertexStage: { module: vertexModule, entryPoint: 'main' },
      fragmentStage: { module: fragmentModule, entryPoint: 'main' },
      primitiveTopology: 'triangle-strip',
      colorStates: [{ format: 'rgba8unorm' }],
      vertexState: {
        indexFormat: format,
        vertexBuffers: [
          {
            arrayStride: 4 * 4,
            stepMode: 'vertex',
            attributes: [{ format: 'float4', offset: 0, shaderLocation: 0 }],
          },
        ],
      },
    });
  }

  run(vertexBuffer: GPUBuffer, indexBuffer: GPUBuffer, indexCount: number): void {
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: this.colorAttachment.createView(),
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer);
    pass.drawIndexed(indexCount, 1, 0, 0, 0);
    pass.endPass();
    encoder.copyTextureToBuffer(
      { texture: this.colorAttachment, mipLevel: 0, origin: { x: 51, y: 51, z: 0 } },
      { buffer: this.result, bytesPerRow: 256 },
      { width: 1, height: 1, depth: 1 }
    );
    this.device.defaultQueue.submit([encoder.finish()]);
  }
}

export const g = makeTestGroup(IndexFormatTest);

g.test('uint32').fn(async t => {
  await t.initResources('uint32');

  /* prettier-ignore */
  const vertexArray = new Float32Array([
    // float4 position
    1.0, 1.0, 0.0, 1.0,  // Note Vertex[0] = Vertex[1]
    1.0, 1.0, 0.0, 1.0,
    1.0, -1.0, 0.0, 1.0,
    -1.0, -1.0, 0.0, 1.0
  ]);
  // If this is interpreted as Uint16, then it would be 0, 1, 0, ... and would draw nothing.
  const indexArray = new Uint32Array([1, 2, 3]);

  const [vertexBuffer, vetexMapping] = t.device.createBufferMapped({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(vetexMapping).set(vertexArray);
  vertexBuffer.unmap();

  const [indexBuffer, indexMapping] = t.device.createBufferMapped({
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX,
  });
  new Uint32Array(indexMapping).set(indexArray);
  indexBuffer.unmap();

  t.run(vertexBuffer, indexBuffer, indexArray.length);
  t.expectContents(t.result, new Uint8Array([0x00, 0xff, 0x00, 0xff]));
});

g.test('uint16').fn(async t => {
  await t.initResources('uint16');

  /* prettier-ignore */
  const vertexArray = new Float32Array([
    1.0, 1.0, 0.0, 1.0,
    1.0, -1.0, 0.0, 1.0,
    -1.0, -1.0, 0.0, 1.0,
  ]);
  // If this is interpreted as uint32, it will have index 1 and 2 be both 0 and render nothing
  const indexArray = new Uint16Array([1, 2, 0, 0, 0, 0]);

  const [vertexBuffer, vetexMapping] = t.device.createBufferMapped({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(vetexMapping).set(vertexArray);
  vertexBuffer.unmap();

  const [indexBuffer, indexMapping] = t.device.createBufferMapped({
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX,
  });
  new Uint16Array(indexMapping).set(indexArray);
  indexBuffer.unmap();

  t.run(vertexBuffer, indexBuffer, indexArray.length);
  t.expectContents(t.result, new Uint8Array([0x00, 0xff, 0x00, 0xff]));
});

// Test for primitive restart use vertices like in the drawing and draw the following indices:
// 0 1 2 PRIM_RESTART 3 4 2. Then A and B should be written but not C.
//      |--------------|
//      |      0       |
//      |      |\      |
//      |      |A \    |
//      |      2---1   |
//      |     /| C     |
//      |   / B|       |
//      |  4---3       |
//      |--------------|
g.test('uint32_primitive_restart').fn(async t => {
  await t.initResources('uint32');

  /* prettier-ignore */
  const vertexArray = new Float32Array([
    0.0, 1.0, 0.0, 1.0,
    1.0, 0.0, 0.0, 1.0,
    0.0, 0.0, 0.0, 1.0,
    0.0, -1.0, 0.0, 1.0,
    -1.0, 0.0, 0.0, 1.0,
  ]);
  const indexArray = new Uint32Array([0, 1, 2, 0xffffffff, 3, 4, 2]);

  const [vertexBuffer, vetexMapping] = t.device.createBufferMapped({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(vetexMapping).set(vertexArray);
  vertexBuffer.unmap();

  const [indexBuffer, indexMapping] = t.device.createBufferMapped({
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX,
  });
  new Uint32Array(indexMapping).set(indexArray);
  indexBuffer.unmap();

  t.run(vertexBuffer, indexBuffer, indexArray.length);
  t.expectContents(t.result, new Uint8Array([0x00, 0x00, 0x00, 0xff]));
});

g.test('uint16_primitive_restart').fn(async t => {
  await t.initResources('uint16');

  /* prettier-ignore */
  const vertexArray = new Float32Array([
    0.0, 1.0, 0.0, 1.0,
    1.0, 0.0, 0.0, 1.0,
    0.0, 0.0, 0.0, 1.0,
    0.0, -1.0, 0.0, 1.0,
    -1.0, 0.0, 0.0, 1.0,
  ]);
  const indexArray = new Uint16Array([0, 1, 2, 0xffff, 3, 4, 2]);

  const [vertexBuffer, vetexMapping] = t.device.createBufferMapped({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX,
  });
  new Float32Array(vetexMapping).set(vertexArray);
  vertexBuffer.unmap();

  const [indexBuffer, indexMapping] = t.device.createBufferMapped({
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX,
  });
  new Uint16Array(indexMapping).set(indexArray);
  indexBuffer.unmap();

  t.run(vertexBuffer, indexBuffer, indexArray.length);
  t.expectContents(t.result, new Uint8Array([0x00, 0x00, 0x00, 0xff]));
});
