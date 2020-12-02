export const description = `
Does **not** test usage scopes (resource_usages/) or programmable pass stuff (programmable_pass).

TODO: check for duplication (render_pass.spec.ts, etc.), plan, and implement. Notes:
> All x= {render pass, render bundle}
>
> - setPipeline
>     - {valid, invalid} GPURenderPipeline
> - setIndexBuffer
>     - buffer is {valid, invalid, destroyed, doesn't have usage)
>     - (offset, size) is
>         - (0, 0)
>         - (0, 1)
>         - (0, 4)
>         - (0, 5)
>         - (0, b.size)
>         - (min alignment, b.size - 4)
>         - (4, b.size - 4)
>         - (b.size - 4, 4)
>         - (b.size, min size)
>         - (0, min size), and if that's valid:
>             - (b.size - min size, min size)
> - setVertexBuffer
>     - slot is {0, max, max+1}
>     - buffer is {valid, invalid, destroyed, doesn't have usage)
>     - (offset, size) is like above
> - draws (note bind group state is not tested here):
>     - various zero-sized draws
>     - draws with vertexCount not aligned to primitive topology (line-list or triangle-list) (should not error)
>     - index buffer is {unset, set}
>     - vertex buffers are {unset, set} (some that the pipeline uses, some it doesn't)
>       (note: to test this, the shader in the pipeline doesn't have to actually use inputs)
>     - x= {draw, drawIndexed, drawIndirect, drawIndexedIndirect}
> - indirect draws:
>     - indirectBuffer is {valid, invalid, destroyed, doesn't have usage)
>     - indirectOffset is {
>         - 0, 1, 4
>         - b.size - sizeof(args struct)
>         - b.size - sizeof(args struct) + min alignment (1 or 2 or 4)
>         - }
>     - x= {drawIndirect, drawIndexedIndirect}
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);
