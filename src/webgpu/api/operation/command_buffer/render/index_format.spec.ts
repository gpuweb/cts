export const description = `Index format tests.`;

import { TestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import glslangModule from '../../../../util/glslang.js';

export class IndexFormatTest extends GPUTest {
  private glslang: any;
  private pipeline!: GPURenderPipeline;
  private colorAttachment!: GPUTexture;
  private result!: GPUBuffer;
  private swapChainFormat: GPUTextureFormat = 'bgra8unorm';

  async initResources(format: GPUIndexFormat): Promise<void> {
    // glslang module
    this.glslang = await glslangModule();

    // render pipeline
    this.pipeline = this.MakeRenderPipeline(format);

    const context = this.CreateRenderContext(true);
    if (context !== null) {
      const swapChain: GPUSwapChain = context.configureSwapChain({
        device: this.device,
        format: this.swapChainFormat,
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.OUTPUT_ATTACHMENT,
      });
      this.colorAttachment = swapChain.getCurrentTexture();
    }

    // result buffer
    this.result = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
  }

  CreateRenderContext(display: boolean): any {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    // Display rendering on test page
    if (display) {
      const container = document.getElementById('canvasContainer');
      if (container) {
        container.innerHTML = '';
        container.append(canvas);
      }
    }
    return canvas.getContext('gpupresent');
  }

  MakeRenderPipeline(format: GPUIndexFormat): GPURenderPipeline {
    const vertexShaderGLSL = `#version 450
    layout(location = 0) in vec4 pos;
    void main() {
        gl_Position = pos;
    }`;

    const fragmentShaderGLSL = `#version 450
    layout(location = 0) out vec4 fragColor;
    void main() {
        fragColor = vec4(0.0, 1.0, 0.0, 1.0);
    }`;

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [] }),

      vertexStage: {
        module: this.device.createShaderModule({
          code: this.glslang.compileGLSL(vertexShaderGLSL, 'vertex'),
        }),
        entryPoint: 'main',
      },
      fragmentStage: {
        module: this.device.createShaderModule({
          code: this.glslang.compileGLSL(fragmentShaderGLSL, 'fragment'),
        }),
        entryPoint: 'main',
      },

      primitiveTopology: 'triangle-strip',

      colorStates: [
        {
          format: this.swapChainFormat,
        },
      ],

      vertexState: {
        indexFormat: format,
        vertexBuffers: [
          {
            arrayStride: 4 * 4,
            stepMode: 'vertex',
            attributes: [
              {
                format: 'float4',
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
        ],
      },
    });
  }

  MakeBufferMapped(arrayBuffer: ArrayBuffer, usage: number): GPUBuffer {
    const [buffer, bufferMapping] = this.device.createBufferMapped({
      size: arrayBuffer.byteLength,
      usage,
    });

    if (arrayBuffer instanceof Float32Array) {
      new Float32Array(bufferMapping).set(arrayBuffer);
    } else if (arrayBuffer instanceof Uint32Array) {
      new Uint32Array(bufferMapping).set(arrayBuffer);
    } else if (arrayBuffer instanceof Uint16Array) {
      new Uint16Array(bufferMapping).set(arrayBuffer);
    }

    buffer.unmap();
    return buffer;
  }

  run(
    vertexBuffer: GPUBuffer,
    indexBuffer: GPUBuffer,
    indexCount: number,
    expected: Uint8Array
  ): void {
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

    this.expectContents(this.result, expected);
  }
}

export const g = new TestGroup(IndexFormatTest);

g.test('uint32').fn(async t => {
  await t.initResources('uint32');

  const vertexArray = new Float32Array([
    // float4 position
    // Note Vertex[0] = Vertex[1]
    1.0,
    1.0,
    0.0,
    1.0,
    1.0,
    1.0,
    0.0,
    1.0,
    1.0,
    -1.0,
    0.0,
    1.0,
    -1.0,
    -1.0,
    0.0,
    1.0,
  ]);
  // If this is interpreted as Uint16, then it would be 0, 1, 0, ... and would draw nothing.
  const indexArray = new Uint32Array([1, 2, 3]);

  const vertexBuffer = t.MakeBufferMapped(vertexArray, GPUBufferUsage.VERTEX);
  const indexBuffer = t.MakeBufferMapped(indexArray, GPUBufferUsage.INDEX);

  const expected = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
  t.run(vertexBuffer, indexBuffer, indexArray.length, expected);
});

g.test('uint16').fn(async t => {
  await t.initResources('uint16');

  const vertexArray = new Float32Array([
    1.0,
    1.0,
    0.0,
    1.0,
    1.0,
    -1.0,
    0.0,
    1.0,
    -1.0,
    -1.0,
    0.0,
    1.0,
  ]);
  // If this is interpreted as uint32, it will have index 1 and 2 be both 0 and render nothing
  const indexArray = new Uint16Array([1, 2, 0, 0, 0, 0]);

  const vertexBuffer = t.MakeBufferMapped(vertexArray, GPUBufferUsage.VERTEX);
  const indexBuffer = t.MakeBufferMapped(indexArray, GPUBufferUsage.INDEX);

  const expected = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
  t.run(vertexBuffer, indexBuffer, indexArray.length, expected);
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

g.test('uint32 primitive restart').fn(async t => {
  await t.initResources('uint32');

  const vertexArray = new Float32Array([
    0.0,
    1.0,
    0.0,
    1.0,
    1.0,
    0.0,
    0.0,
    1.0,
    0.0,
    0.0,
    0.0,
    1.0,
    0.0,
    -1.0,
    0.0,
    1.0,
    -1.0,
    0.0,
    0.0,
    1.0,
  ]);
  const indexArray = new Uint32Array([0, 1, 2, 0xffffffff, 3, 4, 2]);

  const vertexBuffer = t.MakeBufferMapped(vertexArray, GPUBufferUsage.VERTEX);
  const indexBuffer = t.MakeBufferMapped(indexArray, GPUBufferUsage.INDEX);

  const expected = new Uint8Array([0x00, 0x00, 0x00, 0xff]);
  t.run(vertexBuffer, indexBuffer, indexArray.length, expected);
});

g.test('uint16 primitive restart').fn(async t => {
  await t.initResources('uint16');

  const vertexArray = new Float32Array([
    0.0,
    1.0,
    0.0,
    1.0,
    1.0,
    0.0,
    0.0,
    1.0,
    0.0,
    0.0,
    0.0,
    1.0,
    0.0,
    -1.0,
    0.0,
    1.0,
    -1.0,
    0.0,
    0.0,
    1.0,
  ]);
  const indexArray = new Uint16Array([0, 1, 2, 0xffff, 3, 4, 2]);

  const vertexBuffer = t.MakeBufferMapped(vertexArray, GPUBufferUsage.VERTEX);
  const indexBuffer = t.MakeBufferMapped(indexArray, GPUBufferUsage.INDEX);

  const expected = new Uint8Array([0x00, 0x00, 0x00, 0xff]);
  t.run(vertexBuffer, indexBuffer, indexArray.length, expected);
});
