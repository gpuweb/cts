export const description = '';

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { EncodableTextureFormat } from '../../capability_info.js';
import { GPUTest } from '../../gpu_test.js';
import { getTextureCopyLayout } from '../../util/texture/layout.js';

const kHeight = 4;
const kWidth = 4;
const kTextureFormat: GPUTextureFormat = 'bgra8unorm';

/**
 * The expected rendering shapes:
 * Square:
 *  0---------3
 *  |         |
 *  |         |
 *  |         |
 *  2---------1
 * BottomLeftTriangle:
 *  0
 *  | \
 *  |    \
 *  |       \
 *  2---------1
 * Points:
 *  0         3
 *
 *
 *
 *  2         1
 * XShape:
 *  0         3
 *    \     /
 *       \
 *    /     \
 *  2         1
 */
const enum RenderShape {
  Square = 'Square',
  BottomLeftTriangle = 'BottomLeftTriangle',
  Points = 'Points',
  XShape = 'XShape',
  Nothing = 'Nothing',
}

class IndexFormatTest extends GPUTest {
  private colorAttachment!: GPUTexture;
  byteLength!: number;
  rowsPerImage!: number;
  bytesPerRow!: number;
  result!: GPUBuffer;

  async init(): Promise<void> {
    await super.init();

    const { byteLength, bytesPerRow, rowsPerImage } = getTextureCopyLayout(
      <EncodableTextureFormat>kTextureFormat,
      '2d',
      [kWidth, kHeight, 1]
    );

    this.byteLength = byteLength;
    this.bytesPerRow = bytesPerRow;
    this.rowsPerImage = rowsPerImage;

    this.colorAttachment = this.device.createTexture({
      format: kTextureFormat,
      size: { width: kWidth, height: kHeight, depth: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    this.result = this.device.createBuffer({
      size: this.byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
  }

  MakeRenderPipeline(
    primitiveTopology: GPUPrimitiveTopology,
    indexFormat?: GPUIndexFormat
  ): GPURenderPipeline {
    const vertexModule = this.device.createShaderModule({
      code: `
        [[location(0)]] var<in> pos : vec4<f32>;
        [[builtin(position)]] var<out> Position : vec4<f32>;

        [[stage(vertex)]]
        fn main() -> void {
          Position = pos;
          return;
        }
      `,
    });

    const fragmentModule = this.device.createShaderModule({
      code: `
        [[location(0)]] var<out> fragColor : vec4<f32>;

        [[stage(fragment)]]
        fn main() -> void {
          fragColor = vec4<f32>(0.0, 1.0, 0.0, 1.0);
          return;
        }
      `,
    });

    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [] }),
      vertexStage: { module: vertexModule, entryPoint: 'main' },
      fragmentStage: { module: fragmentModule, entryPoint: 'main' },
      primitiveTopology,
      colorStates: [{ format: kTextureFormat }],
      vertexState: {
        indexFormat,
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

  CreateIndexBuffer(indexArray: Uint16Array | Uint32Array, indexFormat: GPUIndexFormat): GPUBuffer {
    const indexBuffer = this.device.createBuffer({
      size: indexArray.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    if (indexFormat === 'uint16') {
      new Uint16Array(indexBuffer.getMappedRange()).set(indexArray);
    } else {
      new Uint32Array(indexBuffer.getMappedRange()).set(indexArray);
    }
    indexBuffer.unmap();
    return indexBuffer;
  }

  run(
    indexBuffer: GPUBuffer,
    indexCount: number,
    indexFormat: GPUIndexFormat,
    indexOffset: number = 0,
    primitiveTopology: GPUPrimitiveTopology = 'triangle-list'
  ): void {
    let pipeline: GPURenderPipeline;
    // The indexFormat must be set in render pipeline descriptor that specifys a strip primitive
    // topology for primitive restart testing
    if (primitiveTopology === 'line-strip' || primitiveTopology === 'triangle-strip') {
      pipeline = this.MakeRenderPipeline(primitiveTopology, indexFormat);
    } else {
      pipeline = this.MakeRenderPipeline(primitiveTopology);
    }

    /* prettier-ignore */
    const vertexArray = new Float32Array([
      // float4 position
      -1.0, 1.0, 0.0, 1.0,
      1.0, -1.0, 0.0, 1.0,
      1.0, 1.0, 0.0, 1.0,
      -1.0, -1.0, 0.0, 1.0
    ]);
    const vertexBuffer = this.device.createBuffer({
      size: vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertexArray);
    vertexBuffer.unmap();

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
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, indexFormat, indexOffset);
    pass.drawIndexed(indexCount, 1, 0, 0, 0);
    pass.endPass();
    encoder.copyTextureToBuffer(
      { texture: this.colorAttachment, origin: { x: 0, y: 0, z: 0 } },
      { buffer: this.result, bytesPerRow: this.bytesPerRow, rowsPerImage: this.rowsPerImage },
      { width: kWidth, height: kHeight, depth: 1 }
    );
    this.device.defaultQueue.submit([encoder.finish()]);
  }

  CreateExpectedUint8Array(renderShape: RenderShape): Uint8Array {
    let texelValueBytes = new Uint8Array([0x00, 0x00, 0x00, 0xff]);
    const arrayBuffer = new Uint8Array(this.byteLength);
    for (let row = 0; row < kHeight; row++) {
      for (let col = 0; col < kWidth; col++) {
        if (renderShape === RenderShape.Square) {
          texelValueBytes = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
        } else if (renderShape === RenderShape.BottomLeftTriangle && row > col) {
          texelValueBytes = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
        } else if (
          renderShape === RenderShape.Points &&
          (row === 0 || row === kHeight - 1) &&
          (col === 0 || col === kWidth - 1)
        ) {
          texelValueBytes = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
        } else if (
          renderShape === RenderShape.XShape &&
          (col === row || col + row === kWidth - 1)
        ) {
          texelValueBytes = new Uint8Array([0x00, 0xff, 0x00, 0xff]);
        } else {
          texelValueBytes = new Uint8Array([0x00, 0x00, 0x00, 0xff]);
        }

        const byteOffset = row * this.bytesPerRow + col * texelValueBytes.byteLength;
        arrayBuffer.set(texelValueBytes, byteOffset);
      }
    }
    return arrayBuffer;
  }
}

export const g = makeTestGroup(IndexFormatTest);

// Test indexing draw with index format of uint16. If this is interpreted as uint32, it will have
// index 1 and 2 be both 0 and render nothing. And the index buffer size - offset must be not less
// than the size required by triangle list, otherwise it also render nothing.
g.test('index_format_uint16')
  .params(params().combine(poptions('indexOffset', [0, 6, 18])))
  .fn(t => {
    const { indexOffset } = t.params;

    const indexArray = new Uint16Array([1, 2, 0, 0, 0, 0, 0, 1, 3, 0]);
    const indexBuffer = t.CreateIndexBuffer(indexArray, 'uint16');
    const indexCount = indexArray.length;
    t.run(indexBuffer, indexCount, 'uint16', indexOffset);

    let expectedShape: RenderShape;
    if (indexOffset === 0) {
      expectedShape = RenderShape.Square;
    } else if (indexOffset === 6) {
      expectedShape = RenderShape.BottomLeftTriangle;
    } else {
      expectedShape = RenderShape.Nothing;
    }

    const expectedTextureValues = t.CreateExpectedUint8Array(expectedShape);
    t.expectContents(t.result, expectedTextureValues);
  });

// Test indexing draw with index format of uint32. If this is interpreted as uint16, then it would
// be 0, 1, 0, ... and would draw nothing. And the index buffer size - offset must be not less than
// the size required by triangle list, otherwise it also render nothing.
g.test('index_format_uint32')
  .params(params().combine(poptions('indexOffset', [0, 12, 36])))
  .fn(t => {
    const { indexOffset } = t.params;

    const indexArray = new Uint32Array([1, 2, 0, 0, 0, 0, 0, 1, 3, 0]);
    const indexBuffer = t.CreateIndexBuffer(indexArray, 'uint32');
    const indexCount = indexArray.length;
    t.run(indexBuffer, indexCount, 'uint32', indexOffset);

    let expectedShape: RenderShape;
    if (indexOffset === 0) {
      expectedShape = RenderShape.Square;
    } else if (indexOffset === 12) {
      expectedShape = RenderShape.BottomLeftTriangle;
    } else {
      expectedShape = RenderShape.Nothing;
    }

    const expectedTextureValues = t.CreateExpectedUint8Array(expectedShape);
    t.expectContents(t.result, expectedTextureValues);
  });

// Test primitive restart with each primitive topology. The primitive restart value can used with
// strip primitive topologies ('line-strip' or 'triangle-strip').
// For line-strip, [0, 1, PRIM_RESTART, 2, 3] only render a X shape.
// For triangle-strip, [0, 1, 3, PRIM_RESTART, 2] only the first triangle.
// Others are expected to be renderred the same as without primitive restart.
g.test('primitive_restart')
  .params(
    params()
      .combine(poptions('indexFormat', ['uint16', 'uint32']))
      .combine(
        poptions('primitiveTopology', [
          'point-list',
          'line-list',
          'line-strip',
          'triangle-list',
          'triangle-strip',
        ])
      )
  )
  .fn(t => {
    const { indexFormat, primitiveTopology } = t.params;

    let indexArray: Uint16Array | Uint32Array;
    if (indexFormat === 'uint16') {
      if (primitiveTopology === 'triangle-list') {
        indexArray = new Uint16Array([0, 1, 3, 0xffff, 2, 1, 0, 0]);
      } else if (primitiveTopology === 'triangle-strip') {
        indexArray = new Uint16Array([0, 1, 3, 0xffff, 2, 2]);
      } else {
        indexArray = new Uint16Array([0, 1, 0xffff, 2, 3, 3]);
      }
    } else {
      if (primitiveTopology === 'triangle-list') {
        indexArray = new Uint32Array([0, 1, 3, 0xffffffff, 2, 1, 0]);
      } else if (primitiveTopology === 'triangle-strip') {
        indexArray = new Uint32Array([0, 1, 3, 0xffffffff, 2]);
      } else {
        indexArray = new Uint32Array([0, 1, 0xffffffff, 2, 3]);
      }
    }

    const indexBuffer = t.CreateIndexBuffer(indexArray, <GPUIndexFormat>indexFormat);
    const indexCount = indexArray.length;
    t.run(
      indexBuffer,
      indexCount,
      <GPUIndexFormat>indexFormat,
      0,
      <GPUPrimitiveTopology>primitiveTopology
    );

    let expectedShape: RenderShape = RenderShape.Nothing;
    if (primitiveTopology === 'point-list') {
      expectedShape = RenderShape.Points;
    } else if (primitiveTopology === 'line-list' || primitiveTopology === 'line-strip') {
      expectedShape = RenderShape.XShape;
    } else if (primitiveTopology === 'triangle-list') {
      expectedShape = RenderShape.Square;
    } else if (primitiveTopology === 'triangle-strip') {
      expectedShape = RenderShape.BottomLeftTriangle;
    }

    const expectedTextureValues = t.CreateExpectedUint8Array(expectedShape);
    t.expectContents(t.result, expectedTextureValues);
  });
