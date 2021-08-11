export const description = `
Here we test the vertex buffer validation within creating render pipeline, setting index and vertex
buffer, and calling draw function. For draw function, we only tests OOB for draw, and index buffer
and instance step mode vertex buffer OOB for drawIndexed. Vertex step mode vertex buffer OOB for
drawIndexed, vertex buffer OOB for drawIndirect and vertex and index buffer OOB for
drawIndexedIndirect are covered in robust access.
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { unreachable } from '../../../common/util/util.js';
import { kVertexFormatInfo } from '../../capability_info.js';
import { GPUConst } from '../../constants.js';

import { ValidationTest } from './validation_test.js';

// Class that indicate how to call a draw function
// TODO: implement this class to hold the draw call parameter and insert draw call to encoder
class DrawCall {
  callDraw(encoder: GPURenderEncoderBase) {
    unreachable();
  }
}

// Interfaces that indicate how to call setIndexBuffer and setIndexBuffer
interface SetBufferParam {
  buffer: GPUBuffer;
  offset?: number;
  size?: number;
}

interface SetVertexBufferParam extends SetBufferParam {
  slot: number;
}

interface SetIndexBufferParam extends SetBufferParam {
  indexFormat: GPUIndexFormat;
}

// Class that indicate how to make input attribute for vertex shader module
interface VertexShaderInput {
  shaderLocation: GPUIndex32;
  wgslType: string;
}

class F extends ValidationTest {
  // Create a vertex shader module with given attributes wgsl type
  generateVertexShaderModuleFromInputDescriptor(
    vertexInputDescriptor: VertexShaderInput[]
  ): GPUShaderModule {
    const shaderInput = vertexInputDescriptor
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
    return this.generateVertexShaderModuleFromInputDescriptor(
      vertexBufferLayouts
        .reduce<GPUVertexAttribute[]>((a, c) => [...a, ...c.attributes], [])
        .map(
          attr =>
            ({
              shaderLocation: attr.shaderLocation,
              wgslType: kVertexFormatInfo[attr.format].wgslType,
            } as const)
        )
    );
  }

  /**
   * Create a render pipeline with given vertex buffer layouts. The vertex shader module is created
   * using the exact matching WGSL type (as in typeInfoMap) for all attributes in all buffers in
   * layouts. If a different vertex shader is wanted (especially when testing WGSL type
   * compatibility), a standalone list of vertex shader input descriptor should be given.
   * @param vertexBufferLayouts A list of GPUVertexBufferLayout to be used in render pipeline descriptor,
   * and also used to generate the vertex shader module if `vertexShaderInputs` is not given.
   * @param vertexShaderInputs Optional, the standalone list of vertex shader input descriptor.
   */
  createRenderPipelineFromBufferLayout(
    vertexBufferLayouts: GPUVertexBufferLayout[],
    vertexShaderInputs?: VertexShaderInput[]
  ): GPURenderPipeline {
    return this.device.createRenderPipeline({
      vertex: {
        module: vertexShaderInputs
          ? this.generateVertexShaderModuleFromInputDescriptor(vertexShaderInputs)
          : this.generateVertexShaderModuleFromBufferLayout(vertexBufferLayouts),
        entryPoint: 'main',
        buffers: vertexBufferLayouts,
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

  /**
   * Generate a basic vertex buffer layout array containing given number of instance step mode and
   * vertex step mode vertex buffer, each of them contain a given number of attributes, whose
   * offsets form a arithmetic sequence. Within a buffer, the formats of attributes are chosen from
   * formatList repeatedly.
   */
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

  setIndexBuffers(renderEncoder: GPURenderEncoderBase, params: SetIndexBufferParam[]) {
    for (const p of params) {
      renderEncoder.setIndexBuffer(p.buffer, p.indexFormat, p.offset, p.size);
    }
  }

  setVertexBuffers(renderEncoder: GPURenderEncoderBase, params: SetVertexBufferParam[]) {
    for (const p of params) {
      renderEncoder.setVertexBuffer(p.slot, p.buffer, p.offset, p.size);
    }
  }

  /**
   * Testing method that create render pipeline from a given buffer layout array, set index and
   * vertex buffer before/after setting pipeline, call one given draw function if any, and check if
   * there is any validation error when finishing encoder.
   */
  doBufferSettingAndDraw(
    vertexBufferLayouts: GPUVertexBufferLayout[],
    indexBufferParams: SetIndexBufferParam[],
    vertexBufferParams: SetVertexBufferParam[],
    drawCall: DrawCall | null,
    isFinishSuccess: boolean,
    setPipelineBeforeBuffer: boolean,
    useBundle: boolean
  ) {
    const renderPipeline = this.createRenderPipelineFromBufferLayout(vertexBufferLayouts);

    const commandBufferMaker = this.createEncoder(useBundle ? 'render bundle' : 'render pass');
    const renderEncoder = commandBufferMaker.encoder;

    if (setPipelineBeforeBuffer) {
      renderEncoder.setPipeline(renderPipeline);
    }

    this.setIndexBuffers(renderEncoder, indexBufferParams);
    this.setVertexBuffers(renderEncoder, vertexBufferParams);

    if (!setPipelineBeforeBuffer) {
      renderEncoder.setPipeline(renderPipeline);
    }

    if (drawCall !== null) {
      drawCall.callDraw(renderEncoder);
    }

    commandBufferMaker.validateFinishAndSubmit(isFinishSuccess, true);
  }

  /**
   * Test from setting index buffer, setting vertex buffer, setting pipeline, calling one given draw
   * call if any, to finish the encoder and submit the commang buffer, and check if validation error
   * does or doesn't occur as expected when finishing the encoder. This method tests all cases that
   * are with/out using bundle and setting buffer before/after setting pipeline.
   */
  testEncoderFinish(
    vertexBufferLayouts: GPUVertexBufferLayout[],
    indexBufferMappings: SetIndexBufferParam[],
    vertexBufferMappings: SetVertexBufferParam[],
    drawCall: DrawCall | null,
    isFinishSuccess: boolean
  ) {
    for (const setPipelineBeforeBuffer of [false, true]) {
      for (const useBundle of [false, true]) {
        this.doBufferSettingAndDraw(
          vertexBufferLayouts,
          indexBufferMappings,
          vertexBufferMappings,
          drawCall,
          isFinishSuccess,
          setPipelineBeforeBuffer,
          useBundle
        );
      }
    }
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

g.test('set_buffer_usage_validation')
  .desc(
    `
