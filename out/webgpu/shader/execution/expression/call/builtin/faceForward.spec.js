/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'faceForward' builtin function
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn faceForward(e1: T ,e2: T ,e3: T ) -> T
Returns e1 if dot(e2,e3) is negative, and -e1 otherwise.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [2, 3, 4])).

unimplemented();

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn faceForward(e1: T ,e2: T ,e3: T ) -> T
Returns e1 if dot(e2,e3) is negative, and -e1 otherwise.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [2, 3, 4])).

unimplemented();

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn faceForward(e1: T ,e2: T ,e3: T ) -> T
Returns e1 if dot(e2,e3) is negative, and -e1 otherwise.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [2, 3, 4])).

unimplemented();
//# sourceMappingURL=faceForward.spec.js.map