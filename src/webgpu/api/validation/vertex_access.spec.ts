export const description = `
Here we test the vertex buffer validation within creating render pipeline, setting index and vertex
buffer, and calling draw function. For draw function, we only tests OOB for draw, and index buffer
and instance step mode vertex buffer OOB for drawIndexed. Vertex step mode vertex buffer OOB for
drawIndexed, vertex buffer OOB for drawIndirect and vertex and index buffer OOB for
drawIndexedIndirect are covered in robust access.

TODO: make sure this isn't already covered somewhere else, review, organize, and implement.
> - In encoder.finish():
>     - All (non/indexed, in/direct) draw commands
>         - Same GPUBuffer bound to multiple vertex buffer slots
>             - Non-overlapping, overlapping ranges
>         - A needed vertex buffer is not bound
>             - Was bound in another render pass but not the current one
>             - x= all vertex formats
>         - setPl, setVB, setIB, draw, {setPl,setVB,setIB,nothing (control)}, then
>           a larger draw that wouldn't have been valid before that
>         - Draw call needs to read {=, >} any bound vertex buffer range
>           (with GPUBuffer that is always large enough)
>             - x= all vertex formats
>             - x= weird offset values
>             - x= weird arrayStride values
>         - A bound vertex buffer range is significantly larger than necessary
>
>     - All non-indexed (in/direct) draw commands,
>         - An unused {index (with uselessly small range), vertex} buffer
>           is bound (immediately before draw call)
>         - vertex access out of bounds (make sure this doesn't overlap with robust access)
>             - bound vertex buffer **ranges** are {exact size, just under exact size} needed for draws with:
>                 - vertexCount largeish
>                 - firstVertex {=, >} 0
>                 - instanceCount largeish
>                 - firstInstance {=, >} 0
>             - include VBs with both step modes
>         - x= {draw, drawIndirect}
>         - x= {render pass, render bundle}
>     - Indexed draw commands,
>         - No index buffer is bound
>         - Same GPUBuffer bound to index buffer and a vertex buffer slot
>             - Non-overlapping, overlapping ranges
>         - Draw call needs to read {=, >} the bound index buffer range
>           (with GPUBuffer that is always large enough)
>             - range is too small and GPUBuffer is large enough
>             - range and GPUBuffer are exact size
>             - x= all index formats
>         - Bound index buffer range is significantly larger than necessary
>         - vertex access out of bounds (make sure this doesn't overlap with robust access)
>         - bound vertex buffer **ranges** are {exact size, just under exact size} needed for draws with:
>                 - a vertex index in the buffer is largeish
>                 - baseVertex {=, >} 0
>                 - instanceCount largeish
>                 - firstInstance {=, >} 0
>             - include VBs with both step modes
>         - x= {render pass, render bundle}
> - In queue.submit():
>     - Every GPUBuffer referenced in any element of commandBuffers is in the "unmapped" buffer state.
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { kMaxVertexBufferArrayStride, kMaxVertexBuffers } from '../../capability_info.js';
import { GPUConst } from '../../constants.js';

import { ValidationTest } from './validation_test.js';

const typeCompatibleMap: {
  [k: string]: { compatibleWGSLType: string[]; incompatibleWGSLType: string[] };
} = {
  float: {
    compatibleWGSLType: ['f32', 'vec2<f32>', 'vec3<f32>', 'vec4<f32>'],
    incompatibleWGSLType: [
      'u32',
      'vec2<u32>',
      'vec3<u32>',
      'vec4<u32>',
      'i32',
      'vec2<i32>',
      'vec3<i32>',
      'vec4<i32>',
    ],
  },
  uint: {
    compatibleWGSLType: ['u32', 'vec2<u32>', 'vec3<u32>', 'vec4<u32>'],
    incompatibleWGSLType: [
      'i32',
      'vec2<i32>',
      'vec3<i32>',
      'vec4<i32>',
      'f32',
      'vec2<f32>',
      'vec3<f32>',
      'vec4<f32>',
    ],
  },
  sint: {
    compatibleWGSLType: ['i32', 'vec2<i32>', 'vec3<i32>', 'vec4<i32>'],
    incompatibleWGSLType: [
      'u32',
      'vec2<u32>',
      'vec3<u32>',
      'vec4<u32>',
      'f32',
      'vec2<f32>',
      'vec3<f32>',
      'vec4<f32>',
    ],
  },
};

const typeInfoMap: {
  [k: string]: { wgslType: string; sizeInBytes: number; compatibleType: string };
} = {
  float32: {
    wgslType: 'f32',
    sizeInBytes: 4,
    compatibleType: 'float',
  },
  float32x2: {
    wgslType: 'vec2<f32>',
    sizeInBytes: 8,
    compatibleType: 'float',
  },
  float32x3: {
    wgslType: 'vec3<f32>',
    sizeInBytes: 12,
    compatibleType: 'float',
  },
  float32x4: {
    wgslType: 'vec4<f32>',
    sizeInBytes: 16,
    compatibleType: 'float',
  },
  uint8x2: {
    wgslType: 'vec2<u32>',
    sizeInBytes: 2,
    compatibleType: 'uint',
  },
  uint8x4: {
    wgslType: 'vec4<u32>',
    sizeInBytes: 4,
    compatibleType: 'uint',
  },
  unorm8x2: {
    wgslType: 'vec2<f32>',
    sizeInBytes: 2,
    compatibleType: 'float',
  },
  unorm8x4: {
    wgslType: 'vec4<f32>',
    sizeInBytes: 4,
    compatibleType: 'float',
  },
};

interface VertexBufferDescriptorForWGSLShader {
  offset: GPUSize64;
  shaderLocation: GPUIndex32;
  wgslType: string;
}

class DrawCall {
  test: ValidationTest;
  drawType: 'draw' | 'drawIndexed' | 'drawIndirect' | 'drawIndexedIndirect' = 'draw';

  // Draw
  vertexCount: number = 4;
  firstVertex: number = 0;

  // DrawIndexed
  indexCount: number = 4; // For accessing index buffer in drawIndexed and drawIndexedIndirect
  firstIndex: number = 0;
  baseVertex: number = 0;

  // Both Draw and DrawIndexed
  instanceCount: number = 1;
  firstInstance: number = 0;

  constructor(test: ValidationTest) {
    this.test = test;
  }

  callDraw(encoder: GPURenderEncoderBase) {
    switch (this.drawType) {
      case 'draw': {
        encoder.draw(this.vertexCount, this.instanceCount, this.firstVertex, this.firstInstance);
        break;
      }
      case 'drawIndexed': {
        encoder.drawIndexed(
          this.indexCount,
          this.instanceCount,
          this.firstIndex,
          this.baseVertex,
          this.firstInstance
        );
        break;
      }
      case 'drawIndirect': {
        encoder.drawIndirect(this.generateIndirectBuffer(), 0);
        break;
      }
      case 'drawIndexedIndirect': {
        encoder.drawIndexedIndirect(this.generateIndexedIndirectBuffer(), 0);
        break;
      }
    }
  }

  private generateIndirectBuffer(): GPUBuffer {
    const indirectArray = new Int32Array([
      this.vertexCount,
      this.instanceCount,
      this.firstVertex,
      this.firstInstance,
    ]);
    return this.test.makeBufferWithContents(indirectArray, GPUBufferUsage.INDIRECT);
  }

  // Create an indirect buffer containing indexed draw call values
  private generateIndexedIndirectBuffer(): GPUBuffer {
    const indirectArray = new Int32Array([
      this.indexCount,
      this.instanceCount,
      this.firstIndex,
      this.baseVertex,
      this.firstInstance,
    ]);
    return this.test.makeBufferWithContents(indirectArray, GPUBufferUsage.INDIRECT);
  }
}

class BufferMapping {
  buffer: GPUBuffer;
  offset?: number;
  size?: number;

  constructor(buffer: GPUBuffer, offset?: number, size?: number) {
    this.buffer = buffer;
    this.offset = offset;
    this.size = size;
  }
}

class VertexBufferMapping extends BufferMapping {
  slot: number;

  constructor(slot: number, buffer: GPUBuffer, offset?: number, size?: number) {
    super(buffer, offset, size);
    this.slot = slot;
  }
}

class IndexBufferMapping extends BufferMapping {
  indexFormat: GPUIndexFormat;

  constructor(buffer: GPUBuffer, indexFormat: GPUIndexFormat, offset?: number, size?: number) {
    super(buffer, offset, size);
    this.indexFormat = indexFormat;
  }
}

class F extends ValidationTest {
  // Compute the parameters for setting index/vertex buffer binding following the spec
  computeBufferOffsetAndBoundSize(
    bufferSize: number,
    bufferOffset?: number,
    bufferBoundSize?: number
  ): [number, number] {
    const vertexComputedOffset = bufferOffset === undefined ? 0 : bufferOffset;
    const vertexComputedBoundSize =
      bufferBoundSize === undefined ? bufferSize - vertexComputedOffset : bufferBoundSize;
    return [vertexComputedOffset, vertexComputedBoundSize];
  }

  createBundle(): GPURenderBundleEncoder {
    const bundleDesc: GPURenderBundleEncoderDescriptor = { colorFormats: ['rgba8unorm'] };
    return this.device.createRenderBundleEncoder(bundleDesc);
  }

  // Create a vertex shader module with given attributes wgsl type
  generateVertexShaderModuleFromBufferDescriptor(
    vertexBufferDescriptor: VertexBufferDescriptorForWGSLShader[]
  ): GPUShaderModule {
    const shaderInput = vertexBufferDescriptor
      .map((attr, index) => `[[location(${attr.shaderLocation})]] var_${index} : ${attr.wgslType}`)
      .join(', ');

    const code = `[[stage(vertex)]]
    fn main(${shaderInput}) -> [[builtin(position)]] vec4<f32> {
        return vec4<f32>(0.0, 1.0, 0.0, 1.0);
    }`;

    return this.device.createShaderModule({ code });
  }

  // Create a vertex shader module from vertex buffer layout array, typically from the pipeline
  // descriptor, and use the perfect match wgsl type, e.g. vec4<f32> for float32x4 for all attributes
  generateVertexShaderModuleFromBufferLayout(
    vertexBufferLayouts: GPUVertexBufferLayout[]
  ): GPUShaderModule {
    return this.generateVertexShaderModuleFromBufferDescriptor(
      vertexBufferLayouts
        .reduce((a, c) => [...a, ...c.attributes], [] as GPUVertexAttribute[])
        .map(attr => {
          return {
            offset: attr.offset,
            shaderLocation: attr.shaderLocation,
            wgslType: typeInfoMap[attr.format].wgslType,
          } as VertexBufferDescriptorForWGSLShader;
        })
    );
  }

  createRenderPipelineFromBufferLayout(
    vertexBufferLayoutsForPipelineDescriptor: GPUVertexBufferLayout[],
    vertexBufferDescriptorForShaderModule?: VertexBufferDescriptorForWGSLShader[]
  ): GPURenderPipeline {
    return this.device.createRenderPipeline({
      vertex: {
        module: vertexBufferDescriptorForShaderModule
          ? this.generateVertexShaderModuleFromBufferDescriptor(
              vertexBufferDescriptorForShaderModule
            )
          : this.generateVertexShaderModuleFromBufferLayout(
              vertexBufferLayoutsForPipelineDescriptor
            ),
        entryPoint: 'main',
        buffers: vertexBufferLayoutsForPipelineDescriptor,
      },
      fragment: {
        module: this.device.createShaderModule({
          code: `
          [[stage(fragment)]] fn main() -> [[location(0)]] vec4<f32> {
            return vec4<f32>(1.0, 0.0, 0.0, 1.0);
          }`,
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm', writeMask: 0 }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  createCommandEncoder(): [GPUCommandEncoder, GPURenderPassEncoder] {
    // Create command encoder
    const colorAttachment = this.device.createTexture({
      format: 'rgba8unorm',
      size: { width: 2, height: 1, depthOrArrayLayers: 1 },
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
    return [encoder, pass];
  }

  // Generate a basic vertex buffer layout array containing given number of instance step mode and
  // vertex step mode vertex buffer, each of them contain a given number of attributes, whose
  // offsets form a arithmetic sequence. Within a buffer, the formats of attributes are chosen from
  // formatList repeatedly.
  getBasicVertexBufferLayouts({
    arrayStride = 32,
    attributePerBuffer = 2,
    offsetStep = 16,
    formatList = ['float32x4'],
    instanceStepModeBufferCount = 1,
    vertexStepModeBufferCount = 1,
  }: {
    arrayStride?: number;
    attributePerBuffer?: number;
    offsetStep?: number;
    formatList?: GPUVertexFormat[];
    instanceStepModeBufferCount?: number;
    vertexStepModeBufferCount?: number;
  }): GPUVertexBufferLayout[] {
    const basicVertexBufferLayouts: GPUVertexBufferLayout[] = [];
    let shaderLocation = 0;
    for (
      let buffer = 0;
      buffer < instanceStepModeBufferCount + vertexStepModeBufferCount;
      buffer++
    ) {
      const attributes: GPUVertexAttribute[] = [];
      let offset = 0;
      for (let attribute = 0; attribute < attributePerBuffer; attribute++) {
        attributes.push({
          format: formatList[attribute % formatList.length],
          offset,
          shaderLocation,
        });
        offset += offsetStep;
        shaderLocation += 1;
      }
      basicVertexBufferLayouts.push({
        arrayStride,
        stepMode: buffer < instanceStepModeBufferCount ? 'instance' : 'vertex',
        attributes,
      });
    }
    return basicVertexBufferLayouts;
  }

  setIndexBuffers(renderEncoder: GPURenderEncoderBase, mappings: IndexBufferMapping[]) {
    mappings.forEach(mapping =>
      renderEncoder.setIndexBuffer(
        mapping.buffer,
        mapping.indexFormat,
        mapping.offset,
        mapping.size
      )
    );
  }

  setVertexBuffers(renderEncoder: GPURenderEncoderBase, mappings: VertexBufferMapping[]) {
    mappings.forEach(mapping =>
      renderEncoder.setVertexBuffer(mapping.slot, mapping.buffer, mapping.offset, mapping.size)
    );
  }

  // Testing method that create render pipeline from a given buffer layout array, set index and
  // vertex buffer before/after setting pipeline, call one given draw function if any, and check if
  // there is any validation error.
  testBuffer(
    vertexBufferLayouts: GPUVertexBufferLayout[],
    indexBufferMappings: IndexBufferMapping[],
    vertexBufferMappings: VertexBufferMapping[],
    drawCall: DrawCall | null,
    isSuccess: boolean,
    setPipelineBeforeBuffer: boolean,
    useBundle: boolean
  ) {
    const renderPipeline = this.createRenderPipelineFromBufferLayout(vertexBufferLayouts);

    const [encoder, pass] = this.createCommandEncoder();
    const bundleEncoder: GPURenderBundleEncoder = this.createBundle();

    if (setPipelineBeforeBuffer) {
      if (useBundle) {
        bundleEncoder.setPipeline(renderPipeline);
      } else {
        pass.setPipeline(renderPipeline);
      }
    }

    this.setIndexBuffers(useBundle ? bundleEncoder : pass, indexBufferMappings);
    this.setVertexBuffers(useBundle ? bundleEncoder : pass, vertexBufferMappings);

    if (!setPipelineBeforeBuffer) {
      if (useBundle) {
        bundleEncoder.setPipeline(renderPipeline);
      } else {
        pass.setPipeline(renderPipeline);
      }
    }

    if (drawCall !== null) {
      drawCall.callDraw(useBundle ? bundleEncoder : pass);
    }

    if (useBundle) {
      if (isSuccess) {
        const bundle: GPURenderBundle = bundleEncoder.finish();
        pass.executeBundles([bundle]);
        pass.endPass();
        encoder.finish();
      } else {
        this.expectValidationError(() => {
          bundleEncoder.finish();
        });
      }
    } else {
      pass.endPass();
      if (isSuccess) {
        encoder.finish();
      } else {
        this.expectValidationError(() => {
          encoder.finish();
        });
      }
    }
  }
}

export const g = makeTestGroup(F);

g.test('basic').fn(async t => {
  const vertexBufferLayouts: GPUVertexBufferLayout[] = [
    {
      arrayStride: 20,
      stepMode: 'vertex',
      attributes: [
        { format: 'float32x4', offset: 0, shaderLocation: 0 },
        { format: 'uint8x2', offset: 16, shaderLocation: 1 },
      ],
    },
    {
      arrayStride: 8,
      stepMode: 'vertex',
      attributes: [{ format: 'unorm8x2', offset: 0, shaderLocation: 3 }],
    },
  ];
  const pipeline = t.createRenderPipelineFromBufferLayout(vertexBufferLayouts);

  // Create buffers
  const buffers = [
    t.device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX,
      mappedAtCreation: false,
    }),
    t.device.createBuffer({ size: 2 * 4, usage: GPUBufferUsage.VERTEX, mappedAtCreation: false }),
  ];

  // Create command encoder
  const [encoder, pass] = t.createCommandEncoder();

  // Set vertex buffers
  t.setVertexBuffers(pass, [
    new VertexBufferMapping(0, buffers[0], 0, 24 * 4),
    new VertexBufferMapping(1, buffers[0], 0),
  ]);

  // Set pipeline
  pass.setPipeline(pipeline);

  // Insert draw call
  pass.draw(4, 1, 0, 0);

  t.setIndexBuffers(pass, [new IndexBufferMapping(buffers[0], 'uint16')]);

  pass.drawIndexed(4, 1, 0, 0, 0);

  // Finish encoder
  pass.endPass();
  const commandBuffer = encoder.finish();

  // Submit command buffer
  t.queue.submit([commandBuffer]);
});

// Buffer usage list for testing index and vertex buffer
const bufferUsageListForTest: number[] = [
  GPUConst.BufferUsage.MAP_WRITE,
  GPUConst.BufferUsage.INDEX,
  GPUConst.BufferUsage.VERTEX,
  GPUConst.BufferUsage.INDEX | GPUConst.BufferUsage.VERTEX,
];

g.test('set_buffer_usage_validation_and_overlap')
  .desc(
    `
