export const description = `
Test vertex attributes behave correctly (no crash / data leak) when accessed out of bounds

Test coverage:

The following will be parameterized (all combinations tested):

1) Draw call type? (drawIndexed, drawIndirect, drawIndexedIndirect)
  - Run the draw call using an index buffer and/or an indirect buffer.
  - Direct draw will not test, as vertex buffer OOB are CPU validated and treated as validation errors.
  - Also the instance step mode vertex buffer OOB are CPU validated for drawIndexed, so we only test
    robustness access for vertex step mode vertex buffers.

2) Draw call parameter (vertexCount, firstVertex, indexCount, firstIndex, baseVertex, instanceCount,
  firstInstance, vertexCountInIndexBuffer)
  - The parameter which will go out of bounds. Filtered depending on the draw call type.
  - vertexCount, firstVertex: used for drawIndirect only, test for vertex step mode buffer OOB
  - instanceCount, firstInstance: used for both drawIndirect and drawIndexedIndirect, test for
    instance step mode buffer OOB
  - baseVertex, vertexCountInIndexBuffer: used for both drawIndexed and drawIndexedIndirect, test
    for vertex step mode buffer OOB. vertexCountInIndexBuffer indicates how many vertices are used
    within the index buffer, i.e. [0, 1, ..., vertexCountInIndexBuffer-1].
  - indexCount, firstIndex: used for drawIndexedIndirect only, validate the vertex buffer access
    when the vertex itself is OOB in index buffer. This won't happen in drawIndexed as we have index
    buffer OOB CPU validation for it.

3) Attribute type (float32, float32x2, float32x3, float32x4)
  - The input attribute type in the vertex shader

4) Error scale (0, 1, 4, 10^2, 10^4, 10^6)
  - Offset to add to the correct draw call parameter
  - 0 For control case

5) Additional vertex buffers (0, +4)
  - Tests that no OOB occurs if more vertex buffers are used

6) Partial last number and offset vertex buffer (false, true)
  - Tricky cases that make vertex buffer OOB.
  - Partial last number will make vertex buffer 1 byte less than enough, making the last vertex OOB
    with 1 byte.
  - Offset vertex buffer will bind the vertex buffer to render pass with 4 bytes offset, causing OOB
  - For drawIndexed, these two flag will be surpressed for instance step mode vertex buffer to make
    sure it pass the CPU validation.

The tests will have one instance step mode vertex buffer bound for instanced attributes, to make
sure instanceCount / firstInstance are tested.

The tests will include multiple attributes per vertex buffer.

The vertex buffers will be filled by repeating a few values randomly chosen for each test until the
end of the buffer.

The test will run a render pipeline which verifies the following:
1) All vertex attribute values occur in the buffer or are 0 (for control case it can't be 0)
2) All gl_VertexIndex values are within the index buffer or 0

TODO:

A suppression may be needed for d3d12 on tests that have non-zero baseVertex, since d3d12 counts
from 0 instead of from baseVertex (will fail check for gl_VertexIndex).
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { assert } from '../../../common/util/util.js';
import { GPUTest } from '../../gpu_test.js';

// Encapsulates a draw call (either indexed or non-indexed)
class DrawCall {
  private device: GPUDevice;
  private vertexBuffers: GPUBuffer[];

  // Add a float offset when binding vertex buffer
  private offsetVertexBuffer: boolean;

  // Keep instance step mode vertex buffer in range, in order to test vertex step
  // mode buffer OOB in drawIndexed. Setting true will surpress partialLastNumber
  // and offsetVertexBuffer for instance step mode vertex buffer.
  private keepInstanceStepModeBufferInRange: boolean;

  // Draw
  public vertexCount: number;
  public firstVertex: number;

  // DrawIndexed
  public vertexCountInIndexBuffer: number; // For generating index buffer in drawIndexed and drawIndexedIndirect
  public indexCount: number; // For accessing index buffer in drawIndexed and drawIndexedIndirect
  public firstIndex: number;
  public baseVertex: number;

  // Both Draw and DrawIndexed
  public instanceCount: number;
  public firstInstance: number;

  constructor(
    device: GPUDevice,
    vertexArrays: Float32Array[],
    vertexCount: number,
    partialLastNumber: boolean,
    offsetVertexBuffer: boolean,
    keepInstanceStepModeBufferInRange: boolean
  ) {
    this.device = device;

    // Default arguments (valid call)
    this.vertexCount = vertexCount;
    this.firstVertex = 0;
    this.vertexCountInIndexBuffer = vertexCount;
    this.indexCount = vertexCount;
    this.firstIndex = 0;
    this.baseVertex = 0;
    this.instanceCount = vertexCount;
    this.firstInstance = 0;

    this.offsetVertexBuffer = offsetVertexBuffer;
    this.keepInstanceStepModeBufferInRange = keepInstanceStepModeBufferInRange;

    // Since vertexInIndexBuffer is mutable, index buffer generating should be deferred to right before calling draw

    // Generate vertex buffer
    if (keepInstanceStepModeBufferInRange) {
      // Surpress partialLastNumber for the first vertex buffer, aka the instance step mode buffer
      this.vertexBuffers = [
        this.generateVertexBuffer(vertexArrays[0], false),
        ...vertexArrays
          .slice(1, vertexArrays.length)
          .map(v => this.generateVertexBuffer(v, partialLastNumber)),
      ];
    } else {
      this.vertexBuffers = vertexArrays.map(v => this.generateVertexBuffer(v, partialLastNumber));
    }
  }

  // Insert a draw call into |pass| with specified type
  public insertInto(pass: GPURenderPassEncoder, indexed: boolean, indirect: boolean) {
    if (indexed) {
      if (indirect) {
        this.drawIndexedIndirect(pass);
      } else {
        this.drawIndexed(pass);
      }
    } else {
      if (indirect) {
        this.drawIndirect(pass);
      } else {
        this.draw(pass);
      }
    }
  }

  // Insert a draw call into |pass|
  public draw(pass: GPURenderPassEncoder) {
    this.bindVertexBuffers(pass);
    pass.draw(this.vertexCount, this.instanceCount, this.firstVertex, this.firstInstance);
  }

  // Insert an indexed draw call into |pass|
  public drawIndexed(pass: GPURenderPassEncoder) {
    // Generate index buffer
    const indexArray = new Uint32Array(this.vertexCountInIndexBuffer).fill(0).map((_, i) => i);
    const indexBuffer = this.generateIndexBuffer(indexArray);
    this.bindVertexBuffers(pass);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexed(
      this.indexCount,
      this.instanceCount,
      this.firstIndex,
      this.baseVertex,
      this.firstInstance
    );
  }

  // Insert an indirect draw call into |pass|
  public drawIndirect(pass: GPURenderPassEncoder) {
    this.bindVertexBuffers(pass);
    pass.drawIndirect(this.generateIndirectBuffer(), 0);
  }

  // Insert an indexed indirect draw call into |pass|
  public drawIndexedIndirect(pass: GPURenderPassEncoder) {
    // Generate index buffer
    const indexArray = new Uint32Array(this.vertexCountInIndexBuffer).fill(0).map((_, i) => i);
    const indexBuffer = this.generateIndexBuffer(indexArray);
    this.bindVertexBuffers(pass);
    pass.setIndexBuffer(indexBuffer, 'uint32');
    pass.drawIndexedIndirect(this.generateIndexedIndirectBuffer(), 0);
  }

  // Bind all vertex buffers generated
  private bindVertexBuffers(pass: GPURenderPassEncoder) {
    let currSlot = 0;
    // Deal with the instance step mode buffer
    pass.setVertexBuffer(
      currSlot++,
      this.vertexBuffers[0],
      !this.keepInstanceStepModeBufferInRange && this.offsetVertexBuffer ? 4 : 0
    );
    // Deal with the rest vertex step mode buffer
    for (let i = 1; i < this.vertexBuffers.length; i++) {
      pass.setVertexBuffer(currSlot++, this.vertexBuffers[i], this.offsetVertexBuffer ? 4 : 0);
    }
  }

  // Create a vertex buffer from |vertexArray|
  // If |partialLastNumber| is true, delete one byte off the end
  private generateVertexBuffer(vertexArray: Float32Array, partialLastNumber: boolean): GPUBuffer {
    let size = vertexArray.byteLength;
    let length = vertexArray.length;
    if (partialLastNumber) {
      size -= 1; // Shave off one byte from the buffer size.
      length -= 1; // And one whole element from the writeBuffer.
    }
    const vertexBuffer = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexArray, 0, length);
    return vertexBuffer;
  }

  // Create an index buffer from |indexArray|
  private generateIndexBuffer(indexArray: Uint32Array): GPUBuffer {
    const byteLength = indexArray.byteLength;
    assert(byteLength % 4 === 0); // Since indexArray is Uint32Array, (byteLength % 4) must be 0
    const indexBuffer = this.device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(indexBuffer, 0, indexArray);
    return indexBuffer;
  }

  // Create an indirect buffer containing draw call values
  private generateIndirectBuffer(): GPUBuffer {
    const indirectArray = new Int32Array([
      this.vertexCount,
      this.instanceCount,
      this.firstVertex,
      this.firstInstance,
    ]);
    const indirectBuffer = this.device.createBuffer({
      mappedAtCreation: true,
      size: indirectArray.byteLength,
      usage: GPUBufferUsage.INDIRECT,
    });
    new Int32Array(indirectBuffer.getMappedRange()).set(indirectArray);
    indirectBuffer.unmap();
    return indirectBuffer;
  }

  // Create an indirect buffer containing indexed draw call values
  private generateIndexedIndirectBuffer(): GPUBuffer {
    const indirectArray = new Int32Array([
      this.indexCount,
      this.instanceCount,
      this.firstVertex,
      this.baseVertex,
      this.firstInstance,
    ]);
    const indirectBuffer = this.device.createBuffer({
      mappedAtCreation: true,
      size: indirectArray.byteLength,
      usage: GPUBufferUsage.INDIRECT,
    });
    new Int32Array(indirectBuffer.getMappedRange()).set(indirectArray);
    indirectBuffer.unmap();
    return indirectBuffer;
  }
}

// Parameterize different sized types
interface VertexInfo {
  wgslType: string;
  sizeInBytes: number;
  validationFunc: string;
}

const typeInfoMap: { [k: string]: VertexInfo } = {
  float32: {
    wgslType: 'f32',
    sizeInBytes: 4,
    validationFunc: 'return valid(v);',
  },
  float32x2: {
    wgslType: 'vec2<f32>',
    sizeInBytes: 8,
    validationFunc: 'return valid(v.x) && valid(v.y);',
  },
  float32x3: {
    wgslType: 'vec3<f32>',
    sizeInBytes: 12,
    validationFunc: 'return valid(v.x) && valid(v.y) && valid(v.z);',
  },
  float32x4: {
    wgslType: 'vec4<f32>',
    sizeInBytes: 16,
    validationFunc: `return valid(v.x) && valid(v.y) && valid(v.z) && valid(v.w) ||
                            v.x == 0.0 && v.y == 0.0 && v.z == 0.0 && (v.w == 0.0 || v.w == 1.0);`,
  },
};

class F extends GPUTest {
  generateBufferContents(
    numVertices: number,
    attributesPerBuffer: number,
    typeInfo: VertexInfo,
    arbitraryValues: number[],
    bufferCount: number
  ): Float32Array[] {
    // Make an array big enough for the vertices, attributes, and size of each element
    const vertexArray = new Float32Array(
      numVertices * attributesPerBuffer * (typeInfo.sizeInBytes / 4)
    );

    for (let i = 0; i < vertexArray.length; ++i) {
      vertexArray[i] = arbitraryValues[i % arbitraryValues.length];
    }

    // Only the first buffer is instance step mode, all others are vertex step mode buffer
    assert(bufferCount >= 2);
    const bufferContents: Float32Array[] = [];
    for (let i = 0; i < bufferCount; i++) {
      bufferContents.push(vertexArray);
    }

    return bufferContents;
  }

  generateVertexBufferDescriptors(bufferCount: number, attributesPerBuffer: number, type: string) {
    const typeInfo = typeInfoMap[type];
    // Vertex buffer descriptors
    const buffers: GPUVertexBufferLayout[] = [];
    {
      let currAttribute = 0;
      for (let i = 0; i < bufferCount; i++) {
        buffers.push({
          arrayStride: attributesPerBuffer * typeInfo.sizeInBytes,
          stepMode: i === 0 ? 'instance' : 'vertex',
          attributes: Array(attributesPerBuffer)
            .fill(0)
            .map((_, i) => ({
              shaderLocation: currAttribute++,
              offset: i * typeInfo.sizeInBytes,
              format: type as GPUVertexFormat,
            })),
        });
      }
    }
    return buffers;
  }

  generateVertexShaderCode(
    bufferCount: number,
    attributesPerBuffer: number,
    validValues: number[],
    typeInfo: VertexInfo,
    vertexIndexOffset: number,
    numVertices: number,
    isIndexed: boolean
  ): string {
    // Create layout and attributes listing
    let layoutStr = 'struct Attributes {';
    const attributeNames = [];
    {
      let currAttribute = 0;
      for (let i = 0; i < bufferCount; i++) {
        for (let j = 0; j < attributesPerBuffer; j++) {
          layoutStr += `[[location(${currAttribute})]] a_${currAttribute} : ${typeInfo.wgslType};\n`;
          attributeNames.push(`a_${currAttribute}`);
          currAttribute++;
        }
      }
    }
    layoutStr += '};';

    const vertexShaderCode: string = `
      ${layoutStr}

      fn valid(f : f32) -> bool {
        return ${validValues.map(v => `f == ${v}.0`).join(' || ')};
      }

      fn validationFunc(v : ${typeInfo.wgslType}) -> bool {
        ${typeInfo.validationFunc}
      }

      [[stage(vertex)]] fn main(
        [[builtin(vertex_index)]] VertexIndex : u32,
        attributes : Attributes
        ) -> [[builtin(position)]] vec4<f32> {
        var attributesInBounds : bool = ${attributeNames
          .map(a => `validationFunc(attributes.${a})`)
          .join(' && ')};
        var indexInBounds : bool = VertexIndex == 0u ||
            (VertexIndex >= ${vertexIndexOffset}u &&
            VertexIndex < ${vertexIndexOffset + numVertices}u);

        var Position : vec4<f32>;
        if (attributesInBounds && (${!isIndexed} || indexInBounds)) {
          // Success case, move the vertex out of the viewport
          Position = vec4<f32>(-1.0, 0.0, 0.0, 1.0);
        } else {
          // Failure case, move the vertex inside the viewport
          Position = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        }
        return Position;
      }`;
    return vertexShaderCode;
  }

  createRenderPipeline(
    bufferCount: number,
    attributesPerBuffer: number,
    validValues: number[],
    typeInfo: VertexInfo,
    vertexIndexOffset: number,
    numVertices: number,
    isIndexed: boolean,
    buffers: GPUVertexBufferLayout[]
  ): GPURenderPipeline {
    const pipeline = this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: this.generateVertexShaderCode(
            bufferCount,
            attributesPerBuffer,
            validValues,
            typeInfo,
            vertexIndexOffset,
            numVertices,
            isIndexed
          ),
        }),
        entryPoint: 'main',
        buffers,
      },
      fragment: {
        module: this.device.createShaderModule({
          code: `
            [[stage(fragment)]] fn main() -> [[location(0)]] vec4<f32> {
              return vec4<f32>(1.0, 0.0, 0.0, 1.0);
            }`,
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'point-list' },
    });
    return pipeline;
  }

  doTest(
    bufferCount: number,
    attributesPerBuffer: number,
    dataType: string,
    validValues: number[],
    vertexIndexOffset: number,
    numVertices: number,
    isIndexed: boolean,
    isIndirect: boolean,
    drawCall: DrawCall
  ): void {
    // Vertex buffer descriptors
    const buffers: GPUVertexBufferLayout[] = this.generateVertexBufferDescriptors(
      bufferCount,
      attributesPerBuffer,
      dataType
    );

    // Pipeline setup, texture setup
    const pipeline = this.createRenderPipeline(
      bufferCount,
      attributesPerBuffer,
      validValues,
      typeInfoMap[dataType],
      vertexIndexOffset,
      numVertices,
      isIndexed,
      buffers
    );

    const colorAttachment = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const colorAttachmentView = colorAttachment.createView();

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: colorAttachmentView,
          storeOp: 'store',
          loadValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
        },
      ],
    });
    pass.setPipeline(pipeline);

    // Run the draw variant
    drawCall.insertInto(pass, isIndexed, isIndirect);

    pass.endPass();
    this.device.queue.submit([encoder.finish()]);

    // Validate we see green instead of red, meaning no fragment ended up on-screen
    this.expectSinglePixelIn2DTexture(
      colorAttachment,
      'rgba8unorm',
      { x: 0, y: 0 },
      { exp: new Uint8Array([0x00, 0xff, 0x00, 0xff]), layout: { mipLevel: 0 } }
    );
  }
}

export const g = makeTestGroup(F);

g.test('vertex_buffer_access')
  .params(u =>
    u
      .combineWithParams([
        { indexed: false, indirect: true },
        { indexed: true, indirect: false },
        { indexed: true, indirect: true },
      ])
      .expand(
        'drawCallTestParameter',
        p =>
          p.indirect
            ? p.indexed
              ? ([
                  'indexCount',
                  'instanceCount',
                  'firstIndex',
                  'baseVertex',
                  'firstInstance',
                  'vertexCountInIndexBuffer',
                ] as const) // For drawIndexedIndirect
              : (['vertexCount', 'instanceCount', 'firstVertex', 'firstInstance'] as const) // For drawIndirected
            : (['baseVertex', 'vertexCountInIndexBuffer'] as const) // For drawIndexed
      )
      .combine('type', Object.keys(typeInfoMap))
      .combine('additionalBuffers', [0, 4])
      .combine('partialLastNumber', [false, true])
      .combine('offsetVertexBuffer', [false, true])
      .combine('errorScale', [0, 1, 4, 10 ** 2, 10 ** 4, 10 ** 6])
  )
  .fn(async t => {
    const p = t.params;
    const typeInfo = typeInfoMap[p.type];

    // Number of vertices to draw
    const numVertices = 4;
    // Each buffer will be bound to this many attributes (2 would mean 2 attributes per buffer)
    const attributesPerBuffer = 2;
    // Random values to fill our buffer with to avoid collisions with other tests
    const arbitraryValues = Array(5)
      .fill(0)
      .map(v => Math.ceil(Math.random() * 1024));

    // A valid value is 0 or one in the buffer
    const validValues =
      p.errorScale === 0 && !p.offsetVertexBuffer && !p.partialLastNumber
        ? arbitraryValues // Control case with no OOB access, must read back valid values in buffer
        : [0, ...arbitraryValues]; // Testing case with OOB access, can be 0 for OOB data

    // Generate vertex buffer contents. Only the first buffer is instance step mode, all others are vertex step mode
    const bufferCount = p.additionalBuffers + 2; // At least one instance step mode and one vertex step mode buffer
    const bufferContents = t.generateBufferContents(
      numVertices,
      attributesPerBuffer,
      typeInfo,
      arbitraryValues,
      bufferCount
    );

    // Mutable draw call
    const draw = new DrawCall(
      t.device,
      bufferContents,
      numVertices,
      p.partialLastNumber,
      p.offsetVertexBuffer,
      p.indexed && !p.indirect // keep instance step mode buffer in range for drawIndexed
    );

    // Offset the draw call parameter we are testing by |errorScale|
    draw[p.drawCallTestParameter] += p.errorScale;
    // Offset the range checks for gl_VertexIndex in the shader if we use BaseVertex
    let vertexIndexOffset = 0;
    if (p.drawCallTestParameter === 'baseVertex') {
      vertexIndexOffset += p.errorScale;
    }

    t.doTest(
      bufferCount,
      attributesPerBuffer,
      p.type,
      validValues,
      vertexIndexOffset,
      numVertices,
      p.indexed,
      p.indirect,
      draw
    );
  });
