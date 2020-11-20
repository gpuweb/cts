export const description = `Test indexing, index format and primitive restart.

TODO(hao.x.li@intel.com): Test that use the primitive restart values as real indices with
non-strip topologies, to make sure those behave properly (and primitive restart is appropriately
enabled/disabled) across backends. These tests will be important for gpuweb/gpuweb#1220.
`;

import { params, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { GPUTest } from '../../gpu_test.js';
import { getTextureCopyLayout } from '../../util/texture/layout.js';

const kHeight = 4;
const kWidth = 4;
const kTextureFormat = 'bgra8unorm' as const;
const kValidPixelColor = new Uint8Array([0x00, 0xff, 0x00, 0xff]); // green
const kInvalidPixelColor = new Uint8Array([0x00, 0x00, 0x00, 0xff]); // black

/**
 * The expected rendering in raster grids of 4x4 pixels:
 * Square:
 *  -----------
 *  |#########|
 *  |#########|
 *  |#########|
 *  |#########|
 *  -----------
 * BottomLeftTriangle:
 *  -----------
 *  |#        |
 *  |###      |
 *  |######   |
 *  |#########|
 *  -----------
 * Points:
 *  -----------
 *  |#       #|
 *  |         |
 *  |         |
 *  |#       #|
 *  -----------
 * XShape:
 *  -----------
 *  |#       #|
 *  |  #   #  |
 *  |    #    |
 *  |#       #|
 *  -----------
 */
const enum RenderShape {
  Square = 'Square',
  BottomLeftTriangle = 'BottomLeftTriangle',
  Points = 'Points',
  XShape = 'XShape',
  Nothing = 'Nothing',
}

const kPrimitiveTopologiesForRestart: Array<{
  primitiveTopology: GPUPrimitiveTopology;
  _expectedShape: RenderShape;
}> = [
  { primitiveTopology: 'point-list', _expectedShape: RenderShape.Points },
  { primitiveTopology: 'line-list', _expectedShape: RenderShape.XShape },
  { primitiveTopology: 'line-strip', _expectedShape: RenderShape.XShape },
  { primitiveTopology: 'triangle-list', _expectedShape: RenderShape.Square },
  { primitiveTopology: 'triangle-strip', _expectedShape: RenderShape.BottomLeftTriangle },
];

const { byteLength, bytesPerRow, rowsPerImage } = getTextureCopyLayout(kTextureFormat, '2d', [
  kWidth,
  kHeight,
  1,
]);

class IndexFormatTest extends GPUTest {
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
  ): GPUBuffer {
    let pipeline: GPURenderPipeline;
    // The indexFormat must be set in render pipeline descriptor that specifys a strip primitive
    // topology for primitive restart testing
    if (primitiveTopology === 'line-strip' || primitiveTopology === 'triangle-strip') {
      pipeline = this.MakeRenderPipeline(primitiveTopology, indexFormat);
    } else {
      pipeline = this.MakeRenderPipeline(primitiveTopology);
    }

    const colorAttachment = this.device.createTexture({
      format: kTextureFormat,
      size: { width: kWidth, height: kHeight, depth: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    const result = this.device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const vertexArray = new Float32Array(
      /* prettier-ignore */ [
      // float4 position
      -1.0, 1.0, 0.0, 1.0,
      1.0, -1.0, 0.0, 1.0,
      1.0, 1.0, 0.0, 1.0,
      -1.0, -1.0, 0.0, 1.0]
    );
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
          attachment: colorAttachment.createView(),
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
      { texture: colorAttachment, origin: { x: 0, y: 0, z: 0 } },
      { buffer: result, bytesPerRow, rowsPerImage },
      { width: kWidth, height: kHeight, depth: 1 }
    );
    this.device.defaultQueue.submit([encoder.finish()]);

    return result;
  }

  CreateExpectedUint8Array(renderShape: RenderShape): Uint8Array {
    let texelValueBytes;
    const arrayBuffer = new Uint8Array(byteLength);
    for (let row = 0; row < kHeight; row++) {
      for (let col = 0; col < kWidth; col++) {
        if (renderShape === RenderShape.Square) {
          texelValueBytes = kValidPixelColor;
        } else if (renderShape === RenderShape.BottomLeftTriangle && row > col) {
          texelValueBytes = kValidPixelColor;
        } else if (
          renderShape === RenderShape.Points &&
          (row === 0 || row === kHeight - 1) &&
          (col === 0 || col === kWidth - 1)
        ) {
          texelValueBytes = kValidPixelColor;
        } else if (
          renderShape === RenderShape.XShape &&
          (col === row || col + row === kWidth - 1)
        ) {
          texelValueBytes = kValidPixelColor;
        } else {
          texelValueBytes = kInvalidPixelColor;
        }

        const byteOffset = row * bytesPerRow + col * texelValueBytes.byteLength;
        arrayBuffer.set(texelValueBytes, byteOffset);
      }
    }
    return arrayBuffer;
  }
}

export const g = makeTestGroup(IndexFormatTest);

g.test('index_format_uint16')
  .desc('Test indexing draw with index format of uint16.')
  .params([
    { indexOffset: 0, _expectedShape: RenderShape.Square },
    { indexOffset: 6, _expectedShape: RenderShape.BottomLeftTriangle },
    { indexOffset: 18, _expectedShape: RenderShape.Nothing },
  ])
  .fn(t => {
    const { indexOffset, _expectedShape } = t.params;

    // If this is interpreted as uint32, it will have index 1 and 2 be both 0 and render nothing.
    // And the index buffer size - offset must be not less than the size required by triangle
    // list, otherwise it also render nothing.
    const indexArray = new Uint16Array([1, 2, 0, 0, 0, 0, 0, 1, 3, 0]);
    const indexBuffer = t.CreateIndexBuffer(indexArray, 'uint16');
    const result = t.run(indexBuffer, indexArray.length, 'uint16', indexOffset);

    const expectedTextureValues = t.CreateExpectedUint8Array(_expectedShape);
    t.expectContents(result, expectedTextureValues);
  });

g.test('index_format_uint32')
  .desc('Test indexing draw with index format of uint32.')
  .params([
    { indexOffset: 0, _expectedShape: RenderShape.Square },
    { indexOffset: 12, _expectedShape: RenderShape.BottomLeftTriangle },
    { indexOffset: 36, _expectedShape: RenderShape.Nothing },
  ])
  .fn(t => {
    const { indexOffset, _expectedShape } = t.params;

    // If this is interpreted as uint16, then it would be 0, 1, 0, ... and would draw nothing.
    // And the index buffer size - offset must be not less than the size required by triangle
    // list, otherwise it also render nothing.
    const indexArray = new Uint32Array([1, 2, 0, 0, 0, 0, 0, 1, 3, 0]);
    const indexBuffer = t.CreateIndexBuffer(indexArray, 'uint32');
    const result = t.run(indexBuffer, indexArray.length, 'uint32', indexOffset);

    const expectedTextureValues = t.CreateExpectedUint8Array(_expectedShape);
    t.expectContents(result, expectedTextureValues);
  });

g.test('primitive_restart')
  .desc('Test primitive restart with each primitive topology.')
  .params(
    params()
      .combine(poptions('indexFormat', ['uint16', 'uint32'] as const))
      .combine(kPrimitiveTopologiesForRestart)
  )
  .fn(t => {
    const { indexFormat, primitiveTopology, _expectedShape } = t.params;

    let indexArray: Uint16Array | Uint32Array;
    // The primitive restart value can used with strip primitive topologies ('line-strip' or 'triangle-strip').
    // For lists, they are expected to be renderred the same as without primitive restart.
    if (indexFormat === 'uint16') {
      if (primitiveTopology === 'triangle-list') {
        // triangles: (0, 1, 3), (2, 1, 0)
        indexArray = new Uint16Array([0, 1, 3, 0xffff, 2, 1, 0, 0]);
      } else if (primitiveTopology === 'triangle-strip') {
        // triangles: (0, 1, 3), (1, 3, 0xffff), (3, 0xffff, 2)
        indexArray = new Uint16Array([0, 1, 3, 0xffff, 2, 2]);
      } else {
        // points: (0), (1), (2), (3)
        // lines(list): (0, 1), (2, 3)
        // lines(strip): (0, 1), (1, 0xffff), (0xffff, 2), (2, 3)
        indexArray = new Uint16Array([0, 1, 0xffff, 2, 3, 3]);
      }
    } else {
      if (primitiveTopology === 'triangle-list') {
        // triangles: (0, 1, 3), (2, 1, 0)
        indexArray = new Uint32Array([0, 1, 3, 0xffffffff, 2, 1, 0]);
      } else if (primitiveTopology === 'triangle-strip') {
        // triangles: (0, 1, 3), (1, 3, 0xffff), (3, 0xffff, 2)
        indexArray = new Uint32Array([0, 1, 3, 0xffffffff, 2]);
      } else {
        // points: (0), (1), (2), (3)
        // lines(list): (0, 1), (2, 3)
        // lines(strip): (0, 1), (1, 0xffff), (0xffff, 2), (2, 3)
        indexArray = new Uint32Array([0, 1, 0xffffffff, 2, 3]);
      }
    }

    const indexBuffer = t.CreateIndexBuffer(indexArray, indexFormat);
    const result = t.run(indexBuffer, indexArray.length, indexFormat, 0, primitiveTopology);

    const expectedTextureValues = t.CreateExpectedUint8Array(_expectedShape);
    t.expectContents(result, expectedTextureValues);
  });