In this test, we test the usage validation within setIndexBuffer and setVertexBuffer, and test the
buffer overlapping, i.e. one GPUBuffer is bound to multiple vertex buffer slot or both index buffer
and vertex buffer slot, with different offset setting (range completely overlap, partially overlap
and no renge overlap). No draw called in this test.
    - Test overlapping {vertex/vertex,vertex/index} buffers are valid without draw.
    - Test all range overlapping situation for buffers
    - Validate that calling set*Buffer before/after setPipeline is the same

Related set*Buffer validation rules:
    - Index buffer
        - buffer.[[usage]] contains INDEX.
    - Vertex buffer
        - buffer.[[usage]] contains VERTEX.
`
  )
  .params(u =>
    u
      .combine('indexFormat', ['uint16', 'uint32'] as GPUIndexFormat[])
      // Combine offset situations for all 3 buffers to test different range overlapping.
      // 1 step euqal to 16 bytes and we bound each buffer with a size of 32 bytes.
      .combine('indexBufferOffsetStep', [0])
      .combine('instanceBufferOffsetStep', [0, 1, 2])
      .expand('vertexBufferOffsetStep', p => {
        return Array(p.instanceBufferOffsetStep + 2)
          .fill(0)
          .map((_, index) => index);
      })
      .beginSubcases()
      // Test all overlap cases for three buffers, i.e. 000, 001, 010, 011, 012
      .combine('indexBufferId', [0])
      .combine('instanceBufferId', [0, 1])
      .expand('vertexBufferId', p => {
        if (p.instanceBufferId === 0) {
          return [0, 1];
        } else {
          return [0, 1, 2];
        }
      })
      // Test all usage case for all 3 buffers
      .combine('buffer1Usage', bufferUsageListForTest)
      .combine('buffer2Usage', bufferUsageListForTest)
      .expand('buffer3Usage', p => {
        if (p.vertexBufferId === 2) {
          return bufferUsageListForTest;
        } else {
          // Buffer 3 unused
          return [GPUConst.BufferUsage.MAP_WRITE];
        }
      })
      .combine('setPipelineBeforeBuffer', [false, true])
      .combine('useBundle', [false, true])
  )
  .fn(t => {
    const p = t.params;

    const usages = [p.buffer1Usage, p.buffer2Usage, p.buffer3Usage];
    const buffers: GPUBuffer[] = usages.map(usage =>
      t.createBufferWithState('valid', {
        size: 128,
        usage,
        mappedAtCreation: false,
      })
    );

    const indexBuffer = buffers[p.indexBufferId];
    const instanceBuffer = buffers[p.instanceBufferId];
    const vertexBuffer = buffers[p.vertexBufferId];

    const indexBufferMappings: IndexBufferMapping[] = [
      {
        indexFormat: p.indexFormat,
        buffer: indexBuffer,
        offset: p.indexBufferOffsetStep * 16,
        size: 32,
      },
    ];
    const vertexBufferMappings: VertexBufferMapping[] = [
      { slot: 0, buffer: instanceBuffer, offset: p.instanceBufferOffsetStep * 16, size: 32 },
      { slot: 1, buffer: vertexBuffer, offset: p.vertexBufferOffsetStep * 16, size: 32 },
    ];

    const isUsageValid =
      (usages[p.indexBufferId] & GPUBufferUsage.INDEX) === GPUBufferUsage.INDEX &&
      (usages[p.instanceBufferId] & GPUBufferUsage.VERTEX) === GPUBufferUsage.VERTEX &&
      (usages[p.vertexBufferId] & GPUBufferUsage.VERTEX) === GPUBufferUsage.VERTEX;
    const isSuccess: boolean = isUsageValid;

    // Test setIndexBuffer and setVertexBuffer without calling draw
    t.testBuffer(
      t.getBasicVertexBufferLayouts({}),
      indexBufferMappings,
      vertexBufferMappings,
      null,
      isSuccess,
      p.setPipelineBeforeBuffer,
      p.useBundle
    );
  });

const bufferBindingParamList: { bufferSize: number; offset?: number; boundSize?: number }[] = [
  // Valid settings with/out implicit parameters
  { bufferSize: 64, offset: 0, boundSize: 64 },
  { bufferSize: 64, offset: 0, boundSize: undefined },
  { bufferSize: 64, offset: undefined, boundSize: 64 },
  { bufferSize: 64, offset: undefined, boundSize: undefined },
  { bufferSize: 64, offset: 32, boundSize: 32 },
  { bufferSize: 64, offset: 32, boundSize: undefined },
  { bufferSize: 64, offset: undefined, boundSize: 32 },
  // Bingding buffer with zero bound size
  // { bufferSize: 64, offset: 0, boundSize: 0 },
  { bufferSize: 64, offset: 64, boundSize: 0 },
  { bufferSize: 64, offset: 64, boundSize: undefined },
  // Strange buffer size
  { bufferSize: 63, offset: 0, boundSize: 63 },
  { bufferSize: 63, offset: 0, boundSize: undefined },
  // Bound range OOB
  { bufferSize: 63, offset: 0, boundSize: 64 },
  // { bufferSize: 63, offset: 64, boundSize: -1 },
  { bufferSize: 63, offset: 64, boundSize: 0 },
  { bufferSize: 63, offset: 64, boundSize: undefined },
  { bufferSize: 63, offset: 68, boundSize: undefined },
  { bufferSize: 63, offset: 2147483647, boundSize: undefined },
  { bufferSize: 63, offset: 2147483648, boundSize: undefined },
  { bufferSize: 63, offset: 4294967295, boundSize: undefined },
  { bufferSize: 63, offset: 4294967296, boundSize: undefined },
  { bufferSize: 64, offset: 4, boundSize: 2147483647 },
  { bufferSize: 64, offset: 4, boundSize: 2147483648 },
  { bufferSize: 64, offset: 4, boundSize: 4294967295 },
  { bufferSize: 64, offset: 4, boundSize: 4294967296 },
  // Offset alignment
  { bufferSize: 64, offset: 1, boundSize: 63 },
  { bufferSize: 64, offset: 2, boundSize: 62 },
  { bufferSize: 64, offset: 3, boundSize: 61 },
  { bufferSize: 64, offset: 4, boundSize: 60 },
  { bufferSize: 64, offset: 1, boundSize: undefined },
  { bufferSize: 64, offset: 2, boundSize: undefined },
  { bufferSize: 64, offset: 3, boundSize: undefined },
  { bufferSize: 64, offset: 4, boundSize: undefined },
];

g.test('set_buffer_parameter_validation')
  .desc(
    `
