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

4) Attribute type (float, vec2, vec3, vec4, mat2, mat3, mat4)
  - The input attribute type in the vertex shader

5) Error scale (1, 4, 10^2, 10^4, 10^6, 10^9)
  - Offset to add to the correct draw call parameter

6) Additional vertex buffers (+2, +4)
  - Tests that no OOB occurs if more vertex buffers are used

The tests will also have another vertex buffer bound for an instanced attribute, to make sure
instanceCount / firstInstance are tested.

The tests will include multiple attributes per vertex buffer.

The test will run a render pipeline which verifies the following:
1) All vertex attribute values are in-bounds or zero (buffers filled with a few random values)
2) All gl_VertexIndex values are within the index buffer or 0`;

import { makeTestGroup } from '../../../common/framework/test_group.js';
import { GPUTest } from '../../gpu_test.js';

export const g = makeTestGroup(GPUTest);
