export const description = `Test indexing, index format and primitive restart.

TODO(hao.x.li@intel.com): Test that use the primitive restart values as real indices with
non-strip topologies, to make sure those behave properly (and primitive restart is appropriately
enabled/disabled) across backends. These tests will be important for gpuweb/gpuweb#1220.
`;

import { params, poptions } from '../../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { getTextureCopyLayout } from '../../../util/texture/layout.js';

const kHeight = 4;
const kWidth = 4;
const kTextureFormat = 'bgra8unorm' as const;
const kGreen = new Uint8Array([0x00, 0xff, 0x00, 0xff]); // green
const kBlack = new Uint8Array([0x00, 0x00, 0x00, 0xff]); // black

type Raster4x4 = readonly [
  readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1],
  readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1],
  readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1],
  readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1]
];

/** Expected 4x4 rasterization of 4 points. */
const kPoints: Raster4x4 = [
  [1, 0, 0, 1],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [1, 0, 0, 1],
];

/** Expected 4x4 rasterization of a diagonal line. */
const kLine: Raster4x4 = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

/** Expected 4x4 rasterization of two lines forming an X. */
const kXShape: Raster4x4 = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, 1, 1, 0],
  [1, 0, 0, 1],
];

/** Expected 4x4 rasterization of a bottom-left triangle. */
const kBottomLeftTriangle: Raster4x4 = [
  [0, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 1, 0, 0],
  [1, 1, 1, 0],
];

/** Expected 4x4 rasterization of two overlapping triangles in a concave shape. */
const kConcaveShape: Raster4x4 = [
  [0, 0, 0, 1],
  [1, 0, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
];

/** Expected 4x4 rasterization filling the whole quad. */
const kSquare: Raster4x4 = [
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
];

/** Expected 4x4 rasterization with no pixels. */
const kNothing: Raster4x4 = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

const kPrimitiveTopologiesForRestart = [
  { primitiveTopology: 'point-list', _expectedShape: kPoints },
  { primitiveTopology: 'line-list', _expectedShape: kLine },
  { primitiveTopology: 'line-strip', _expectedShape: kXShape },
  { primitiveTopology: 'triangle-list', _expectedShape: kBottomLeftTriangle },
  { primitiveTopology: 'triangle-strip', _expectedShape: kConcaveShape },
] as const;

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
        const pos: array<vec2<f32>, 4> = array<vec2<f32>, 4>(
          vec2<f32>(-1.0, 1.0),
          vec2<f32>(1.0, -1.0),
          vec2<f32>(1.0, 1.0),
          vec2<f32>(-1.0, -1.0));

        [[builtin(position)]] var<out> Position : vec4<f32>;
        [[builtin(vertex_idx)]] var<in> VertexIndex : u32;

        [[stage(vertex)]]
        fn main() -> void {
          Position = vec4<f32>(pos[VertexIndex], 0.0 , 1.0);
        }
      `,
    });

    const fragmentModule = this.device.createShaderModule({
      code: `
        [[location(0)]] var<out> fragColor : vec4<f32>;

        [[stage(fragment)]]
        fn main() -> void {
          fragColor = vec4<f32>(0.0, 1.0, 0.0, 1.0);
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
      },
    });
  }

  CreateIndexBuffer(indices: number[], indexFormat: GPUIndexFormat): GPUBuffer {
    const typedArrayConstructor = { uint16: Uint16Array, uint32: Uint32Array }[indexFormat];

    const indexBuffer = this.device.createBuffer({
      size: indices.length * typedArrayConstructor.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });

    new typedArrayConstructor(indexBuffer.getMappedRange()).set(indices);

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
    pass.setIndexBuffer(indexBuffer, indexFormat, indexOffset);
    pass.drawIndexed(indexCount);
    pass.endPass();
    encoder.copyTextureToBuffer(
      { texture: colorAttachment },
      { buffer: result, bytesPerRow, rowsPerImage },
      [kWidth, kHeight]
    );
    this.device.defaultQueue.submit([encoder.finish()]);

    return result;
  }

  CreateExpectedUint8Array(renderShape: Raster4x4): Uint8Array {
    const arrayBuffer = new Uint8Array(byteLength);
    for (let row = 0; row < renderShape.length; row++) {
      for (let col = 0; col < renderShape[row].length; col++) {
        const texel: 0 | 1 = renderShape[row][col];
        const texelValueBytes = texel === 1 ? kGreen : kBlack;

        const kBytesPerTexel = 4;
        const byteOffset = row * bytesPerRow + col * kBytesPerTexel;
        arrayBuffer.set(texelValueBytes, byteOffset);
      }
    }
    return arrayBuffer;
  }
}

