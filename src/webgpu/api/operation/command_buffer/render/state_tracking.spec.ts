export const description = `
Ensure state is set correctly. Tries to stress state caching (setting different states multiple
times in different orders) for setIndexBuffer and setVertexBuffer.
Equivalent tests for setBindGroup and setPipeline are in programmable/state_tracking.spec.ts.
Equivalent tests for viewport/scissor/blend/reference are in render/dynamic_state.spec.ts

TODO: plan and implement
- try setting states multiple times in different orders, check state is correct in a draw call.
    - setVertexBuffer: specifically test changing the offset, size, without changing the buffer
- try changing the pipeline {before,after} the vertex/index buffers.
  (In D3D12, the vertex buffer stride is part of SetVertexBuffer instead of the pipeline.)
- Test that drawing after having set vertex buffer slots not used by the pipeline.
- Test that setting / not setting the index buffer does not impact a non-indexed draw.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('set_index_buffer_without_changing_buffer')
  .desc(
    `
  Test that setting index buffer states (index format, offset, size) multiple times in different
  orders still keeps the correctness of each draw call.
`
  )
  .fn(async t => {
    // Initialize the index buffer with 5 uint16 indices (0, 1, 2, 3, 4).
    // 0 is a padding to make sure the buffer size is a multiple of 4.
    // TODO: remove the padding after the issue in makeBufferWithContents() is fixed.
    const indexBuffer = t.makeBufferWithContents(
      new Uint16Array([0, 1, 2, 3, 4, 0]),
      GPUBufferUsage.INDEX
    );

    // Initialize the vertex buffer with required vertex attributes (position: f32x2, color: f32x4)
    // Note that the maximum index in the test is 0x10000.
    const kVertexAttributeSize = 8;
    const kVertexAttributesCount = 0x10000 + 1;
    const vertexBuffer = t.device.createBuffer({
      usage: GPUBufferUsage.VERTEX,
      size: kVertexAttributeSize * kVertexAttributesCount,
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
      const baseOffset = kVertexAttributeSize * i;
      const vertexPosition = new Float32Array(vertexAttributes, baseOffset, 1);
      vertexPosition[0] = kPositions[i];
      const vertexColor = new Uint8Array(vertexAttributes, baseOffset + 4, 4);
      vertexColor.set(kColors[i]);
    }
    // Set vertex attributes at index 0x10000.
    const lastOffset = kVertexAttributeSize * (kVertexAttributesCount - 1);
    const lastVertexPosition = new Float32Array(vertexAttributes, lastOffset, 1);
    lastVertexPosition[0] = kPositions[kPositions.length - 1];
    const lastVertexColor = new Uint8Array(vertexAttributes, lastOffset + 4, 4);
    lastVertexColor.set(kColors[kColors.length - 1]);

    vertexBuffer.unmap();

    const renderPipeline = t.device.createRenderPipeline({
      vertex: {
        module: t.device.createShaderModule({
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
            arrayStride: kVertexAttributeSize,
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
        module: t.device.createShaderModule({
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

    // 2nd draw: indexFormat = 'uint16', offset = 0, size = 2 (index value: 0)
    renderPass.setIndexBuffer(indexBuffer, 'uint16', 0, 2);
    renderPass.drawIndexed(1);

    // 3rd draw: indexFormat = 'uint16', offset = 4, size = 2 (index value: 2)
    renderPass.setIndexBuffer(indexBuffer, 'uint16', 4, 2);
    renderPass.drawIndexed(1);

    // 4th draw: indexformat = 'uint16', offset = 6, size = 4 (index values: 3, 4)
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
