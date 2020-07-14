export const description = `
Test vertex attributes behave correctly (no crash / data leak) when accessed out of bounds

Test coverage:

The following will be parameterized (all combinations tested):

1) Draw call indexed? (false / true)
  - Run the draw call using an index buffer

2) Draw call indirect? (false / true)
  - Run the draw call using an indirect buffer

3) Draw call parameter (vertexCount, firstVertex, indexCount, firstIndex, baseVertex, instanceCount,
  firstInstance)
  - The parameter which will go out of bounds. Filtered depending on if the draw call is indexed.

4) Attribute type (float, vec2, vec3, vec4)
  - The input attribute type in the vertex shader

5) Error scale (1, 4, 10^2, 10^4, 10^6)
  - Offset to add to the correct draw call parameter

6) Additional vertex buffers (0, +4)
  - Tests that no OOB occurs if more vertex buffers are used

The tests will also have another vertex buffer bound for an instanced attribute, to make sure
instanceCount / firstInstance are tested.

The tests will include multiple attributes per vertex buffer.

The vertex buffers will be filled by repeating a few chosen values until the end of the buffer.

The test will run a render pipeline which verifies the following:
1) All vertex attribute values occur in the buffer or are zero
2) All gl_VertexIndex values are within the index buffer or 0

TODO:

A suppression may be needed for d3d12 on tests that have non-zero baseVertex, since d3d12 counts
from 0 instead of from baseVertex (will fail check for gl_VertexIndex).

Vertex buffer contents could be randomized to prevent the case where a previous test creates
a similar buffer to ours and the OOB-read seems valid. This should be deterministic, which adds
more complexity that we may not need.`;

import { params, pbool, poptions } from '../../../common/framework/params_builder.js';
import { makeTestGroup } from '../../../common/framework/test_group.js';
import { GPUTest } from '../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

// Arguments for a regular draw call
enum NonIndexedDrawCallParameter {
  VertexCount = 'VertexCount',
  FirstVertex = 'FirstVertex',
  InstanceCount = 'InstanceCount',
  FirstInstance = 'FirstInstance',
}

// Arguments for an indexed draw call
enum IndexedDrawCallParameter {
  IndexCount = 'IndexCount',
  FirstIndex = 'FirstIndex',
  BaseVertex = 'BaseVertex',
  InstanceCount = 'InstanceCount',
  FirstInstance = 'FirstInstance',
}

// Combins both sets of parameters so we can pass one parameter 'to-be-tested'
const DrawCallParameter = { ...NonIndexedDrawCallParameter, ...IndexedDrawCallParameter };
type DrawCallParameter = typeof DrawCallParameter;
const kDrawCallParameters = Object.keys(DrawCallParameter);

// Encapsulates a draw call (either indexed or non-indexed)
class DrawCall {
  private device: GPUDevice;
  private vertexBuffers: GPUBuffer[];
  private indexBuffer: GPUBuffer;
  private slotsPerBuffer: number;

  // Draw
  public vertexCount: number;
  public firstVertex: number;

  // DrawIndexed
  public indexCount: number;
  public firstIndex: number;
  public baseVertex: number;

  // Both Draw and DrawIndexed
  public instanceCount: number;
  public firstInstance: number;

  constructor(
    device: GPUDevice,
    vertexArrays: Float32Array[],
    vertexCount: number,
    slotsPerBuffer: number
  ) {
    this.device = device;
    this.slotsPerBuffer = slotsPerBuffer;
    this.vertexBuffers = vertexArrays.map(v => this.GenerateVertexBuffer(v));

    let indexArray = new Uint16Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      indexArray[i] = i;
    }
    this.indexBuffer = this.GenerateIndexBuffer(indexArray);

