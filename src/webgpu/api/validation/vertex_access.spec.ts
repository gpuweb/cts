export const description = `
TODO: make sure this isn't already covered somewhere else, review, organize, and implement.
> - In encoder.finish():
>     - setVertexBuffer and setIndexBuffer commands (even if no draw):
>         - If not valid at draw time, test overlapping {vertex/vertex,vertex/index}
>           buffers are valid without draw.
>         - Before, after setPipeline (should have no effect)
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
>     - All non-indexed (in/direct) draw commands, {
>         - An unused {index (with uselessly small range), vertex} buffer
>           is bound (immediately before draw call)
>         - }
>     - All indexed (in/direct) draw commands, {
>         - No index buffer is bound
>         - Same GPUBuffer bound to index buffer and a vertex buffer slot
>             - Non-overlapping, overlapping ranges
>         - Draw call needs to read {=, >} the bound index buffer range
>           (with GPUBuffer that is always large enough)
>             - range is too small and GPUBuffer is large enough
>             - range and GPUBuffer are exact size
>             - x= all index formats
>         - Bound index buffer range is significantly larger than necessary
>         - }
>     - Alignment constraints on setVertexBuffer if any
>     - Alignment constraints on setIndexBuffer if any
> - In queue.submit():
>     - Indexed draw call with index buffer containing:
>         - Index value that goes out-of-bounds on a bound vertex buffer range
>         - Index value that is extremely large (but not the primitive restart value)
>     - Line strip or triangle strip with index buffer containing:
>         - Primitive restart value
>         - Primitive restart value minus one (and the bound vertex buffers are < that size)
>     - Indirect draw call with arguments that:
>         - Go out-of-bounds on the bound index buffer range
>         - Go out-of-bounds on the bound vertex buffer range

TODO: Had two plans with roughly the same name. Figure out where to categorize these notes:
> All x= {render pass, render bundle}
>
> - non-indexed draws:
>     - vertex access out of bounds (make sure this doesn't overlap with robust access)
>         - bound vertex buffer **ranges** are {exact size, just under exact size} needed for draws with:
>             - vertexCount largeish
>             - firstVertex {=, >} 0
>             - instanceCount largeish
>             - firstInstance {=, >} 0
>         - include VBs with both step modes
>     - x= {draw, drawIndirect}
> - indexed draws:
>     - vertex access out of bounds (make sure this doesn't overlap with robust access)
>         - bound vertex buffer **ranges** are {exact size, just under exact size} needed for draws with:
>             - a vertex index in the buffer is largeish
>             - baseVertex {=, >} 0
>             - instanceCount largeish
>             - firstInstance {=, >} 0
>         - include VBs with both step modes
>     - x= {drawIndirect, drawIndexedIndirect}
`;

import { makeTestGroup } from '../../../common/framework/test_group.js';

import { ValidationTest } from './validation_test.js';

export const g = makeTestGroup(ValidationTest);

g.test('Blabla').unimplemented();
/* fn(t => {
  const p = t.params;
  // Vertex buffer descriptors
  const buffers: GPUVertexBufferLayout[] = this.generateVertexBufferDescriptors();

  // Pipeline setup, texture setup
  const pipeline = this.createRenderPipeline();

  const colorAttachment = t.device.createTexture({
    format: 'rgba8unorm',
    size: { width: 2, height: 1, depthOrArrayLayers: 1 },
    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const colorAttachmentView = colorAttachment.createView();

  const encoder = t.device.createCommandEncoder();
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
  const commandBuffer: GPUCommandBuffer = encoder.finish();
  t.device.queue.submit([commandBuffer]);

})
*/
