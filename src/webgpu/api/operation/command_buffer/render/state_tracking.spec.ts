export const description = `
Ensure state is set correctly. Tries to stress state caching (setting different states multiple
times in different orders). These tests focus on state tracking; there should be more detailed
tests of the behavior of the viewport/scissor/blend/reference states elsewhere.
Equivalent tests for setBindGroup and setPipeline are in programmable/state_tracking.spec.ts.

TODO: plan and implement
- {viewport, scissor rect, blend color, stencil reference, setIndexBuffer, setVertexBuffer}: test rendering result with:
    - state {unset (= default), explicitly set default value, another value}
    - persistence: [set, draw, draw] (fn should differentiate from [set, draw] + [draw])
    - overwriting: [set(1), draw, set(2), draw] (fn should differentiate from [set(1), set(2), draw, draw])
    - overwriting: [set(1), set(2), draw] (fn should differentiate from [set(1), draw] but not [set(2), draw])
- setIndexBuffer: specifically test changing the format, offset, size, without changing the buffer
- setVertexBuffer: specifically test changing the offset, size, without changing the buffer
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);
