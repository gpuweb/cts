/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'frexp' builtin function
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('scalar_f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is f32

@const fn frexp(e:T) -> __frexp_result

Splits e into a significand and exponent of the form significand * 2^exponent.
Returns the __frexp_result built-in structure, defined as follows:

struct __frexp_result {
  sig : f32, // significand part
  exp : i32  // exponent part
}

The magnitude of the significand is in the range of [0.5, 1.0) or 0.
`).

params((u) => u.combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])).
unimplemented();

g.test('scalar_f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is f16

@const fn frexp(e:T) -> __frexp_result_f16

Splits e into a significand and exponent of the form significand * 2^exponent.
Returns the __frexp_result_f16 built-in structure, defined as if as follows:

struct __frexp_result_f16 {
  sig : f16, // significand part
  exp : i32  // exponent part
}

The magnitude of the significand is in the range of [0.5, 1.0) or 0.
`).

params((u) => u.combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])).
unimplemented();

g.test('vector_f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vecN<f32>

@const fn frexp(e:T) -> __frexp_result_vecN

Splits the components of e into a significand and exponent of the form significand * 2^exponent.
Returns the __frexp_result_vecN built-in structure, defined as follows:

struct __frexp_result_vecN {
  sig : vecN<f32>, // significand part
  exp : vecN<i32>  // exponent part
}

The magnitude of each component of the significand is in the range of [0.5, 1.0) or 0.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [2, 3, 4])).

unimplemented();

g.test('vector_f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vecN< f16 >

@const fn frexp(e:T) -> __frexp_result_vecN_f16

Splits the components of e into a significand and exponent of the form significand * 2^exponent.
Returns the __frexp_result_vecN built-in structure, defined as if as follows:

struct __frexp_result_vecN_f16 {
  sig : vecN<f16>, // significand part
  exp : vecN<i32>  // exponent part
}

The magnitude of each component of the significand is in the range of [0.5, 1.0) or 0.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [2, 3, 4])).

unimplemented();
//# sourceMappingURL=frexp.spec.js.map