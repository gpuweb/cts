import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const description = `
Test uninitialized buffers are initialized to zero when read.

TODO
`;

export const g = makeTestGroup(GPUTest);