    // Default arguments (valid call)
    this.vertexCount = vertexCount;
    this.firstVertex = 0;
    this.indexCount = vertexCount;
    this.firstIndex = 0;
    this.baseVertex = 0;
    this.instanceCount = vertexCount;
    this.firstInstance = 0;
  }

  // Insert a draw call into |pass|
  public Draw(pass: GPURenderPassEncoder) {
    this.BindVertexBuffers(pass);
    pass.draw(this.vertexCount, this.instanceCount, this.firstVertex, this.firstInstance);
  }

  // Insert an indexed draw call into |pass|
  public DrawIndexed(pass: GPURenderPassEncoder) {
    this.BindVertexBuffers(pass);
    pass.setIndexBuffer(this.indexBuffer);
    pass.drawIndexed(
      this.indexCount,
      this.instanceCount,
      this.firstIndex,
      this.baseVertex,
      this.firstInstance
    );
  }

  // Insert an indirect draw call into |pass|
  public DrawIndirect(pass: GPURenderPassEncoder) {
    this.BindVertexBuffers(pass);
    pass.drawIndirect(this.GenerateIndirectBuffer(), 0);
  }

  // Insert an indexed indirect draw call into |pass|
  public DrawIndexedIndirect(pass: GPURenderPassEncoder) {
    this.BindVertexBuffers(pass);
    pass.setIndexBuffer(this.indexBuffer);
    pass.drawIndexedIndirect(this.GenerateIndexedIndirectBuffer(), 0);
  }

  // Bind all vertex buffers generated
  private BindVertexBuffers(pass: GPURenderPassEncoder) {
    let currSlot = 0;
    for (let i = 0; i < this.vertexBuffers.length; i++) {
      for (let j = 0; j < this.slotsPerBuffer; j++) {
        pass.setVertexBuffer(currSlot++, this.vertexBuffers[i]);
      }
    }
  }

  // Create a vertex buffer from |vertexArray|
  private GenerateVertexBuffer(vertexArray: Float32Array): GPUBuffer {
    const [vertexBuffer, vertexMapping] = this.device.createBufferMapped({
      size: vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX,
    });
    new Float32Array(vertexMapping).set(vertexArray);
    vertexBuffer.unmap();
    return vertexBuffer;
  }

  // Create an index buffer from |indexArray|
  private GenerateIndexBuffer(indexArray: Uint16Array): GPUBuffer {
    const [indexBuffer, indexMapping] = this.device.createBufferMapped({
      size: indexArray.byteLength,
      usage: GPUBufferUsage.INDEX,
    });
    new Uint16Array(indexMapping).set(indexArray);
    indexBuffer.unmap();
    return indexBuffer;
  }

  // Create an indirect buffer containing draw call values
  private GenerateIndirectBuffer(): GPUBuffer {
    const indirectArray = new Int32Array([
      this.vertexCount,
      this.instanceCount,
      this.firstVertex,
      this.firstInstance,
    ]);
    const [indirectBuffer, indirectMapping] = this.device.createBufferMapped({
      size: indirectArray.byteLength,
      usage: GPUBufferUsage.INDIRECT,
    });
    new Int32Array(indirectMapping).set(indirectArray);
    indirectBuffer.unmap();
    return indirectBuffer;
  }

  // Create an indirect buffer containing indexed draw call values
  private GenerateIndexedIndirectBuffer(): GPUBuffer {
    const indirectArray = new Int32Array([
      this.indexCount,
      this.instanceCount,
      this.firstVertex,
      this.baseVertex,
      this.firstInstance,
    ]);
    const [indirectBuffer, indirectMapping] = this.device.createBufferMapped({
      size: indirectArray.byteLength,
      usage: GPUBufferUsage.INDIRECT,
    });
    new Int32Array(indirectMapping).set(indirectArray);
    indirectBuffer.unmap();
    return indirectBuffer;
  }
}

// Parameterize different sized types
interface Type {
  format: GPUVertexFormat;
  size: number;
  validationFunc: string;
}

