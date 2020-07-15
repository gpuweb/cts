export const description = `
indexed draws validation tests.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';

import { ValidationTest } from './../../validation_test.js';

class F extends ValidationTest {
  createVertexAndIndexBuffer(): GPUBuffer[] {
    /* prettier-ignore */
    const vertexArray = new Float32Array([
      // float4 position
      1.0, 1.0, 0.0, 1.0,
      1.0, -1.0, 0.0, 1.0,
      -1.0, 1.0, 0.0, 1.0,
      - 1.0, -1.0, 0.0, 1.0
    ]);

    const indexArray = new Uint32Array([0, 1, 2, 3, 1, 2]);

    const [vertexBuffer, vetexMapping] = this.device.createBufferMapped({
      size: vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX,
    });
    new Float32Array(vetexMapping).set(vertexArray);
    vertexBuffer.unmap();

    const [indexBuffer, indexMapping] = this.device.createBufferMapped({
      size: indexArray.byteLength,
      usage: GPUBufferUsage.INDEX,
    });
    new Uint32Array(indexMapping).set(indexArray);
    indexBuffer.unmap();

    return [vertexBuffer, indexBuffer];
  }

  createRenderPipeline(): GPURenderPipeline {
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

  beginRenderPass(encoder: GPUCommandEncoder) {
    const colorAttachment = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 100, height: 100, depth: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.OUTPUT_ATTACHMENT,
    });

    return encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: colorAttachment.createView(),
          loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });
  }

  drawIndexed(
    indexCount: number,
    instanceCount: number,
    firstIndex: number,
    baseVertex: number,
    firstInstance: number
  ) {
    const [vertexBuffer, indexBuffer] = this.createVertexAndIndexBuffer();

    const pipeline = this.createRenderPipeline();

    const encoder = this.device.createCommandEncoder();
    const pass = this.beginRenderPass(encoder);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer);
    pass.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
    pass.endPass();

    this.device.defaultQueue.submit([encoder.finish()]);
  }

  drawIndexedIndirect(bufferArray: Uint32Array, indirectOffset: number) {
    const [indirectBuffer, indirectMapping] = this.device.createBufferMapped({
      size: bufferArray.byteLength,
      usage: GPUBufferUsage.INDIRECT,
    });
    new Uint32Array(indirectMapping).set(bufferArray);
    indirectBuffer.unmap();

    const [vertexBuffer, indexBuffer] = this.createVertexAndIndexBuffer();

    const pipeline = this.createRenderPipeline();

    const encoder = this.device.createCommandEncoder();
    const pass = this.beginRenderPass(encoder);
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, 0);
    pass.drawIndexedIndirect(indirectBuffer, indirectOffset);
    pass.endPass();

    this.device.defaultQueue.submit([encoder.finish()]);
  }
}

export const g = makeTestGroup(F);

g.test('draw_indexed_index_access_out_of_bounds').fn(t => {
  // Works with the indexCount larger than the index buffer size
  {
    t.drawIndexed(7, 1, 0, 0, 0);
  }

  // Works with the firstIndex out of the index buffer range
  {
    t.drawIndexed(6, 1, 6, 0, 0);
  }
});

g.test('draw_indexed_indirect_index_access_out_of_bounds').fn(t => {
  // Works with the indexCount larger than the index buffer size
  {
    t.drawIndexedIndirect(new Uint32Array([7, 1, 0, 0, 0]), 0);
  }

  // Works with the firstIndex out of the index buffer range
  {
    t.drawIndexedIndirect(new Uint32Array([6, 1, 6, 0, 0]), 0);
  }
});
