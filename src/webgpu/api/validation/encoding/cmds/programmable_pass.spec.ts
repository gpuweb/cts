export const description = `
TODO: check for duplication (setBindGroup.spec.ts, etc.), plan, and implement. Notes:
> Does **not** test usage scopes.
> (Note: If there are errors with using certain binding types in certain passes, test those in the file for that pass type, not here.)
>
> All x= {compute pass, render pass, render bundle}
>
> - setBindGroup
>     - x= {compute pass, render pass}
>     - index {0, max, max+1}
>     - GPUBindGroup object {valid, invalid, valid but refers to destroyed {buffer, texture}}
>     - bind group {with, without} dynamic offsets with {too few, too many} dynamicOffsets entries
>         - x= {sequence, Uint32Array} overload
>     - {none, compatible, incompatible} current pipeline (should have no effect without draw/dispatch)
>     - iff minBufferBindingSize is specified, buffer size is correctly validated against it (make sure static offset + dynamic offset are both accounted for)
>
> - bind group state
>     - x= {dispatch, all draws} (dispatch/draw should be size 0 to make sure validation still happens if no-op)
>     - x= all relevant stages
>     - test that bind groups required by the pipeline layout are required
>       (they don't have to be used in the shader, and shouldn't be, both to
>       support incomplete WGSL impls and to verify only the layout matters)
>         - and that they are "group-equivalent" (value-equal, not just "compatible")
>     - in the test fn, test once without the dispatch/draw (should always be valid) and once with the dispatch/draw, to make sure the validation happens in dispatch/draw.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { ValidationTest } from '../../validation_test.js';

export const g = makeTestGroup(ValidationTest);
