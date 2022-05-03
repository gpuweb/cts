/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'dpdyFine' builtin function
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';

export const g = makeTestGroup(GPUTest);

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#derivative-builtin-functions').
desc(
`
T is f32 or vecN<f32>
fn dpdyFine(e:T) ->T
Returns the partial derivative of e with respect to window y coordinates.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

unimplemented();
//# sourceMappingURL=dpdyFine.spec.js.map