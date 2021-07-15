export const description = `
Basic command buffer rendering tests.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { now } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { checkElementsEqual } from '../../../util/check_contents.js';

export const g = makeTestGroup(GPUTest);

g.test('clear').fn(async t => {
  const dst = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const colorAttachment = t.device.createTexture({
    format: 'rgba8unorm',
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const colorAttachmentView = colorAttachment.createView();

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: colorAttachmentView,
        loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
        storeOp: 'store',
      },
    ],
  });
  pass.endPass();
  encoder.copyTextureToBuffer(
    { texture: colorAttachment, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { buffer: dst, bytesPerRow: 256 },
    { width: 1, height: 1, depthOrArrayLayers: 1 }
  );
  t.device.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(dst, new Uint8Array([0x00, 0xff, 0x00, 0xff]));
});

g.test('fullscreen_quad').fn(async t => {
  const dst = t.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const colorAttachment = t.device.createTexture({
    format: 'rgba8unorm',
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const colorAttachmentView = colorAttachment.createView();

  const pipeline = t.device.createRenderPipeline({
    vertex: {
      module: t.device.createShaderModule({
        code: `
        [[stage(vertex)]] fn main(
          [[builtin(vertex_index)]] VertexIndex : u32
          ) -> [[builtin(position)]] vec4<f32> {
            var pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
                vec2<f32>(-1.0, -3.0),
                vec2<f32>(3.0, 1.0),
                vec2<f32>(-1.0, 1.0));
            return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
          }
          `,
      }),
      entryPoint: 'main',
    },
    fragment: {
      module: t.device.createShaderModule({
        code: `
          [[stage(fragment)]] fn main() -> [[location(0)]] vec4<f32> {
            return vec4<f32>(0.0, 1.0, 0.0, 1.0);
          }
          `,
      }),
      entryPoint: 'main',
      targets: [{ format: 'rgba8unorm' }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const encoder = t.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: colorAttachmentView,
        storeOp: 'store',
        loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.draw(3);
  pass.endPass();
  encoder.copyTextureToBuffer(
    { texture: colorAttachment, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { buffer: dst, bytesPerRow: 256 },
    { width: 1, height: 1, depthOrArrayLayers: 1 }
  );
  t.device.queue.submit([encoder.finish()]);

  t.expectGPUBufferValuesEqual(dst, new Uint8Array([0x00, 0xff, 0x00, 0xff]));
});

g.test('large_draw')
  .desc(
    `Test reasonably-sized large {draw, drawIndexed} (see also stress tests).

  Tests that draw calls behave reasonably with large vertex counts for
  non-indexed draws, large index counts for indexed draws, and large instance
  counts in both cases. Various combinations of these counts are tested with
  both direct and indrect draw calls.

  Draw call sizes are increased incrementally over these parameters until we the
  run out of values or completion of a draw call exceeds a fixed time limit of
  100ms.

  To validate that the drawn vertices actually made it though the pipeline on
  each draw call, we render a 3x3 target with the position the first and last
  vertices of the first and last instances in different respective corners, an
  everything else positioned to cover only one of the intermediate fragments.

  Params:
    - indexed= {true, false} - whether to test indexed or non-indexed draw calls
    - indirect= {true, false} - whether to use indirect or direct draw calls`
  )
  .params(u =>
    u //
      .combine('indexed', [true, false])
      .combine('indirect', [true, false])
  )
  .fn(async t => {
    const { indexed, indirect } = t.params;

    const BYTES_PER_ROW = 256;
    const dst = t.device.createBuffer({
      size: 3 * BYTES_PER_ROW,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const indirectBuffer = t.device.createBuffer({
      size: 20,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    });
    const writeIndirectParams = (count: number, instanceCount: number) => {
      const params = new Uint32Array(5);
      params[0] = count; // Vertex or index count
      params[1] = instanceCount;
      params[2] = 0; // First vertex or index
      params[3] = 0; // First instance (non-indexed) or base vertex (indexed)
      params[4] = 0; // First instance (indexed)
      t.device.queue.writeBuffer(indirectBuffer, 0, params, 0, 5);
    };

    const MILLION = 1024 * 1024;
    const MAX_INDICES = 16 * MILLION;
    const indexBuffer = t.device.createBuffer({
      size: MAX_INDICES * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    const indexData = new Uint32Array(MILLION);
    for (let offset = 0; offset < MAX_INDICES; offset += MILLION) {
      for (let k = 0; k < MILLION; ++k) {
        indexData[k] = offset + k;
      }
      t.device.queue.writeBuffer(
        indexBuffer,
        offset * Uint32Array.BYTES_PER_ELEMENT,
        indexData,
        0,
        MILLION
      );
    }

    const colorAttachment = t.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 3, height: 3, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const colorAttachmentView = colorAttachment.createView();

    const runPipeline = async (numInstances: number, numVertices: number) => {
      const pipeline = t.device.createRenderPipeline({
        vertex: {
          module: t.device.createShaderModule({
            code: `
            struct Output {
              [[builtin(position)]] position: vec4<f32>;
              [[location(0)]] color: vec4<f32>;
            };

            fn selectValue(index: u32, maxIndex: u32) -> f32 {
              let highOrMid = select(1.0, 0.5, index == maxIndex - 1u);
              return select(0.0, highOrMid, index == 0u);
            }

            [[stage(vertex)]] fn main(
                [[builtin(vertex_index)]] v: u32,
                [[builtin(instance_index)]] i: u32)
                -> Output {
              let r = selectValue(v, ${numVertices}u);
              let b = selectValue(i, ${numInstances}u);
              let x = (r * 4.0 - 2.0) / 3.0;
              let y = (b * 4.0 - 2.0) / -3.0;
              return Output(vec4<f32>(x, y, 0.0, 1.0),
                            vec4<f32>(r, 0.0, b, 1.0));
            }
            `,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module: t.device.createShaderModule({
            code: `
              [[stage(fragment)]] fn main([[location(0)]] color: vec4<f32>)
                  -> [[location(0)]] vec4<f32> {
                return color;
              }
              `,
          }),
          entryPoint: 'main',
          targets: [{ format: 'rgba8unorm' }],
        },
        primitive: { topology: 'point-list' },
      });

      const encoder = t.device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: colorAttachmentView,
            storeOp: 'store',
            loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
          },
        ],
      });

      pass.setPipeline(pipeline);
      if (indexed) {
        pass.setIndexBuffer(indexBuffer, 'uint32');
      }

      if (indirect) {
        writeIndirectParams(numVertices, numInstances);
        if (indexed) {
          pass.drawIndexedIndirect(indirectBuffer, 0);
        } else {
          pass.drawIndirect(indirectBuffer, 0);
        }
      } else {
        if (indexed) {
          pass.drawIndexed(numVertices, numInstances);
        } else {
          pass.draw(numVertices, numInstances);
        }
      }
      pass.endPass();
      encoder.copyTextureToBuffer(
        { texture: colorAttachment, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
        { buffer: dst, bytesPerRow: BYTES_PER_ROW },
        { width: 3, height: 3, depthOrArrayLayers: 1 }
      );
      t.device.queue.submit([encoder.finish()]);

      // Red should go 0, 127, 255 from left to right. Blue should to the same
      // from top to bottom.
      const expectedRows = [
        [0x00, 0x00, 0x00, 0xff, 0x7f, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0xff],
        [0x00, 0x00, 0x7f, 0xff, 0x7f, 0x00, 0x7f, 0xff, 0xff, 0x00, 0x7f, 0xff],
        [0x00, 0x00, 0xff, 0xff, 0x7f, 0x00, 0xff, 0xff, 0xff, 0x00, 0xff, 0xff],
      ];
      for (const row of [0, 1, 2]) {
        t.expectGPUBufferValuesPassCheck(
          dst,
          data => checkElementsEqual(data, new Uint8Array(expectedRows[row])),
          { srcByteOffset: row * 256, type: Uint8Array, typedLength: 12 }
        );
      }
    };

    // If any iteration takes longer than this, we stop incrementing along that
    // branch and move on to the next instance count. Note that the max
    // supported vertex count for any iteration is 2**24 due to our choice of
    // index buffer size.
    const maxDurationMs = 100;
    const counts: { numInstances: number; vertexCounts: number[] }[] = [
      {
        numInstances: 4,
        vertexCounts: [2 ** 10, 2 ** 16, 2 ** 18, 2 ** 20, 2 ** 22, 2 ** 24],
      },
      {
        numInstances: 2 ** 8,
        vertexCounts: [2 ** 10, 2 ** 16, 2 ** 18, 2 ** 20, 2 ** 22],
      },
      {
        numInstances: 2 ** 10,
        vertexCounts: [2 ** 8, 2 ** 10, 2 ** 12, 2 ** 16, 2 ** 18, 2 ** 20],
      },
      {
        numInstances: 2 ** 16,
        vertexCounts: [2 ** 4, 2 ** 8, 2 ** 10, 2 ** 12, 2 ** 14],
      },
      {
        numInstances: 2 ** 20,
        vertexCounts: [2 ** 4, 2 ** 8, 2 ** 10],
      },
    ];
    for (const { numInstances, vertexCounts } of counts) {
      let lastRunDuration = null;
      for (const numVertices of vertexCounts) {
        const start = now();
        runPipeline(numInstances, numVertices);
        await t.device.queue.onSubmittedWorkDone();
        lastRunDuration = now() - start;
        if (lastRunDuration >= maxDurationMs) {
          // If this vertex count took too long to draw, move on to the next
          // instance count.
          break;
        }
      }
    }
  });
