/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'fma' builtin function
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn fma(e1: T ,e2: T ,e3: T ) -> T
Returns e1 * e2 + e3. Component-wise when T is a vector.
`).

unimplemented();

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn fma(e1: T ,e2: T ,e3: T ) -> T
Returns e1 * e2 + e3. Component-wise when T is a vector.
`).

unimplemented();

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn fma(e1: T ,e2: T ,e3: T ) -> T
Returns e1 * e2 + e3. Component-wise when T is a vector.
`).

unimplemented();
//# sourceMappingURL=fma.spec.js.map