export const description = `
Ensure state is set correctly. Tries to stress state caching (setting different states multiple
times in different orders) for setIndexBuffer and setVertexBuffer.
Equivalent tests for setBindGroup and setPipeline are in programmable/state_tracking.spec.ts.
Equivalent tests for viewport/scissor/blend/reference are in render/dynamic_state.spec.ts

TODO: plan and implement
- try changing the pipeline {before,after} the vertex/index buffers.
  (In D3D12, the vertex buffer stride is part of SetVertexBuffer instead of the pipeline.)
- Test that drawing after having set vertex buffer slots not used by the pipeline.
- Test that setting / not setting the index buffer does not impact a non-indexed draw.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';

class VertexAndIndexStateTrackingTest extends GPUTest {
  GetRenderPipelineForTest(): GPURenderPipeline {
    return this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: `
        struct Inputs {
          [[location(0)]] vertexPosition : f32;
          [[location(1)]] vertexColor : vec4<f32>;
        };
        struct Outputs {
          [[builtin(position)]] position : vec4<f32>;
          [[location(0)]] color : vec4<f32>;
        };
        [[stage(vertex)]]
        fn main(input : Inputs)-> Outputs {
          var outputs : Outputs;
          outputs.position =
            vec4<f32>(input.vertexPosition, 0.5, 0.0, 1.0);
          outputs.color = input.vertexColor;
          return outputs;
        }`,
        }),
        entryPoint: 'main',
        buffers: [
          {
            arrayStride: this.kVertexAttributeSize,
            attributes: [
              {
                format: 'float32',
                offset: 0,
                shaderLocation: 0,
              },
              {
                format: 'unorm8x4',
                offset: 4,
                shaderLocation: 1,
              },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({
          code: `
        struct Input {
          [[location(0)]] color : vec4<f32>;
        };
        [[stage(fragment)]]
        fn main(input : Input) -> [[location(0)]] vec4<f32> {
          return input.color;
        }`,
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: {
        topology: 'point-list',
      },
    });
  }

  kVertexAttributeSize = 8;
}

export const g = makeTestGroup(VertexAndIndexStateTrackingTest);

g.test('set_index_buffer_without_changing_buffer')
  .desc(
    `
  Test that setting index buffer states (index format, offset, size) multiple times in different
  orders still keeps the correctness of each draw call.
`
  )
  .fn(async t => {
    // Initialize the index buffer with 5 uint16 indices (0, 1, 2, 3, 4).
    const indexBuffer = t.makeBufferWithContents(
      new Uint16Array([0, 1, 2, 3, 4]),
      GPUBufferUsage.INDEX
    );

    // Initialize the vertex buffer with required vertex attributes (position: f32, color: f32x4)
    // Note that the maximum index in the test is 0x10000.
    const kVertexAttributesCount = 0x10000 + 1;
    const vertexBuffer = t.device.createBuffer({
      usage: GPUBufferUsage.VERTEX,
      size: t.kVertexAttributeSize * kVertexAttributesCount,
      mappedAtCreation: true,
    });
    t.trackForCleanup(vertexBuffer);
    const vertexAttributes = vertexBuffer.getMappedRange();
    const kPositions = [-0.8, -0.4, 0.0, 0.4, 0.8, -0.4];
    const kColors = [
      new Uint8Array([255, 0, 0, 255]),
      new Uint8Array([255, 255, 255, 255]),
      new Uint8Array([0, 0, 255, 255]),
      new Uint8Array([255, 0, 255, 255]),
      new Uint8Array([0, 255, 255, 255]),
      new Uint8Array([0, 255, 0, 255]),
    ];
    // Set vertex attributes at index {0..4} in Uint16.
    // Note that the vertex attribute at index 1 will not be used.
    for (let i = 0; i < kPositions.length - 1; ++i) {
      const baseOffset = t.kVertexAttributeSize * i;
      const vertexPosition = new Float32Array(vertexAttributes, baseOffset, 1);
      vertexPosition[0] = kPositions[i];
      const vertexColor = new Uint8Array(vertexAttributes, baseOffset + 4, 4);
      vertexColor.set(kColors[i]);
    }
    // Set vertex attributes at index 0x10000.
    const lastOffset = t.kVertexAttributeSize * (kVertexAttributesCount - 1);
    const lastVertexPosition = new Float32Array(vertexAttributes, lastOffset, 1);
    lastVertexPosition[0] = kPositions[kPositions.length - 1];
    const lastVertexColor = new Uint8Array(vertexAttributes, lastOffset + 4, 4);
    lastVertexColor.set(kColors[kColors.length - 1]);

    vertexBuffer.unmap();

    const renderPipeline = t.GetRenderPipelineForTest();

    const outputTexture = t.device.createTexture({
      format: 'rgba8unorm',
      size: [kPositions.length - 1, 1, 1],
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const encoder = t.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: outputTexture.createView(),
          loadValue: [0, 0, 0, 1],
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);

    // 1st draw: indexFormat = 'uint32', offset = 0, size = 4 (index value: 0x10000)
    renderPass.setIndexBuffer(indexBuffer, 'uint32', 0, 4);
    renderPass.drawIndexed(1);

    // 2nd draw: indexFormat = 'uint16', offset = 0, size = 4 (index value: 0)
    renderPass.setIndexBuffer(indexBuffer, 'uint16', 0, 4);
    renderPass.drawIndexed(1);

    // 3rd draw: indexFormat = 'uint16', offset = 4, size = 2 (index value: 2)
    renderPass.setIndexBuffer(indexBuffer, 'uint16', 0, 2);
    renderPass.setIndexBuffer(indexBuffer, 'uint16', 4, 2);
    renderPass.drawIndexed(1);

    // 4th draw: indexformat = 'uint16', offset = 6, size = 4 (index values: 3, 4)
    renderPass.setIndexBuffer(indexBuffer, 'uint16', 6, 2);
    renderPass.setIndexBuffer(indexBuffer, 'uint16', 6, 4);
    renderPass.drawIndexed(2);

    renderPass.endPass();
    t.queue.submit([encoder.finish()]);

    for (let i = 0; i < kPositions.length - 1; ++i) {
      const expectedColor = i === 1 ? kColors[kPositions.length - 1] : kColors[i];
      t.expectSinglePixelIn2DTexture(
        outputTexture,
        'rgba8unorm',
        { x: i, y: 0 },
        { exp: expectedColor }
      );
    }
  });

g.test('set_vertex_buffer_without_changing_buffer')
  .desc(
    `
  Test that setting vertex buffer states (offset, size) multiple times in different orders still
  keeps the correctness of each draw call.
