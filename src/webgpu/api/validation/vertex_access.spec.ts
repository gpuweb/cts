export const description = `
Here we test the vertex buffer validation within creating render pipeline, setting index and vertex
buffer, and calling draw function. For draw function, we only tests OOB for draw, and index buffer
and instance step mode vertex buffer OOB for drawIndexed. Vertex step mode vertex buffer OOB for
drawIndexed, vertex buffer OOB for drawIndirect and vertex and index buffer OOB for
drawIndexedIndirect are covered in robust access.

TODO: make sure this isn't already covered somewhere else, review, organize, and implement.
> - In encoder.finish():
>     - setVertexBuffer and setIndexBuffer commands (even if no draw):
>         - Implicit offset/size are computed correctly. E.g.:
>             { offset:         0, boundSize:         0, bufferSize: 24 },
>             { offset:         0, boundSize: undefined, bufferSize: 24 },
>             { offset: undefined, boundSize:         0, bufferSize: 24 },
>             { offset: undefined, boundSize: undefined, bufferSize: 24 },
>             { offset:         8, boundSize:        16, bufferSize: 24 },
>             { offset:         8, boundSize: undefined, bufferSize: 24 },
>         - Computed {index, vertex} buffer size is zero.
>             (Omit draw command if it's not necessary to trigger error, otherwise test both with and without draw command to make sure error happens at the right time.)
>             { offset: 24, boundSize: undefined, bufferSize: 24, _ok: false },
>         - Bound range out-of-bounds on the GPUBuffer. E.g.:
>             - x= offset in {0,8}
>             - x= boundSize in {8,16,17}
>             - x= extraSpaceInBuffer in {-1,0}
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
import { GPUConst } from '../../constants.js';

import { ValidationTest } from './validation_test.js';

// A map for buffer format informations. compatibleType indicate the general class of a format, and
// can further map to compatible and incompatible WGSL types. I.e., for "float", "f32" and "vec*<f32>"
// are compatible WGSL types, while "i32" and others are incompatible WGSL types.
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

// Class that indicate how to make input attribute for vertex shader module
interface VertexBufferDescriptorForWGSLShader {
  shaderLocation: GPUIndex32;
  wgslType: string;
}

// Class that indicate how to call a draw function
class DrawCall {
  test: ValidationTest;
  drawType: 'draw' | 'drawIndexed' = 'draw';

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
    }
  }
}

// Classes that indicate how to call setIndexBuffer and setIndexBuffer
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
            shaderLocation: attr.shaderLocation,
            wgslType: typeInfoMap[attr.format].wgslType,
          } as VertexBufferDescriptorForWGSLShader;
        })
    );
  }

  // Create a render pipeline with given vertex buffer layouts. The vertex shader module is created
  // using the exact matching WGSL type (as in typeInfoMap) for all attributes in all buffers in layouts.
  // If a different vertex shader is wanted (especially when testing WGSL type compatibility), a standalone
  // list of vertex buffer descriptor should be given.
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

  // Create command encoder and render pass encoder
  createCommandEncoder(): [GPUCommandEncoder, GPURenderPassEncoder] {
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

    const bundleDesc: GPURenderBundleEncoderDescriptor = { colorFormats: ['rgba8unorm'] };
    const bundleEncoder: GPURenderBundleEncoder = this.device.createRenderBundleEncoder(bundleDesc);

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

  // Test one given draw call with given buffer setting with/out using bundle and setting buffer
  // before/after setting pipeline. If the draw call is null, we only test setting buffer and pipeline.
  testSingleShoot(
    vertexBufferLayouts: GPUVertexBufferLayout[],
    indexBufferMappings: IndexBufferMapping[],
    vertexBufferMappings: VertexBufferMapping[],
    drawCall: DrawCall | null,
    isSuccess: boolean
  ) {
    [true, false].forEach(setPipelineBeforeBuffer => {
      [true, false].forEach(useBundle => {
        this.testBuffer(
          vertexBufferLayouts,
          indexBufferMappings,
          vertexBufferMappings,
          drawCall,
          isSuccess,
          setPipelineBeforeBuffer,
          useBundle
        );
      });
    });
  }
}

export const g = makeTestGroup(F);

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
and no renge overlap). If the setting is valid, we also call draw and drawIndexed to test that no
validation errors occurs.
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
        return Array(p.instanceBufferOffsetStep + 3)
          .fill(0)
          .map((_, index) => index);
      })
      .beginSubcases()
      // We have 3 buffers slot, i.e. a index buffer, a instance step mode vertex buffer and a vertex
      // step mode vertex buffer should be set. To test buffer overlap, we have 3 GPU buffers, and
      // each buffer slot is bound to one of them.
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
          // Buffer 3 is used as vertex setp mode buffer, test all usage
          return bufferUsageListForTest;
        } else {
          // Buffer 3 unused
          return [GPUConst.BufferUsage.MAP_WRITE];
        }
      })
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

    const vertexBufferLayouts = t.getBasicVertexBufferLayouts({
      arrayStride: 8,
      attributePerBuffer: 2,
      offsetStep: 4,
      formatList: ['float32'],
      instanceStepModeBufferCount: 1,
      vertexStepModeBufferCount: 1,
    });

    // Test setIndexBuffer and setVertexBuffer without calling draw
    t.testSingleShoot(
      vertexBufferLayouts,
      indexBufferMappings,
      vertexBufferMappings,
      null,
      isUsageValid
    );

    if (isUsageValid) {
      // Test that the buffer setting won't cause validation error in draw functions.

      const drawCall = new DrawCall(t);
      // Draw
      drawCall.vertexCount = 4;
      drawCall.firstVertex = 0;
      // DrawIndexed
      drawCall.indexCount = 4;
      drawCall.firstIndex = 0;
      drawCall.baseVertex = 0;
      // Both Draw and DrawIndexed
      drawCall.instanceCount = 4;
      drawCall.firstInstance = 0;

      drawCall.drawType = 'draw';
      t.testSingleShoot(
        vertexBufferLayouts,
        indexBufferMappings,
        vertexBufferMappings,
        drawCall,
        isUsageValid
      );

      drawCall.drawType = 'drawIndexed';
      t.testSingleShoot(
        vertexBufferLayouts,
        indexBufferMappings,
        vertexBufferMappings,
        drawCall,
        isUsageValid
      );
    }
  });
