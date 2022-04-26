export const description = `
Execution tests for the 'exp' builtin function
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn exp(e1: T ) -> T
Returns the natural exponentiation of e1 (e.g. e^e1). Component-wise when T is a vector.
`
  )
  .unimplemented();

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn exp(e1: T ) -> T
Returns the natural exponentiation of e1 (e.g. e^e1). Component-wise when T is a vector.
`
  )
  .unimplemented();

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn exp(e1: T ) -> T
Returns the natural exponentiation of e1 (e.g. e^e1). Component-wise when T is a vector.
`
  )
  .unimplemented();