`
  )
  .params(u =>
    u.combine('drawParams', [
      [
        // Change 'size' then 'offset' in setVertexBuffer()
        { offset: 0, vertices: 1 },
        { offset: 0, vertices: 2 },
        { offset: 2, vertices: 2 },
      ],
      [
        // Change 'offset' then 'size' in setVertexBuffer()
        { offset: 0, vertices: 1 },
        { offset: 1, vertices: 1 },
        { offset: 1, vertices: 3 },
      ],
    ] as const)
  )
  .fn(async t => {
    const { drawParams } = t.params;

    const kPositions = [-0.75, -0.25, 0.25, 0.75];
    const kColors = [
      new Uint8Array([255, 0, 0, 255]),
      new Uint8Array([0, 255, 0, 255]),
      new Uint8Array([0, 0, 255, 255]),
      new Uint8Array([255, 0, 255, 255]),
    ];

    // Initialize the vertex buffer with required vertex attributes (position: f32, color: f32x4)
    const kVertexAttributesCount = 4;
    const vertexBuffer = t.device.createBuffer({
      usage: GPUBufferUsage.VERTEX,
      size: t.kVertexAttributeSize * kVertexAttributesCount,
      mappedAtCreation: true,
    });
    t.trackForCleanup(vertexBuffer);
    const vertexAttributes = vertexBuffer.getMappedRange();
    for (let i = 0; i < kPositions.length; ++i) {
      const baseOffset = t.kVertexAttributeSize * i;
      const vertexPosition = new Float32Array(vertexAttributes, baseOffset, 1);
      vertexPosition[0] = kPositions[i];
      const vertexColor = new Uint8Array(vertexAttributes, baseOffset + 4, 4);
      vertexColor.set(kColors[i]);
    }

    vertexBuffer.unmap();

    const renderPipeline = t.GetRenderPipelineForTest();

    const outputTexture = t.device.createTexture({
      format: 'rgba8unorm',
      size: [kPositions.length, 1, 1],
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const encoder = t.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: outputTexture.createView(),
          loadValue: [0, 0, 0, 1],
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);

    for (const drawParam of drawParams) {
      renderPass.setVertexBuffer(
        0,
        vertexBuffer,
        drawParam.offset * t.kVertexAttributeSize,
        drawParam.vertices * t.kVertexAttributeSize
      );
      renderPass.draw(drawParam.vertices);
    }
    renderPass.endPass();
    t.queue.submit([encoder.finish()]);

    for (let i = 0; i < kPositions.length; ++i) {
      t.expectSinglePixelIn2DTexture(
        outputTexture,
        'rgba8unorm',
        { x: i, y: 0 },
        { exp: kColors[i] }
      );
    }
  });
