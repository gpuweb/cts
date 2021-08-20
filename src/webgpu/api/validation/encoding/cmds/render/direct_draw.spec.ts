export const description = `
Here we test the vertex buffer validation for direct draw function. For drawIndexed We only tests
index buffer and instance step mode vertex buffer OOB. Vertex step mode vertex buffer OOB for
drawIndexed is covered in robust access.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../../validation_test.js';

class F extends ValidationTest {
  // TODO: Implement the helper functions
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
In this test we test that index buffer OOB is catched as validation error in drawIndexed.
(drawIndexedIndirect doesn't produce a validation error in this case as it is GPU-validated.)
- Issue an indexed draw call, with the following index buffer states, for {all index formats}:
    - range and GPUBuffer are exactly the required size for the draw call
    - range is too small but GPUBuffer is still large enough
    - range and GPUBuffer are both too small
`
  )
  .unimplemented();

g.test(`vertex_buffer_OOB`)
  .desc(
    `
In this test we test that vertex buffer OOB is catched as validation error in draw call. Specifically,
only vertex step mode buffer OOB in draw and instance step mode buffer OOB in draw and drawIndexed
are CPU-validated. Other cases are handled by robust access.
- Test that:
    - Draw call needs to read {=, >} any bound vertex buffer range, with GPUBuffer that is {large
      enough, exactly the size of bound range}
        - Special cases of bound size = 0
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
`
  )
  .unimplemented();