export const g = makeTestGroup(IndexFormatTest);

g.test('index_format,uint16')
  .desc('Test rendering result of indexed draw with index format of uint16.')
  .params([
    { indexOffset: 0, _expectedShape: kSquare },
    { indexOffset: 6, _expectedShape: kBottomLeftTriangle },
    { indexOffset: 18, _expectedShape: kNothing },
  ])
  .fn(t => {
    const { indexOffset, _expectedShape } = t.params;

    // If this is written as uint16 but interpreted as uint32, it will have index 1 and 2 be both 0
    // and render nothing.
    // And the index buffer size - offset must be not less than the size required by triangle
    // list, otherwise it also render nothing.
    const indices: number[] = [1, 2, 0, 0, 0, 0, 0, 1, 3, 0];
    const indexBuffer = t.CreateIndexBuffer(indices, 'uint16');
    const result = t.run(indexBuffer, indices.length, 'uint16', indexOffset);

    const expectedTextureValues = t.CreateExpectedUint8Array(_expectedShape);
    t.expectContents(result, expectedTextureValues);
  });

g.test('index_format,uint32')
  .desc('Test rendering result of indexed draw with index format of uint32.')
  .params([
    { indexOffset: 0, _expectedShape: kSquare },
    { indexOffset: 12, _expectedShape: kBottomLeftTriangle },
    { indexOffset: 36, _expectedShape: kNothing },
  ])
  .fn(t => {
    const { indexOffset, _expectedShape } = t.params;

    // If this is interpreted as uint16, then it would be 0, 1, 0, ... and would draw nothing.
    // And the index buffer size - offset must be not less than the size required by triangle
    // list, otherwise it also render nothing.
    const indices: number[] = [1, 2, 0, 0, 0, 0, 0, 1, 3, 0];
    const indexBuffer = t.CreateIndexBuffer(indices, 'uint32');
    const result = t.run(indexBuffer, indices.length, 'uint32', indexOffset);

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

    let indices: number[];
    // The primitive restart value can used with strip primitive topologies ('line-strip' or 'triangle-strip').
    // For lists, the primitive restart value isn't special and should be treated as a regular index value.
    if (primitiveTopology === 'triangle-list') {
      // -> triangle-list: (0, 1, 3), (-1, 2, 1)
      // triangle-list with restart: (0, 1, 3), (2, 1, 0)
      // triangle-strip: (0, 1, 3), (2, 1, 0), (1, 0, 0)
      // triangle-strip w/o restart: (0, 1, 3), (1, 3, -1), (3, -1, 2), (-1, 2, 1), (2, 1, 0), (1, 0, 0)
      indices = [0, 1, 3, -1, 2, 1, 0, 0];
    } else if (primitiveTopology === 'triangle-strip') {
      // -> triangle-strip : (3, 1, 0), (2, 2, 1), (2, 1, 3)
      // triangle-strip w/o restart: (3, 1, 0), (1, 0, -1), (0, -1, 2), (2, 2, 1,), (2, 3, 1)
      // triangle-list: (3, 1, 0), (-1, 2, 2)
      // triangle-list with restart: (3, 1, 0), (2, 2, 1)
      indices = [3, 1, 0, -1, 2, 2, 1, 3];
    } else {
      // -> point: (0), (1), (-1), (2), (3), (3)
      // -> line-list: (0, 1), (-1, 2), (3, 3)
      // line-list with restart: (0, 1), (2, 3)
      // -> line-strip: (0, 1), (2, 3), (3, 3)
      // line-strip w/o restart: (0, 1), (1, -1), (-1, 2), (2, 3), (3, 3)
      indices = [0, 1, -1, 2, 3, 3];
    }

    const indexBuffer = t.CreateIndexBuffer(indices, indexFormat);
    const result = t.run(indexBuffer, indices.length, indexFormat, 0, primitiveTopology);

    const expectedTextureValues = t.CreateExpectedUint8Array(_expectedShape);
    t.expectContents(result, expectedTextureValues);
  });
