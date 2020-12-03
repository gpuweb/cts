export const description = `
Ensure state is set correctly. Tries to stress state caching (setting different states multiple
times in different orders) for setBindGroup and setPipeline

TODO: for each programmable pass encoder {compute pass, render pass, render bundle encoder}
- try setting states multiple times in different orders, check state is correct in draw/dispatch.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);
