export const description = `
TODO:
- Copy GPUBuffer to another thread while {pending, mapped mappedAtCreation} on {same,diff} thread
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);
