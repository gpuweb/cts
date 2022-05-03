/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'log2' builtin function
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { absThreshold, ulpThreshold } from '../../../../../util/compare.js';
import { kValue } from '../../../../../util/constants.js';
import { f32, TypeF32 } from '../../../../../util/conversion.js';
import { biasedRange, linearRange, quantizeToF32 } from '../../../../../util/math.js';
import { run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn log2(e: T ) -> T
Returns the base-2 logarithm of e. Component-wise when T is a vector.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4]).
combine('range', ['low', 'mid', 'high'])).

unimplemented();

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn log2(e: T ) -> T
Returns the base-2 logarithm of e. Component-wise when T is a vector.

TODO(#792): Decide what the ground-truth is for these tests. [1]
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4]).
combine('range', ['low', 'mid', 'high'])).

fn(async (t) => {
  // [1]: Need to decide what the ground-truth is.
  const makeCase = (x) => {
    const f32_x = quantizeToF32(x);
    return { input: f32(x), expected: f32(Math.log2(f32_x)) };
  };

  const runRange = (match, cases) => {
    const cfg = t.params;
    cfg.cmpFloats = match;
    run(t, builtin('log2'), [TypeF32], TypeF32, cfg, cases);
  };

  // log2's accuracy is defined in three regions { [0, 0.5), [0.5, 2.0], (2.0, +∞] }
  switch (t.params.range) {
    case 'low': // [0, 0.5)
      runRange(
      ulpThreshold(3),
      linearRange(kValue.f32.positive.min, 0.5, 20).map((x) => makeCase(x)));

      break;
    case 'mid': // [0.5, 2.0]
      runRange(
      absThreshold(2 ** -21),
      linearRange(0.5, 2.0, 20).map((x) => makeCase(x)));

      break;
    case 'high': // (2.0, +∞]
      runRange(
      ulpThreshold(3),
      biasedRange(2.0, 2 ** 32, 1000).map((x) => makeCase(x)));

      break;}

});

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn log2(e: T ) -> T
Returns the base-2 logarithm of e. Component-wise when T is a vector.
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4]).
combine('range', ['low', 'mid', 'high'])).

unimplemented();
//# sourceMappingURL=log2.spec.js.map