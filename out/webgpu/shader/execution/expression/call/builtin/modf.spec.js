/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'modf' builtin function
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('scalar_f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is f32
@const fn modf(e:T) -> __modf_result
Splits e into fractional and whole number parts. Returns the __modf_result built-in structure, defined as follows:
struct __modf_result {
  fract : f32, // fractional part
  whole : f32  // whole part
}
`).

params((u) => u.combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])).
unimplemented();

g.test('scalar_f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is f16
@const fn modf(e:T) -> __modf_result_f16
Splits e into fractional and whole number parts. Returns the __modf_result_f16 built-in structure, defined as if as follows:
struct __modf_result_f16 {
  fract : f16, // fractional part
  whole : f16  // whole part
}
`).

params((u) => u.combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])).
unimplemented();

g.test('vector_f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vecN<f32>
@const fn modf(e:T) -> __modf_result_vecN
Splits the components of e into fractional and whole number parts. Returns the __modf_result_vecN built-in structure, defined as follows:
struct __modf_result_vecN {
  fract : vecN<f32>, // fractional part
  whole : vecN<f32>  // whole part
}
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
T is vecN<f16>
@const fn modf(e:T) -> __modf_result_vecN_f16
Splits the components of e into fractional and whole number parts. Returns the __modf_result_vecN_f16 built-in structure, defined as if as follows:
struct __modf_result_vecN_f16 {
  fract : vecN<f16>, // fractional part
  whole : vecN<f16>  // whole part
}
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [2, 3, 4])).

unimplemented();
//# sourceMappingURL=modf.spec.js.map