In this test, we test the usage validation within setIndexBuffer and setVertexBuffer.
    - Validate that buffer usage mismatch is catched by set*Buffer
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
      // Test all usage case for all 3 buffers
      .combine('indexBufferUsage', bufferUsageListForTest)
      .combine('veretxBufferUsage', bufferUsageListForTest)
      .combine('instanceBufferUsage', bufferUsageListForTest)
  )
  .fn(t => {
    const p = t.params;

    const usages = [p.indexBufferUsage, p.veretxBufferUsage, p.instanceBufferUsage];
    const buffers: GPUBuffer[] = usages.map(usage =>
      t.createBufferWithState('valid', {
        size: 128,
        usage,
        mappedAtCreation: false,
      })
    );

    const indexBuffer = buffers[0];
    const instanceBuffer = buffers[1];
    const vertexBuffer = buffers[2];

    const indexBufferParams: SetIndexBufferParam[] = [
      { indexFormat: p.indexFormat, buffer: indexBuffer },
    ];
    const vertexBufferParams: SetVertexBufferParam[] = [
      { slot: 0, buffer: instanceBuffer },
      { slot: 1, buffer: vertexBuffer },
    ];

    const isUsageValid =
      (usages[0] & GPUBufferUsage.INDEX) === GPUBufferUsage.INDEX &&
      (usages[1] & GPUBufferUsage.VERTEX) === GPUBufferUsage.VERTEX &&
      (usages[2] & GPUBufferUsage.VERTEX) === GPUBufferUsage.VERTEX;

    // Test setIndexBuffer and setVertexBuffer without calling draw
    t.testEncoderFinish(
      t.getBasicVertexBufferLayouts({}),
      indexBufferParams,
      vertexBufferParams,
      null,
      isUsageValid
    );
  });

g.test('set_buffer_parameter_validation')
  .desc(
    `
In this test we test the parameter validation in setIndexBuffer and setVertexBuffer, and we test
that implicit parameter used in setIndexBuffer and setVertexBuffer is computed correctly, and use
draw and drawIndexed to validate the buffer binding is as we expect.
    - Test that bound range out-of-bounds on the GPUBuffer is catched by set*Buffer.
    - Exam that implicit offset/size are computed correctly.
    - Test that validation catch the situation that buffer offset > buffer size.
    - Test that setVertexBuffer validate the slot is less than maxVertexBuffers.
    - Test that given/computed zero index/vertex buffer bound size is valid as long as drawing
      0 index/vertex.
    - Test setting index and vertex buffer before/after setPipeline make no different.

Related set*Buffer validation rules:
    - Index buffer
        - offset is a multiple of indexFormat's byte size.
        - offset + size less than or equal to buffer.[[size]].
    - Vertex buffer
        - slot < this.[[device]].[[limits]].maxVertexBuffers.
        - offset is a multiple of 4.
        - offset + size less than or equal to buffer.[[size]].
`
  )
  .unimplemented();

