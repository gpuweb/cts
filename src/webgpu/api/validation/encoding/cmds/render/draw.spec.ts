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
interface DrawParameter {
  vertexCount: number;
  instanceCount?: number;
  firstVertex?: number;
  firstInstance?: number;
}

function callDraw(
  test: GPUTest,
  encoder: GPURenderCommandsMixin,
  drawType: 'draw' | 'drawIndirect',
  param: DrawParameter
) {
  switch (drawType) {
    case 'draw': {
      encoder.draw(
        param.vertexCount,
        param.instanceCount ?? 1,
        param.firstVertex ?? 0,
        param.firstInstance ?? 0
      );
      break;
    }
    case 'drawIndirect': {
      const indirectArray = new Int32Array([
        param.vertexCount,
        param.instanceCount ?? 1,
        param.firstVertex ?? 0,
        param.firstInstance ?? 0,
      ]);
      const indirectBuffer = test.makeBufferWithContents(indirectArray, GPUBufferUsage.INDIRECT);
      encoder.drawIndirect(indirectBuffer, 0);
      break;
    }
  }
}

function makeTestPipeline(
  test: ValidationTest,
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

  return test.device.createRenderPipeline({
    vertex: {
      module: test.device.createShaderModule({
        code: test.getNoOpShaderCode('VERTEX'),
      }),
      entryPoint: 'main',
      buffers: bufferLayouts,
    },
    fragment: {
      module: test.device.createShaderModule({
        code: test.getNoOpShaderCode('FRAGMENT'),
      }),
      entryPoint: 'main',
      targets: [{ format: 'rgba8unorm', writeMask: 0 }],
    },
    primitive: { topology: 'triangle-list' },
  });
}

function makeTestPipelineWithVertexAndInstanceBuffer(
  test: ValidationTest,
  arrayStride: number,
  attributeFormat: GPUVertexFormat,
  attributeOffset: number = 0
): GPURenderPipeline {
  const vertexBufferLayouts: VertexLayoutState<{}, {}> = [
    {
      slot: 1,
      stepMode: 'vertex',
      arrayStride,
      attributes: [
        {
          shaderLocation: 2,
          format: attributeFormat,
          offset: attributeOffset,
        },
      ],
    },
    {
      slot: 7,
      stepMode: 'instance',
      arrayStride,
      attributes: [
        {
          shaderLocation: 6,
          format: attributeFormat,
          offset: attributeOffset,
        },
      ],
    },
  ];

  return makeTestPipeline(test, vertexBufferLayouts);
}

export const g = makeTestGroup(ValidationTest);