In this test we test the parameter validation in setIndexBuffer and setVertexBuffer, and we test
that implicit parameter used in setIndexBuffer and setVertexBuffer is computed correctly, and use
draw and drawIndexed to validate the computed value.
    - Test that bound range out-of-bounds on the GPUBuffer is catched by set*Buffer.
    - Exam that implicit offset/size are computed correctly.
    - Test that validation catch the situation that buffer offset > buffer size.
    - Test that setVertexBuffer validate the slot is less than maxVertexBuffers.
    - Test that given/computed zero index/vertex buffer bound size is valid as long as drawing
      0 index/vertex.
    - Test setting index and vertex buffer before/after setPipeline make no different.

Related set*Buffer validation rules:
    - Index buffer
        - offset is a multiple of indexFormat’s byte size.
        - offset + size ≤ buffer.[[size]].
    - Vertex buffer
        - slot < this.[[device]].[[limits]].maxVertexBuffers.
        - offset is a multiple of 4.
        - offset + size ≤ buffer.[[size]].
`
  )
  .params(u =>
    u
      .combine('testAspect', ['indexBufferParam', 'vertexBufferParam', 'vertexSlot'])
      .expand('indexBuffer', p => {
        if (p.testAspect === 'indexBufferParam') {
          return bufferBindingParamList;
        } else {
          return [{ bufferSize: 64, offset: undefined, boundSize: undefined }];
        }
      })
      .expand('vertexBuffer', p => {
        if (p.testAspect === 'vertexBufferParam') {
          return bufferBindingParamList;
        } else {
          return [{ bufferSize: 64, offset: undefined, boundSize: undefined }];
        }
      })
      .combine('indexFormat', ['uint16', 'uint32'] as GPUIndexFormat[])
      .expand('vertexSlot', p => {
        if (p.testAspect === 'vertexParam') {
          return Array(2 * kMaxVertexBuffers)
            .fill(0)
            .map((_, index) => index);
        } else {
          return [0];
        }
      })
      .beginSubcases()
      .combine('setPipelineBeforeBuffer', [false, true])
      .combine('useBundle', [false, true])
  )
  .fn(t => {
    const p = t.params;
    const indexFormatSize = p.indexFormat === 'uint16' ? 2 : 4;

    const indexBuffer = t.createBufferWithState('valid', {
      size: p.indexBuffer.bufferSize,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: false,
    });
    const vertexBuffer = t.createBufferWithState('valid', {
      size: p.vertexBuffer.bufferSize,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: false,
    });

    const indexBufferMappings: IndexBufferMapping[] = [
      {
        indexFormat: p.indexFormat,
        buffer: indexBuffer,
        offset: p.indexBuffer.offset,
        size: p.indexBuffer.boundSize,
      },
    ];
    const vertexBufferMappings: VertexBufferMapping[] = [
      {
        slot: p.vertexSlot,
        buffer: vertexBuffer,
        offset: p.vertexBuffer.offset,
        size: p.vertexBuffer.boundSize,
      },
    ];

    // Get a simple vertex buffer layout that only has one vertex step mode buffer with one f32 attribute
    const vertexBufferLayouts: GPUVertexBufferLayout[] = t.getBasicVertexBufferLayouts({
      arrayStride: 4,
      attributePerBuffer: 1,
      offsetStep: 0,
      formatList: ['float32'],
      instanceStepModeBufferCount: 0,
      vertexStepModeBufferCount: 1,
    });

    const [vertexComputedOffset, vertexComputedBoundSize] = t.computeBufferOffsetAndBoundSize(
      p.vertexBuffer.bufferSize,
      p.vertexBuffer.offset,
      p.vertexBuffer.boundSize
    );
    const [indexComputedOffset, indexComputedBoundSize] = t.computeBufferOffsetAndBoundSize(
      p.indexBuffer.bufferSize,
      p.indexBuffer.offset,
      p.indexBuffer.boundSize
    );

    const isSetVBSuccess =
      p.vertexSlot < kMaxVertexBuffers &&
      vertexComputedOffset % 4 === 0 &&
      vertexComputedBoundSize >= 0 &&
      vertexComputedOffset + vertexComputedBoundSize <= p.vertexBuffer.bufferSize;
    const isSetIBSuccess =
      indexComputedOffset % indexFormatSize === 0 &&
      indexComputedBoundSize >= 0 &&
      indexComputedOffset + indexComputedBoundSize <= p.indexBuffer.bufferSize;

    const isSetBufferSuccess = isSetIBSuccess && isSetVBSuccess;

    t.testBuffer(
      vertexBufferLayouts,
      indexBufferMappings,
      vertexBufferMappings,
      null,
      isSetBufferSuccess,
      p.setPipelineBeforeBuffer,
      p.useBundle
    );

    if (isSetBufferSuccess) {
      // Test with draw call
      const maxVertexCount = Math.floor(vertexComputedBoundSize / 4);
      const maxIndexCount = Math.floor(indexComputedBoundSize / indexFormatSize);

      const drawCall = new DrawCall(t);
      const isDrawSuccess = p.vertexSlot === 0;

      // Use draw to validate that max valid vertex count is what we computed, showing that bound
      // size is correctly set for vertex buffer.
      drawCall.drawType = 'draw';
      drawCall.vertexCount = maxVertexCount;
      t.testBuffer(
        vertexBufferLayouts,
        indexBufferMappings,
        vertexBufferMappings,
        drawCall,
        isDrawSuccess,
        p.setPipelineBeforeBuffer,
        p.useBundle
      );
      drawCall.vertexCount = maxVertexCount + 1;
      t.testBuffer(
        vertexBufferLayouts,
        indexBufferMappings,
        vertexBufferMappings,
        drawCall,
        false,
        p.setPipelineBeforeBuffer,
        p.useBundle
      );

      // Use draw to validate that max valid index count is what we computed, showing that bound
      // size is correctly set for index buffer.
      drawCall.drawType = 'drawIndexed';
      drawCall.indexCount = maxIndexCount;
      t.testBuffer(
        vertexBufferLayouts,
        indexBufferMappings,
        vertexBufferMappings,
        drawCall,
        isDrawSuccess,
        p.setPipelineBeforeBuffer,
        p.useBundle
      );
      drawCall.indexCount = maxIndexCount + 1;
      t.testBuffer(
        vertexBufferLayouts,
        indexBufferMappings,
        vertexBufferMappings,
        drawCall,
        false,
        p.setPipelineBeforeBuffer,
        p.useBundle
      );
    }
  });

g.test('create_render_pipeline_vertex_buffer_layout_must_valid')
  .desc(
    `
