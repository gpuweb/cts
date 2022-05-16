export const description = `
Here we test the validation for draw functions, mainly the buffer access validation. All four types
of draw calls are tested, and test that validation errors do / don't occur for certain call type
and parameters as expect.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { kVertexFormatInfo } from '../../../../../capability_info.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { ValidationTest } from '../../../validation_test.js';

type VertexAttrib<A> = A & { shaderLocation: number };
type VertexBuffer<V, A> = V & {
  slot: number;
  attributes: VertexAttrib<A>[];
};
type VertexState<V, A> = VertexBuffer<V, A>[];

type VertexLayoutState<V, A> = VertexState<
  { stepMode: GPUVertexStepMode; arrayStride: number } & V,
  { format: GPUVertexFormat; offset: number } & A
>;

interface DrawIndexedParameter {
  indexCount: number;
  instanceCount?: number;
  firstIndex?: number;
  baseVertex?: number;
  firstInstance?: number;
}

function callDrawIndexed(
  test: GPUTest,
  encoder: GPURenderCommandsMixin,
  drawType: 'drawIndexed' | 'drawIndexedIndirect',
  param: DrawIndexedParameter
) {
  switch (drawType) {
    case 'drawIndexed': {
      encoder.drawIndexed(
        param.indexCount,
        param.instanceCount ?? 1,
        param.firstIndex ?? 0,
        param.baseVertex ?? 0,
        param.firstInstance ?? 0
      );
      break;
    }
    case 'drawIndexedIndirect': {
      const indirectArray = new Int32Array([
        param.indexCount,
        param.instanceCount ?? 1,
        param.firstIndex ?? 0,
        param.baseVertex ?? 0,
        param.firstInstance ?? 0,
      ]);
      const indirectBuffer = test.makeBufferWithContents(indirectArray, GPUBufferUsage.INDIRECT);
      encoder.drawIndexedIndirect(indirectBuffer, 0);
      break;
    }
  }
}

class F extends ValidationTest {
  makeTestPipeline(
    buffers: VertexState<
      { stepMode: GPUVertexStepMode; arrayStride: number },
      {
        offset: number;
        format: GPUVertexFormat;
      }
    >
  ): GPURenderPipeline {
    const bufferLayouts: GPUVertexBufferLayout[] = [];
    for (const b of buffers) {
      bufferLayouts[b.slot] = b;
    }

    return this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: this.getNoOpShaderCode('VERTEX'),
        }),
        entryPoint: 'main',
        buffers: bufferLayouts,
      },
      fragment: {
        module: this.device.createShaderModule({
          code: this.getNoOpShaderCode('FRAGMENT'),
        }),
        entryPoint: 'main',
        targets: [{ format: 'rgba8unorm', writeMask: 0 }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }
}

export const g = makeTestGroup(F);

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

g.test(`index_buffer_OOB`)
  .desc(
    `
In this test we test that index buffer OOB is caught as a validation error in drawIndexed, but not in
drawIndexedIndirect as it is GPU-validated.
- Issue an indexed draw call, with the following index buffer states, for {all index formats}:
    - range and GPUBuffer are exactly the required size for the draw call
    - range is too small but GPUBuffer is still large enough
    - range and GPUBuffer are both too small
`
  )
  .params(u =>
    u
      .combine('bufferSizeInElements', [10, 100])
      // Binding size is always no larger than buffer size, make sure that setIndexBuffer succeed
      .combine('bindingSizeInElements', [10])
      .combine('drawIndexCount', [10, 11])
      .combine('drawType', ['drawIndexed', 'drawIndexedIndirect'] as const)
      .beginSubcases()
      .combine('indexFormat', ['uint16', 'uint32'] as const)
      .combine('useBundle', [false, true])
  )
  .fn(t => {
    const {
      indexFormat,
      bindingSizeInElements,
      bufferSizeInElements,
      drawIndexCount,
      drawType,
      useBundle,
    } = t.params;

    const indexElementSize = indexFormat === 'uint16' ? 2 : 4;
    const bindingSize = bindingSizeInElements * indexElementSize;
    const bufferSize = bufferSizeInElements * indexElementSize;

    const desc: GPUBufferDescriptor = {
      size: bufferSize,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    };
    const indexBuffer = t.device.createBuffer(desc);

    const drawCallParam: DrawIndexedParameter = {
      indexCount: drawIndexCount,
    };

    // Encoder finish will succeed if no index buffer access OOB when calling drawIndexed,
    // and always succeed when calling drawIndexedIndirect.
    const isFinishSuccess =
      drawIndexCount <= bindingSizeInElements || drawType === 'drawIndexedIndirect';

    const renderPipeline = t.createNoOpRenderPipeline();

    const commandBufferMaker = t.createEncoder(useBundle ? 'render bundle' : 'render pass');
    const renderEncoder = commandBufferMaker.encoder;

    renderEncoder.setIndexBuffer(indexBuffer, indexFormat, 0, bindingSize);

    renderEncoder.setPipeline(renderPipeline);

    callDrawIndexed(t, renderEncoder, drawType, drawCallParam);

    commandBufferMaker.validateFinishAndSubmit(isFinishSuccess, true);
  });

g.test(`vertex_buffer_OOB`)
  .desc(
    `
