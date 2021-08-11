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