Test the vertex buffer layuouts validation within creating render pipeline.
    - Test aspect: arrayStrideValue, attributeOffset, attributeCount, wgslTypeCompatible,
      bufferCount, indistinctLocation
    - When testing the arrayStrideValue aspect, we test the following validation in GPUVertexBufferLayout:
      - descriptor.arrayStride ≤ device.[[device]].[[limits]].maxVertexBufferArrayStride.
      - descriptor.arrayStride is a multiple of 4.
    - When testing the attributeOffset aspect, we test the following validation in GPUVertexBufferLayout:
      - For each attribute attrib in the list descriptor.attributes:
        - If descriptor.arrayStride is zero:
          - attrib.offset + sizeof(attrib.format) ≤ device.[[device]].[[limits]].maxVertexBufferArrayStride.
        - Otherwise:
          - attrib.offset + sizeof(attrib.format) ≤ descriptor.arrayStride.
        - attrib.offset is a multiple of the minimum of 4 and sizeof(attrib.format).
    - When testing the attributeCount aspect, we test the following validation:
      - In GPUVertexBufferLayout, for each attribute attrib in the list descriptor.attributes:
        - attrib.shaderLocation is less than device.[[device]].[[limits]].maxVertexAttributes.
      - In GPUVertexState, The sum of vertexBuffer.attributes.length, over every vertexBuffer in
        descriptor.buffers, is less than or equal to device.[[device]].[[limits]].maxVertexAttributes.
    - When testing the wgslTypeCompatible aspect, we test the following validation in GPUVertexBufferLayout:
      - For each vertex attribute that serve as a input of the vertex shader entry point, the corresponding
        attrib element of descriptor.attributes with matched shader location satisfying that:
        - The format in shader must be compatible with attrbi.format
    - When testing the bufferCount aspect, we test the following validation in GPUVertexState:
      - descriptor.buffers.length is less than or equal to device.[[device]].[[limits]].maxVertexBuffers.
        - By changing the number of buffers with attributes and adding buffer with no attribute
    - When testing the indistinctLocation aspect, we test the following validation in GPUVertexState:
      - Each attrib in the union of all GPUVertexAttribute across descriptor.buffers has a distinct
        attrib.shaderLocation value.