g.test(`unused_buffer_bound`)
  .desc(
    `
In this test we test that a small buffer bound to unused buffer slot won't cause validation error.
- All draw commands,
  - An unused {index , vertex} buffer with uselessly small range is bound (immediately before draw
    call)
`
  )
  .params(u =>
    u //
      .combine('smallIndexBuffer', [false, true])
      .combine('smallVertexBuffer', [false, true])
      .combine('smallInstanceBuffer', [false, true])
      .beginSubcases()
      .combine('drawType', ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect'] as const)
      .unless(
        // Always provide index buffer of enough size if it is used by indexed draw
        p =>
          p.smallIndexBuffer &&
          (p.drawType === 'drawIndexed' || p.drawType === 'drawIndexedIndirect')
      )
      .combine('bufferOffset', [0, 4])
      .combine('boundSize', [0, 1])
  )
  .fn(async t => {
    const {
      smallIndexBuffer,
      smallVertexBuffer,
      smallInstanceBuffer,
      drawType,
      bufferOffset,
      boundSize,
    } = t.params;
    const renderPipeline = t.createNoOpRenderPipeline();
    const bufferSize = bufferOffset + boundSize;
    const smallBuffer = t.createBufferWithState('valid', {
      size: bufferSize,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.VERTEX,
    });
    // An index buffer of enough size, used if smallIndexBuffer === false
    const indexBuffer = t.createBufferWithState('valid', {
      size: 200,
      usage: GPUBufferUsage.INDEX,
    });

    for (const useBundle of [false, true]) {
      for (const setBufferBeforePipeline of [false, true]) {
        const commandBufferMaker = t.createEncoder(useBundle ? 'render bundle' : 'render pass');
        const renderEncoder = commandBufferMaker.encoder;

        if (!setBufferBeforePipeline) {
          renderEncoder.setPipeline(renderPipeline);
        }

        if (drawType === 'drawIndexed' || drawType === 'drawIndexedIndirect') {
          // Always use large enough index buffer for indexed draw. Index buffer OOB validation is
          // tested in index_buffer_OOB.
          renderEncoder.setIndexBuffer(indexBuffer, 'uint16', 0, 200);
        } else if (smallIndexBuffer) {
          renderEncoder.setIndexBuffer(smallBuffer, 'uint16', bufferOffset, boundSize);
        }
        if (smallVertexBuffer) {
          renderEncoder.setVertexBuffer(1, smallBuffer, bufferOffset, boundSize);
        }
        if (smallInstanceBuffer) {
          renderEncoder.setVertexBuffer(7, smallBuffer, bufferOffset, boundSize);
        }

        if (setBufferBeforePipeline) {
          renderEncoder.setPipeline(renderPipeline);
        }

        if (drawType === 'draw' || drawType === 'drawIndirect') {
          const drawParam: DrawParameter = {
            vertexCount: 100,
            instanceCount: 100,
            firstVertex: 100,
            firstInstance: 100,
          };

          callDraw(t, renderEncoder, drawType, drawParam);
        } else {
          const drawParam: DrawIndexedParameter = {
            indexCount: 100,
            instanceCount: 100,
            firstIndex: 0,
            baseVertex: 100,
            firstInstance: 100,
          };

          callDrawIndexed(t, renderEncoder, drawType, drawParam);
        }

        // Binding a unused small index/vertex buffer will never cause validation error.
        commandBufferMaker.validateFinishAndSubmit(true, true);
      }
    }
  });

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
  .fn(async t => {
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
    const indexBuffer = t.createBufferWithState('valid', desc);

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
        - x= weird buffer offset values
        - x= weird attribute offset values
        - x= weird arrayStride values
        - x= {render pass, render bundle}
- For vertex step mode vertex buffer,
    - Test that:
        - vertexCount largeish
        - firstVertex {=, >} 0
        - arrayStride is 0 and bound buffer size too small
        - (vertexCount + firstVertex) is zero
    - Validation error occurs in:
        - draw
        - drawIndexed with a zero array stride vertex step mode buffer OOB
    - Otherwise no validation error in drawIndexed, draIndirect and drawIndexedIndirect
- For instance step mode vertex buffer,
    - Test with draw and drawIndexed:
        - instanceCount largeish
        - firstInstance {=, >} 0
        - arrayStride is 0 and bound buffer size too small
        - (instanceCount + firstInstance) is zero
    - Validation error occurs in draw and drawIndexed
    - No validation error in drawIndirect and drawIndexedIndirect

In this test, we use a a render pipeline requiring one vertex step mode with different vertex buffer
layouts (attribute offset, array stride, vertex format). Then for a given drawing parameter set (e.g.,
vertexCount, instanceCount, firstVertex, indexCount), we calculate the exactly required size for
vertex step mode vertex buffer. Then, we generate buffer parameters (i.e. GPU buffer size,
binding offset and binding size) for all buffers, covering both (bound size == required size),
(bound size == required size - 1), and (bound size == 0), and test that draw and drawIndexed will
success/error as expected. Such set of buffer parameters should include cases like weird offset values.
`
  )
  .params(u =>
    u
      .combine('drawType', ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect'] as const)
      .combine('boundVertexBufferSizeState', ['zero', 'exile', 'enough'] as const)
      .combine('boundInstanceBufferSizeState', ['zero', 'exile', 'enough'] as const)
      .combine('zeroVertexStrideCount', [false, true] as const)
      .combine('zeroInstanceStrideCount', [false, true] as const)
      .combine('arrayStrideState', ['zero', 'exact', 'oversize'] as const)
      .combine('attributeOffsetFactor', [0, 1, 2, 7]) // the offset of attribute will be factor * MIN(4, sizeof(vertexFormat))
      .beginSubcases()
      .combine('setBufferOffset', [0, 200]) // must be a multiple of 4
      .combine('attributeFormat', ['snorm8x2', 'float32', 'float16x4'] as GPUVertexFormat[])
      .combine('vertexCount', [0, 1, 10000])
      .combine('firstVertex', [0, 10000])
      .filter(p => p.zeroVertexStrideCount === (p.firstVertex + p.vertexCount === 0))
      .combine('instanceCount', [0, 1, 10000])
      .combine('firstInstance', [0, 10000])
      .filter(p => p.zeroInstanceStrideCount === (p.firstInstance + p.instanceCount === 0))
      .unless(p => p.vertexCount === 10000 && p.instanceCount === 10000)
  )
  .fn(async t => {
    const {
      drawType,
      boundVertexBufferSizeState,
      boundInstanceBufferSizeState,
      zeroVertexStrideCount,
      zeroInstanceStrideCount,
      arrayStrideState,
      attributeOffsetFactor,
      setBufferOffset,
      attributeFormat,
      vertexCount,
      instanceCount,
      firstVertex,
      firstInstance,
    } = t.params;

    const attributeFormatInfo = kVertexFormatInfo[attributeFormat];
    const formatSize = attributeFormatInfo.bytesPerComponent * attributeFormatInfo.componentCount;
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

    const calcSetBufferSize = (
      boundBufferSizeState: 'zero' | 'exile' | 'enough',
      strideCount: number
    ): number => {
      let requiredBufferSize: number;
      if (strideCount > 0) {
        requiredBufferSize = arrayStride * (strideCount - 1) + lastStride;
      } else {
        // Spec do not validate bounded buffer size if strideCount == 0.
        requiredBufferSize = lastStride;
      }
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
      return setBufferSize;
    };

    const strideCountForVertexBuffer = firstVertex + vertexCount;
    const setVertexBufferSize = calcSetBufferSize(
      boundVertexBufferSizeState,
      strideCountForVertexBuffer
    );
    const vertexBufferSize = setBufferOffset + setVertexBufferSize;
    const strideCountForInstanceBuffer = firstInstance + instanceCount;
    const setInstanceBufferSize = calcSetBufferSize(
      boundInstanceBufferSizeState,
      strideCountForInstanceBuffer
    );
    const instanceBufferSize = setBufferOffset + setInstanceBufferSize;

    const vertexBuffer = t.createBufferWithState('valid', {
      size: vertexBufferSize,
      usage: GPUBufferUsage.VERTEX,
    });
    const instanceBuffer = t.createBufferWithState('valid', {
      size: instanceBufferSize,
      usage: GPUBufferUsage.VERTEX,
    });

    const renderPipeline = makeTestPipelineWithVertexAndInstanceBuffer(
      t,
      arrayStride,
      attributeFormat,
      attributeOffset
    );

    for (const useBundle of [false, true]) {
      for (const setBufferBeforePipeline of [false, true]) {
        const commandBufferMaker = t.createEncoder(useBundle ? 'render bundle' : 'render pass');
        const renderEncoder = commandBufferMaker.encoder;

        if (!setBufferBeforePipeline) {
          renderEncoder.setPipeline(renderPipeline);
        }
        renderEncoder.setVertexBuffer(1, vertexBuffer, setBufferOffset, setVertexBufferSize);
        renderEncoder.setVertexBuffer(7, instanceBuffer, setBufferOffset, setInstanceBufferSize);
        if (setBufferBeforePipeline) {
          renderEncoder.setPipeline(renderPipeline);
        }

        if (drawType === 'draw' || drawType === 'drawIndirect') {
          const drawParam: DrawParameter = {
            vertexCount,
            instanceCount,
            firstVertex,
            firstInstance,
          };

          callDraw(t, renderEncoder, drawType, drawParam);
        } else {
          const indexFormat = 'uint16';
          const indexElementSize = 2;
          const indexCount = 12;
          const indexBufferSize = indexElementSize * indexCount;

          const desc: GPUBufferDescriptor = {
            size: indexBufferSize,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
          };
          const indexBuffer = t.createBufferWithState('valid', desc);

          const drawParam: DrawIndexedParameter = {
            indexCount,
            instanceCount,
            firstIndex: 0,
            baseVertex: firstVertex,
            firstInstance,
          };

          renderEncoder.setIndexBuffer(indexBuffer, indexFormat, 0, indexBufferSize);
          callDrawIndexed(t, renderEncoder, drawType, drawParam);
        }

        const isVertexBufferOOB =
          boundVertexBufferSizeState !== 'enough' &&
          drawType === 'draw' && // drawIndirect, drawIndexed, and drawIndexedIndirect do not validate vertex step mode buffer
          !zeroVertexStrideCount; // vertex step mode buffer never OOB if stride count = 0
        const isInstanceBufferOOB =
          boundInstanceBufferSizeState !== 'enough' &&
          (drawType === 'draw' || drawType === 'drawIndexed') && // drawIndirect and drawIndexedIndirect do not validate instance step mode buffer
          !zeroInstanceStrideCount; // vertex step mode buffer never OOB if stride count = 0
        const isFinishSuccess = !isVertexBufferOOB && !isInstanceBufferOOB;

        commandBufferMaker.validateFinishAndSubmit(isFinishSuccess, true);
      }
    }
  });

g.test(`buffer_binding_overlap`)
  .desc(
    `
In this test we test that binding one GPU buffer to multiple vertex buffer slot or both vertex
buffer slot and index buffer will cause no validation error, with completely/partial overlap.
    - x= all draw types
`
  )
  .params(u =>
    u //
      .combine('drawType', ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect'] as const)
      .beginSubcases()
      .combine('vertexBoundOffestFactor', [0, 0.5, 1, 1.5, 2])
      .combine('instanceBoundOffestFactor', [0, 0.5, 1, 1.5, 2])
      .combine('indexBoundOffestFactor', [0, 0.5, 1, 1.5, 2])
      .combine('arrayStrideState', ['zero', 'exact', 'oversize'] as const)
  )
  .fn(async t => {
    const {
      drawType,
      vertexBoundOffestFactor,
      instanceBoundOffestFactor,
      indexBoundOffestFactor,
      arrayStrideState,
    } = t.params;

    const attributeFormat = 'float32x4';
    const indexFormat = 'uint16';
    const indexElementSize = 2;
    const indexCount = 100;
    const vertexCount = 100;
    const instanceCount = 100;
    const firstVertex = 100;
    const firstInstance = 100;

    const attributeFormatInfo = kVertexFormatInfo[attributeFormat];
    const formatSize = attributeFormatInfo.bytesPerComponent * attributeFormatInfo.componentCount;
    const attributeOffset = 0;
    const lastStride = attributeOffset + formatSize;
    let arrayStride = 0;
    if (arrayStrideState !== 'zero') {
      arrayStride = lastStride;
      if (arrayStrideState === 'oversize') {
        arrayStride = arrayStride + 20;
      }
      arrayStride = arrayStride + (-arrayStride & 3); // Make sure arrayStride is a multiple of 4
    }

    const calcAttributeBufferSize = (strideCount: number): number => {
      let requiredBufferSize: number;
      if (strideCount > 0) {
        requiredBufferSize = arrayStride * (strideCount - 1) + lastStride;
      } else {
        // Spec do not validate bounded buffer size if strideCount == 0.
        requiredBufferSize = lastStride;
      }
      return requiredBufferSize;
    };

    const calcSetBufferOffset = (requiredSetBufferSize: number, offsetFactor: number): number => {
      const offset = Math.ceil(requiredSetBufferSize * offsetFactor);
      const alignedOffset = offset + (-offset & 3); // Make sure offset is a multiple of 4
      return alignedOffset;
    };

    const strideCountForVertexBuffer = firstVertex + vertexCount;
    const setVertexBufferSize = calcAttributeBufferSize(strideCountForVertexBuffer);
    const setVertexBufferOffset = calcSetBufferOffset(setVertexBufferSize, vertexBoundOffestFactor);
    let requiredBufferSize = setVertexBufferOffset + setVertexBufferSize;

    const strideCountForInstanceBuffer = firstInstance + instanceCount;
    const setInstanceBufferSize = calcAttributeBufferSize(strideCountForInstanceBuffer);
    const setInstanceBufferOffset = calcSetBufferOffset(
      setInstanceBufferSize,
      instanceBoundOffestFactor
    );
    requiredBufferSize = Math.max(
      requiredBufferSize,
      setInstanceBufferOffset + setInstanceBufferSize
    );

    const setIndexBufferSize = indexCount * indexElementSize;
    const setIndexBufferOffset = calcSetBufferOffset(setIndexBufferSize, indexBoundOffestFactor);
    requiredBufferSize = Math.max(requiredBufferSize, setIndexBufferOffset + setIndexBufferSize);

    const sharedBuffer = t.createBufferWithState('valid', {
      size: requiredBufferSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX,
    });

    const renderPipeline = makeTestPipelineWithVertexAndInstanceBuffer(
      t,
      arrayStride,
      attributeFormat
    );

    for (const useBundle of [false, true]) {
      for (const setBufferBeforePipeline of [false, true]) {
        const commandBufferMaker = t.createEncoder(useBundle ? 'render bundle' : 'render pass');
        const renderEncoder = commandBufferMaker.encoder;

        if (!setBufferBeforePipeline) {
          renderEncoder.setPipeline(renderPipeline);
        }
        renderEncoder.setVertexBuffer(1, sharedBuffer, setVertexBufferOffset, setVertexBufferSize);
        renderEncoder.setVertexBuffer(
          7,
          sharedBuffer,
          setInstanceBufferOffset,
          setInstanceBufferSize
        );
        renderEncoder.setIndexBuffer(
          sharedBuffer,
          indexFormat,
          setIndexBufferOffset,
          setIndexBufferSize
        );
        if (setBufferBeforePipeline) {
          renderEncoder.setPipeline(renderPipeline);
        }

        if (drawType === 'draw' || drawType === 'drawIndirect') {
          const drawParam: DrawParameter = {
            vertexCount,
            instanceCount,
            firstVertex,
            firstInstance,
          };

          callDraw(t, renderEncoder, drawType, drawParam);
        } else {
          const drawParam: DrawIndexedParameter = {
            indexCount,
            instanceCount,
            firstIndex: 0,
            baseVertex: firstVertex,
            firstInstance,
          };

          callDrawIndexed(t, renderEncoder, drawType, drawParam);
        }

        // Since all bound buffer are of enough size, draw call should always succeed.
        commandBufferMaker.validateFinishAndSubmit(true, true);
      }
    }
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
