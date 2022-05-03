export const description = `
Execution tests for the 'determinant' builtin function
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#matrix-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, or f16
determinant(e: matCxC<T> ) -> T
Returns the determinant of e.
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('dimension', [2, 3, 4] as const)
  )
  .unimplemented();

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#matrix-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, or f16
determinant(e: matCxC<T> ) -> T
Returns the determinant of e.
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('dimension', [2, 3, 4] as const)
  )
  .unimplemented();

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#matrix-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, or f16
determinant(e: matCxC<T> ) -> T
Returns the determinant of e.
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('dimension', [2, 3, 4] as const)
  )
  .unimplemented();