const typeInfoMap: { [k: string]: Type } = {
  float: {
    format: 'float',
    size: 4,
    validationFunc: 'return valid(v);',
  },
  vec2: {
    format: 'float2',
    size: 8,
    validationFunc: 'return valid(v.x) && valid(v.y);',
  },
  vec3: {
    format: 'float3',
    size: 12,
    validationFunc: 'return valid(v.x) && valid(v.y) && valid(v.z);',
  },
  vec4: {
    format: 'float4',
    size: 16,
    validationFunc: `return valid(v.x) && valid(v.y) && valid(v.z) && valid(v.w) ||
                            v.x == 0 && v.y == 0 && v.z == 0 && (v.w == 0.0 || v.w == 1.0);`,
  },
};

g.test('vertexAccess')
  .params(
    params()
      .combine(pbool('indexed'))
      .combine(pbool('indirect'))
      .combine(poptions('drawCallTestParameter', kDrawCallParameters))
      .filter(
        ({ indexed, drawCallTestParameter }) =>
          (indexed && drawCallTestParameter in IndexedDrawCallParameter) ||
          (!indexed && drawCallTestParameter in NonIndexedDrawCallParameter)
      )
      .combine(poptions('type', Object.keys(typeInfoMap)))
      .combine(poptions('additionalBuffers', [0, 4]))
      .combine(poptions('errorScale', [1, 4, 10 ** 2, 10 ** 4, 10 ** 6]))
  )
  .fn(async t => {
    const p = t.params;
    const typeInfo = typeInfoMap[p.type];

    // Number of vertices to draw
    const numVertices = 3;
    // Each buffer will be bound to this many slots (2 would mean 2 attributes per buffer)
    const slotsPerBuffer = 2;
    // Make an array big enough for the vertices, slots, and size of each element
    let vertexArray = new Float32Array(numVertices * slotsPerBuffer * typeInfo.size);

    // Sufficiently unusual values to fill our buffer with to avoid collisions with other tests
    const arbitraryValues = [759, 329, 908];
    for (let i = 0; i < vertexArray.length; ++i) {
      vertexArray[i] = arbitraryValues[i % arbitraryValues.length];
    }
    // A valid value is 0 or one in the buffer
    const validValues = [0, ...arbitraryValues];

    // Instance step mode buffer, vertex step mode buffer
    let bufferContents = [vertexArray, vertexArray];
    // Additional buffers (vertex step mode)
    for (let i = 0; i < p.additionalBuffers; i++) {
      bufferContents.push(vertexArray);
    }

    // Mutable draw call
    let draw = new DrawCall(t.device, bufferContents, numVertices, slotsPerBuffer);

    // Create attributes listing
    let layoutStr = '';
    let attributeNames = [];
    {
      let currSlot = 0;
      for (let i = 0; i < bufferContents.length; i++) {
        for (let j = 0; j < slotsPerBuffer; j++) {
          layoutStr += `layout(location=${currSlot}) in ${p.type} a_${currSlot};\n`;
          attributeNames.push(`a_${currSlot}`);
          currSlot++;
        }
      }
    }

    // Vertex buffer descriptors
    let vertexBuffers: GPUVertexBufferLayoutDescriptor[] = [];
    {
      let currSlot = 0;
      for (let i = 0; i < bufferContents.length; i++) {
        vertexBuffers.push({
          arrayStride: slotsPerBuffer * typeInfo.size,
          stepMode: i == 0 ? 'instance' : 'vertex',
          attributes: Array(slotsPerBuffer)
            .fill(0)
            .map((_, i) => ({
              shaderLocation: currSlot++,
              offset: i * typeInfo.size,
              format: typeInfo.format,
            })),
        });
      }
    }

    // Offset the range checks for gl_VertexIndex in the shader if we use BaseVertex
    let vertexIndexOffset = 0;
    if (p.drawCallTestParameter == DrawCallParameter.BaseVertex) {
      vertexIndexOffset += p.errorScale;
    }

    // Construct pipeline that outputs a green fragment, only if we notice any invalid values
    const vertexModule = t.makeShaderModule('vertex', {
      glsl: `
      #version 450
      ${layoutStr}

      bool valid(float f) {
        return ${validValues.map(v => `f == ${v}`).join(' || ')};
      }

      bool validationFunc(${p.type} v) {
        ${typeInfo.validationFunc}
      }

      void main() {
        bool attributesInBounds = ${attributeNames.map(a => `validationFunc(${a})`).join(' && ')};
        bool indexInBounds = gl_VertexIndex == 0 || (gl_VertexIndex >= ${vertexIndexOffset} &&
          gl_VertexIndex < ${vertexIndexOffset + numVertices});

        if (attributesInBounds && (${!p.indexed} || indexInBounds)) {
          // Success case, move the vertex out of the screen
          gl_Position = vec4(-1.0, 0.0, 0.0, 1.0);
        }
        else {
          // Failure case, move the vertex inside the screen
          gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
        }
      }
    `,
    });

    const fragmentModule = t.makeShaderModule('fragment', {
      glsl: `
      #version 450
      precision mediump float;

      layout(location = 0) out vec4 fragColor;

      void main() {
        fragColor = vec4(0.0, 1.0, 0.0, 1.0);
      }
    `,
    });

    // Pipeline setup, texture setup
    const colorAttachment = t.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 1, height: 1, depth: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.OUTPUT_ATTACHMENT,
    });
    const colorAttachmentView = colorAttachment.createView();

    const pl = t.device.createPipelineLayout({ bindGroupLayouts: [] });
    const pipeline = t.device.createRenderPipeline({
      vertexStage: { module: vertexModule, entryPoint: 'main' },
      fragmentStage: { module: fragmentModule, entryPoint: 'main' },
      layout: pl,
      primitiveTopology: 'point-list',
      rasterizationState: {
        frontFace: 'ccw',
      },
      colorStates: [{ format: 'rgba8unorm', alphaBlend: {}, colorBlend: {} }],
      vertexState: {
        indexFormat: 'uint16',
        vertexBuffers: vertexBuffers,
      },
    });

    // Offset the draw call parameter we are testing by |errorScale|
    switch (p.drawCallTestParameter) {
      case DrawCallParameter.VertexCount: {
        draw.vertexCount += p.errorScale;
        break;
      }
      case DrawCallParameter.FirstVertex: {
        draw.firstVertex += p.errorScale;
        break;
      }
      case DrawCallParameter.InstanceCount: {
        draw.instanceCount += p.errorScale;
        break;
      }
      case DrawCallParameter.FirstInstance: {
        draw.firstInstance += p.errorScale;
        break;
      }
      case DrawCallParameter.IndexCount: {
        draw.indexCount += p.errorScale;
        break;
      }
      case DrawCallParameter.FirstIndex: {
        draw.firstIndex += p.errorScale;
        break;
      }
      case DrawCallParameter.BaseVertex: {
        draw.baseVertex += p.errorScale;
        break;
      }
    }

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          attachment: colorAttachmentView,
          storeOp: 'store',
          loadValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    pass.setPipeline(pipeline);

    // Draw function lookup |drawFunc[indexed][indirect]|
    const drawFunc: { [k: string]: Function } = {
      'false,false': draw.Draw,
      'false,true': draw.DrawIndirect,
      'true,false': draw.DrawIndexed,
      'true,true': draw.DrawIndexedIndirect,
    };

    // Run the draw variant
    drawFunc[`${p.indexed},${p.indirect}`].call(draw, pass);

    pass.endPass();

    // Validate we see red instead of green, meaning no fragment ended up on-screen
    const dst = t.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    encoder.copyTextureToBuffer(
      { texture: colorAttachment, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
      { buffer: dst, bytesPerRow: 256 },
      { width: 1, height: 1, depth: 1 }
    );
    t.device.defaultQueue.submit([encoder.finish()]);

    t.expectContents(dst, new Uint8Array([0xff, 0x00, 0x00, 0xff]));
  });
