export const description = `
Tests for the general aspects of draw/drawIndexed/drawIndirect/drawIndexedIndirect.

TODO:
* basic - Test that basic draw functionality works
     Note: compute a zero_sized private param. If true, check there are no shader invocations.
       zero_sized is true if either the draw_size or the instance_count is zero.
       - primitive_topology= {point-list, line-list, triangle-list}
       - draw_size= {0, 1, non-zero}
       - instance_count= {undefined, 0, 1, non-zero}
       - first={undefined, 0, 1, non-zero} - either the firstVertex or firstIndex
       - first_instance={undefined, 0, non-zero}
  - mode= {draw, drawIndexed, drawIndirect, drawIndexedIndirect}
  - index_format= {uint16, uint32} - only for indexed draws
  - base_vertex= {undefined, 0, non-zero} - only for indexed draws
* unaligned_vertex_count - Test that drawing with a number of vertices that's not a multiple of the vertices a given primitive list topology is not an error. The last primitive is not drawn.
  - primitive_topology= {line-list, triangle-list}
  - mode= {draw, drawIndexed, drawIndirect, drawIndexedIndirect}
* extra_vertex_buffers - Test that drawing after having set vertex buffer slots not used by the current pipeline is not an error.
  - use_count= {0, 1, maxVertexBuffers - 2} - number of vertex buffers to use
  - rest_count= {one, remaining} - use one, or all the remaining vertex buffer slots for unused vertex buffers.
  - mode= {draw, drawIndexed, drawIndirect, drawIndexedIndirect}

Note: api/operation/render_pipeline/primitive_topology.spec.ts has additional primitive topology tests.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);