g.test(`buffer_binding_overlap`)
  .desc(
    `
In this test, we test the buffer overlapping, i.e. one GPUBuffer is bound to multiple vertex buffer
slot or both index buffer and vertex buffer slot, with different offset setting (range completely
overlap, partially overlap and no renge overlap). All 4 types of draw call are tested to ensure
that the setting doesn't cause validation error when drawing.
    - Test overlapping {vertex/vertex,vertex/index} buffers are valid with/out draw.
    - Test all range overlapping situation for buffers
    - Validate that calling set*Buffer before/after setPipeline is the same
`
  )
  .unimplemented();

g.test(`needed_buffer_missing`)
  .desc(
    `
In this test we test that any missing buffer for a used slot will cause validation errors when drawing.
- All (non/indexed, in/direct) draw commands
    - A needed vertex buffer is not bound
        - Was bound in another render pass but not the current one
        - x= all vertex formats
- Indexed draw commands,
    - No index buffer is bound
`
  )
  .unimplemented();

g.test(`unused_buffer_bound`)
  .desc(
    `
In this test we test that a small buffer bound to unused buffer slot won't cause validation error.
- All draw commands,
  - An unused {index , vertex} buffer with uselessly small range is bound (immediately before draw
    call)
`
  )
  .unimplemented();

g.test(`last_buffer_setting_take_account`)
  .desc(
    `
In this test we test that only the last setting for a buffer slot take account.
- All (non/indexed, in/direct) draw commands
  - setPl, setVB, setIB, draw, {setPl,setVB,setIB,nothing (control)}, then a larger draw that
    wouldn't have been valid before that
`
  )
  .unimplemented();

g.test(`index_buffer_OOB`)
  .desc(
    `
In this test we test that index buffer OOB is catched as validation error in drawIndex.
drawIndexedIndirect didn't has such validation yet.
- Indexed draw commands,
    - Draw call needs to read {=, >} the bound index buffer range, with GPUBuffer that is {large
      enough, exactly the size of bound range}
        - range is too small and GPUBuffer is large enough
        - range and GPUBuffer are exact size
        - x= all index formats
`
  )
  .unimplemented();

g.test(`vertex_buffer_OOB`)
  .desc(
    `
In this test we test that vertex buffer OOB is catched as validation error in draw call. Specifically,
only vertex step mode buffer OOB in draw and instance step mode buffer OOB in draw and drawIndexed
are CPU-validated. Other cases are currently handled by robust access.
- Test that:
    - Draw call needs to read {=, >} any bound vertex buffer range, with GPUBuffer that is {large
      enough, exactly the size of bound range}
        - x= all vertex formats
        - x= weird offset values
        - x= weird arrayStride values
        - x= {render pass, render bundle}
- For vertex step mode vertex buffer,
    - Test with draw:
        - vertexCount largeish
        - firstVertex {=, >} 0
    - drawIndexed, draIndirect and drawIndexedIndirect are dealt by robust access
- For instance step mode vertex buffer,
    - Test with draw and drawIndexed:
        - instanceCount largeish
        - firstInstance {=, >} 0
    - draIndirect and drawIndexedIndirect are dealt by robust access
`
  )
  .unimplemented();

g.test(`largeish_buffer`)
  .desc(
    `
In this test we test that a very large range of buffer is bound to different slot, and no validation
error occurs.
- A bound vertex buffer range is significantly larger than necessary
- A bound index buffer range is significantly larger than necessary
`
  )
  .unimplemented();

g.test('buffer_must_unmap_before_queue_submit')
  .desc(
    `
In this test we test that submitting a command buffer with buffers that are still mapping will cause
validation error.
  `
  )
  .unimplemented();

g.test('create_render_pipeline_vertex_buffer_layout_validation')
  .desc(
    `
In this test we test the vertex buffer layuouts validation within creating render pipeline.
    - Test aspect: arrayStrideValue, attributeOffset, attributeCount, wgslTypeCompatible,
      bufferCount, indistinctLocation
    - When testing the arrayStrideValue aspect, we test the following validation in GPUVertexBufferLayout:
      - descriptor.arrayStride Γëñ device.[[device]].[[limits]].maxVertexBufferArrayStride.
      - descriptor.arrayStride is a multiple of 4.
    - When testing the attributeOffset aspect, we test the following validation in GPUVertexBufferLayout:
      - For each attribute attrib in the list descriptor.attributes:
        - If descriptor.arrayStride is zero:
          - attrib.offset + sizeof(attrib.format) Γëñ device.[[device]].[[limits]].maxVertexBufferArrayStride.
        - Otherwise:
          - attrib.offset + sizeof(attrib.format) Γëñ descriptor.arrayStride.
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
  .unimplemented();
