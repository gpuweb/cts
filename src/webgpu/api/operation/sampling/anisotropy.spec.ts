export const description = `
Tests the behavior of anisotropic filtering.

Note that anisotropic filtering is never guaranteed to occur, but we might be able to test that
no *more* than the provided maxAnisotropy samples are used, by testing how many unique
sample values come out of the sample operation.

TODO:
- Test very large and very small values.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);
