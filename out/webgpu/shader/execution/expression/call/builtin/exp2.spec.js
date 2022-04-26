/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'exp2' builtin function
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn exp2(e: T ) -> T
Returns 2 raised to the power e (e.g. 2^e). Component-wise when T is a vector.
`).

unimplemented();

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn exp2(e: T ) -> T
Returns 2 raised to the power e (e.g. 2^e). Component-wise when T is a vector.
`).

unimplemented();

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn exp2(e: T ) -> T
Returns 2 raised to the power e (e.g. 2^e). Component-wise when T is a vector.
`).

unimplemented();
//# sourceMappingURL=exp2.spec.js.map