In this test we test the vertex buffer OOB validation in draw calls. Specifically, only vertex step
mode buffer OOB in draw and instance step mode buffer OOB in draw and drawIndexed are CPU-validated.
Other cases are handled by robust access and no validation error occurs.
- Test that:
    - Draw call needs to read {=, >} any bound vertex buffer range, with GPUBuffer that is {large
      enough, exactly the size of bound range}
        - Binding size = 0 (ensure it's not treated as a special case)
        - x= weird offset values
        - x= weird arrayStride values
        - x= {render pass, render bundle}
- For vertex step mode vertex buffer,
    - Test that:
        - vertexCount largeish
        - firstVertex {=, >} 0
        - arrayStride is 0 and bound buffer size too small
    - Validation error occurs in:
        - draw
        - drawIndexed with a zero array stride vertex step mode buffer OOB
    - Otherwise no validation error in drawIndexed, draIndirect and drawIndexedIndirect
- For instance step mode vertex buffer,
    - Test with draw and drawIndexed:
        - instanceCount largeish
        - firstInstance {=, >} 0
        - arrayStride is 0 and bound buffer size too small
    - Validation error occurs in draw and drawIndexed
    - No validation error in drawIndirect and drawIndexedIndirect

In this test, we use a a render pipeline requiring one vertex step mode and one instance step mode
vertex buffer. Then for a given drawing parameter set (e.g., vertexCount, instanceCount, firstVertex,
indexCount), we calculate the exactly required size for vertex step mode vertex buffer, instance
step mode vertex buffer and index buffer. Then, we generate buffer parameters (i.e. GPU buffer size,
binding offset and binding size) for all three buffer, covering both (bound size == required size)
and (bound size == required size - 1), and test that draw and drawIndexed will success/error as
expected. Such set of buffer parameters should include cases like weird offset values.
`
  )
  .unimplemented();

g.test(`vertex_buffer_OOB,vertex_step_mode`)
  .desc(
    `
In this test we test the vertex buffer OOB validation in draw calls. Specifically, only vertex step
mode buffer OOB in draw and instance step mode buffer OOB in draw and drawIndexed are CPU-validated.
Other cases are handled by robust access and no validation error occurs.
- Test that:
    - Draw call needs to read {=, >} any bound vertex buffer range, with GPUBuffer that is {large
      enough, exactly the size of bound range}
        - Binding size = 0 (ensure it's not treated as a special case)
        - x= weird buffer offset values
        - x= weird attribute offset values
        - x= weird arrayStride values
        - x= {render pass, render bundle}
- For vertex step mode vertex buffer,
    - Test that:
        - vertexCount largeish
        - firstVertex {=, >} 0
        - arrayStride is 0 and bound buffer size too small
    - Validation error occurs in:
        - draw
        - drawIndexed with a zero array stride vertex step mode buffer OOB
    - Otherwise no validation error in drawIndexed, draIndirect and drawIndexedIndirect

In this test, we use a a render pipeline requiring one vertex step mode and one instance step mode
vertex buffer. Then for a given drawing parameter set (e.g., vertexCount, instanceCount, firstVertex,
indexCount), we calculate the exactly required size for vertex step mode vertex buffer, instance
step mode vertex buffer and index buffer. Then, we generate buffer parameters (i.e. GPU buffer size,
binding offset and binding size) for all buffers, covering both (bound size == required size),
(bound size == required size - 1), and (bound size == 0), and test that draw and drawIndexed will
success/error asexpected. Such set of buffer parameters should include cases like weird offset values.
`
  )
  .beforeAllSubcases(t => {
    t.selectMismatchedDeviceOrSkipTestCase(undefined);
  })
  .params(u =>
    u //
      // .combine('zeroArrayStride', [false, true])  // must be a multiple of 4
      .combine('arrayStrideState', ['zero', 'exact', 'oversize'] as const) // must be a multiple of 4
      .combine('firstVertex', [0, 10])
      .combine('vertexCount', [0, 10, 10000])
      .combine('vertexFormat', ['snorm8x2', 'float32', 'float16x4'] as GPUVertexFormat[])
      .combine('attributeOffsetFactor', [0, 1, 2, 7]) // the offset of attribute will be factor * MIN(4, sizeof(vertexFormatt))
      .beginSubcases()
      .combine('useBundle', [false, true])
      .combine('setBufferOffset', [0, 4, 200]) // must be a multiple of 4
      .combine('boundBufferSizeState', ['zero', 'exile', 'enough'] as const)
  )
  .fn(t => {
    const {
      setBufferOffset,
      arrayStrideState,
      firstVertex,
      vertexCount,
      vertexFormat,
      attributeOffsetFactor,
      useBundle,
      boundBufferSizeState,
    } = t.params;

    /*
  const indexElementSize = indexFormat === 'uint16' ? 2 : 4;
  const bindingSize = bindingSizeInElements * indexElementSize;
  const bufferSize = bufferSizeInElements * indexElementSize;

  const desc: GPUBufferDescriptor = {
    size: bufferSize,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  };
  const indexBuffer = t.device.createBuffer(desc);

  const drawCallParam: DrawIndexedParameter = {
    indexCount: drawIndexCount,
  };
  */

    const vertexFormatInfo = kVertexFormatInfo[vertexFormat];
    const formatSize = vertexFormatInfo.bytesPerComponent * vertexFormatInfo.componentCount;
    const attributeOffset = attributeOffsetFactor * Math.min(4, formatSize);
    const lastStride = attributeOffset + formatSize;
    let arrayStride = 0;
    if (arrayStrideState !== 'zero') {
      arrayStride = lastStride;
      if (arrayStrideState === 'oversize') {
        arrayStride = arrayStride + 20;
      }
      arrayStride = arrayStride + (-arrayStride & 3); // Make sure arrayStride is a multiple of 4
    }

    const strideCountForVertexBuffer = firstVertex + vertexCount;
    const requiredBufferSize = arrayStride * (strideCountForVertexBuffer - 1) + lastStride;
    let setBufferSize: number;
    switch (boundBufferSizeState) {
      case 'zero': {
        setBufferSize = 0;
        break;
      }
      case 'exile': {
        setBufferSize = requiredBufferSize - 1;
        break;
      }
      case 'enough': {
        setBufferSize = requiredBufferSize;
        break;
      }
    }
    const bufferSize = setBufferOffset + setBufferSize;

    const buffer = t.createBufferWithState('valid', {
      size: bufferSize,
      usage: GPUBufferUsage.VERTEX,
    });

    const vertexBufferLayouts: VertexLayoutState<{}, {}> = [
      {
        slot: 1,
        stepMode: 'vertex',
        arrayStride,
        attributes: [
          {
            shaderLocation: 2,
            format: vertexFormat,
            offset: attributeOffset,
          },
        ],
      },
    ];

    // const renderPipeline = t.createNoOpRenderPipeline();
    const renderPipeline = t.makeTestPipeline(vertexBufferLayouts);

    const commandBufferMaker = t.createEncoder(useBundle ? 'render bundle' : 'render pass');
    const renderEncoder = commandBufferMaker.encoder;

    renderEncoder.setPipeline(renderPipeline);
    renderEncoder.setVertexBuffer(1, buffer, setBufferOffset, setBufferSize);

    // callDrawIndexed(t, renderEncoder, drawType, drawCallParam);
    const isFinishSuccess = true;
    commandBufferMaker.validateFinishAndSubmit(isFinishSuccess, true);
  });

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

g.test(`buffer_binding_overlap`)
  .desc(
    `
In this test we test that binding one GPU buffer to multiple vertex buffer slot or both vertex
buffer slot and index buffer will cause no validation error, with completely/partial overlap.
    - x= all draw types
`
  )
  .unimplemented();
