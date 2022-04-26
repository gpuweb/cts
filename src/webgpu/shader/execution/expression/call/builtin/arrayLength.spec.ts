export const description = `
Execution tests for the 'arrayLength' builtin function
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('array')
  .specURL('https://www.w3.org/TR/WGSL/#array-builtin-functions')
  .desc(
    `
fn arrayLength(e: ptr<storage,array<T>> ) -> u32
Returns the number of elements in the runtime-sized array.
`
  )
  .unimplemented();
