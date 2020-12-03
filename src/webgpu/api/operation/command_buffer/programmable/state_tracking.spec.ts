export const description = `
TODO: for each programmable pass encoder (compute pass, render pass, render bundle encoder):
- try to stress state caching (setting different states multiple times in different orders) (bind
  groups, pipeline) and run to make sure the right resources get read.
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);