`
  )
  .params(u =>
    u
      .combine('testAspect', [
        'arrayStrideValue',
        'wgslTypeCompatible',
        'attributeOffset',
        'attributeCount',
        'bufferCount',
        'indistinctLocation',
      ])
      .expand('arrayStride', p => {
        if (p.testAspect === 'arrayStrideValue') {
          return Array(70)
            .fill(0)
            .map((_, index) => index);
        } else {
          return [0, 64];
        }
      })
      .expand('arrayStrideGoOverMax', p => {
        if (p.testAspect === 'arrayStrideValue') {
          return [false, true];
        } else {
          return [false];
        }
      })
      .combine('attribFormat', ['uint8x2', 'float32x2', 'float32x4'] as GPUVertexFormat[])
      .expand('attributeOffsetStep', p => {
        if (p.testAspect === 'attributeOffset') {
          // By default we have 2 attributes in a buffer, their offset is 0 and attributeOffsetStep.
          // Therefore we can test the corner case for arrayStride = 64 and 0.
          return [
            1,
            2,
            3,
            4,
            16,
            32,
            64 - 16,
            64 - 15,
            64 - 8,
            64 - 7,
            64 - 4,
            64 - 3,
            64 - 2,
            64 - 1,
            64,
            kMaxVertexBufferArrayStride - 16,
            kMaxVertexBufferArrayStride - 15,
            kMaxVertexBufferArrayStride - 8,
            kMaxVertexBufferArrayStride - 7,
            kMaxVertexBufferArrayStride - 4,
            kMaxVertexBufferArrayStride - 3,
            kMaxVertexBufferArrayStride - 2,
            kMaxVertexBufferArrayStride - 1,
            kMaxVertexBufferArrayStride,
          ];
        } else {
          return [16];
        }
      })
      //.combine('attributeOffsetStep', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 32])
      .expand('attributePerBuffer', p => {
        if (p.testAspect === 'attributeCount') {
          return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        } else {
          return [2];
        }
      })
      //.combine('attributePerBuffer', [1, 2, 3, 4, 5, 6, 7, 8])
      .expand('bufferCount', p => {
        if (p.testAspect === 'bufferCount') {
          return [0, 1, 2, 4, 8, 16];
        } else {
          return [2];
        }
      })
      .beginSubcases()
      .expand('additionalEmptyBufferCount', p => {
        if (p.testAspect === 'bufferCount') {
          return [0, 4, 8, 16];
        } else {
          return [0];
        }
      })
      .expand('indistinctLocation', p => {
        if (p.testAspect === 'indistinctLocation') {
          return [true, false];
        } else {
          return [false];
        }
      })
      .expand('wgslTypeCompatible', p => {
        if (p.testAspect === 'wgslTypeCompatible') {
          return [true, false];
        } else {
          return [true];
        }
      })
      .expand('wgslType', p => {
        if (p.testAspect === 'wgslTypeCompatible') {
          if (p.wgslTypeCompatible) {
            return typeCompatibleMap[typeInfoMap[p.attribFormat].compatibleType].compatibleWGSLType;
          } else {
            return typeCompatibleMap[typeInfoMap[p.attribFormat].compatibleType]
              .incompatibleWGSLType;
          }
        } else {
          return [typeInfoMap[p.attribFormat].wgslType];
        }
      })
  )
  .fn(t => {
    const p = t.params;
    const arrayStride = p.arrayStrideGoOverMax
      ? p.arrayStride + t.device.limits.maxVertexBufferArrayStride
      : p.arrayStride;

    const isArrayStrideNoLargerThanMax: boolean = arrayStride <= kMaxVertexBufferArrayStride;
    const isArrayStrideMultipleOf4: boolean = arrayStride % 4 === 0;

    const vertexBufferDescriptorsForShader: VertexBufferDescriptorForWGSLShader[] = [];
    const vertexBufferLayoutsForPipeline: GPUVertexBufferLayout[] = [];
    let isEveryAttributeOffsetValid: boolean = true;
    let shaderLocation = 0;
    for (let buffer = 0; buffer < p.bufferCount; buffer++) {
      const attributesForPipeline: GPUVertexAttribute[] = [];
      for (let attr = 0; attr < p.attributePerBuffer; attr++) {
        const offset: number = attr * p.attributeOffsetStep;
        attributesForPipeline.push({
          format: p.attribFormat,
          offset,
          shaderLocation,
        });
        // Use the distince location within limit to ensure that creating shader module won't fail
        if (buffer * p.attributePerBuffer + attr < 16) {
          vertexBufferDescriptorsForShader.push({
            offset,
            shaderLocation: buffer * p.attributePerBuffer + attr,
            wgslType: p.wgslType,
          });
        }
        shaderLocation++;
        // Validate the offset of each attributes
        if (arrayStride === 0) {
          if (offset + typeInfoMap[p.attribFormat].sizeInBytes > kMaxVertexBufferArrayStride) {
            isEveryAttributeOffsetValid = false;
          }
        } else {
          if (offset + typeInfoMap[p.attribFormat].sizeInBytes > arrayStride) {
            isEveryAttributeOffsetValid = false;
          }
        }
        if (offset % Math.min(4, typeInfoMap[p.attribFormat].sizeInBytes) !== 0) {
          isEveryAttributeOffsetValid = false;
        }
      }
      if (p.indistinctLocation) {
        // Reset the shader location used in pipeline descriptor to cause a location appears multiple times
        shaderLocation = 0;
      }
      const layout: GPUVertexBufferLayout = {
        arrayStride,
        stepMode: 'vertex',
        attributes: attributesForPipeline,
      };
      vertexBufferLayoutsForPipeline.push(layout);
    }
    // Validate the total attribute number limit
    const isAttributesCountNoLargerThanMax: boolean =
      p.bufferCount * p.attributePerBuffer <= t.device.limits.maxVertexAttributes;
    // Add additional empty buffer to test the buffer number limit validation
    for (let emptyBuffer = 0; emptyBuffer < p.additionalEmptyBufferCount; emptyBuffer++) {
      vertexBufferLayoutsForPipeline.push({
        arrayStride,
        stepMode: 'vertex',
        attributes: [],
      });
    }
    const isBufferCountNoLargerThanMax: boolean =
      p.bufferCount + p.additionalEmptyBufferCount <= kMaxVertexBuffers;

    /*
    // Create the shader
    const vertexShader: GPUShaderModule = t.generateVertexShaderModuleFromBufferDescriptor(
      vertexBufferDescriptorsForShader
    );

    // Create the pipeline and test the validation
    const pipelineDesc: GPURenderPipelineDescriptor = {
      vertex: {
        module: vertexShader,
        entryPoint: 'main',
        buffers: vertexBufferLayoutsForPipeline,
      },
      fragment: {
        module: t.device.createShaderModule({
          code: `
          [[stage(fragment)]] fn main() -> [[location(0)]] vec4<f32> {
            return vec4<f32>(1.0, 0.0, 0.0, 1.0);
          }`,
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm', writeMask: 0 }],
      },
      primitive: { topology: 'triangle-list' },
    };
    */

    const isSuccess =
      isArrayStrideMultipleOf4 &&
      isArrayStrideNoLargerThanMax &&
      isEveryAttributeOffsetValid &&
      isAttributesCountNoLargerThanMax &&
      isBufferCountNoLargerThanMax &&
      p.wgslTypeCompatible &&
      !p.indistinctLocation;
    if (isSuccess) {
      // t.device.createRenderPipeline(pipelineDesc);
      t.createRenderPipelineFromBufferLayout(
        vertexBufferLayoutsForPipeline,
        vertexBufferDescriptorsForShader
      );
    } else {
      t.expectValidationError(() => {
        // t.device.createRenderPipeline(pipelineDesc);
        t.createRenderPipelineFromBufferLayout(
          vertexBufferLayoutsForPipeline,
          vertexBufferDescriptorsForShader
        );
      });
    }
  });

g.test('buffer_must_unmap_before_queue_submit').unimplemented();
