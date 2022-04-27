/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'acosh' builtin function
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn acosh(e: T ) -> T
Returns the hyperbolic arc cosine of e. The result is 0 when e < 1.
Computes the non-negative functional inverse of cosh.
Component-wise when T is a vector.
Note: The result is not mathematically meaningful when e < 1.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

unimplemented();

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn acosh(e: T ) -> T
Returns the hyperbolic arc cosine of e. The result is 0 when e < 1.
Computes the non-negative functional inverse of cosh.
Component-wise when T is a vector.
Note: The result is not mathematically meaningful when e < 1.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

unimplemented();

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn acosh(e: T ) -> T
Returns the hyperbolic arc cosine of e. The result is 0 when e < 1.
Computes the non-negative functional inverse of cosh.
Component-wise when T is a vector.
Note: The result is not mathematically meaningful when e < 1.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

unimplemented();
//# sourceMappingURL=acosh.spec.js.map