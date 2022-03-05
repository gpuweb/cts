/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution Tests for the 'log2' builtin function
`;import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { f32, f32Bits, TypeF32 } from '../../../util/conversion.js';
import { biasedRange, linearRange } from '../../../util/math.js';

import { absThreshold, kBit, kValue, run, ulpThreshold } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('float_builtin_functions,log2').
uniqueId('9ed120de1990296a').
specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions').
desc(
`
log2:
T is f32 or vecN<f32> log2(e: T ) -> T Returns the base-2 logarithm of e. Component-wise when T is a vector. (GLSLstd450Log2)

TODO(#792): Decide what the ground-truth is for these tests. [1]
`).

params((u) =>
u.
combine('storageClass', ['uniform', 'storage_r', 'storage_rw']).
combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  // [1]: Need to decide what the ground-truth is.
  const truthFunc = (x) => {
    const f32_x = f32(x);
    return { input: f32_x, expected: f32(Math.log2(f32_x.value)) };
  };

  // log2's accuracy is defined in three regions { [0, 0.5), [0.5, 2.0], (2.0, +∞] }
  let cases = [];
  cases = cases.concat({ input: f32(0), expected: f32Bits(kBit.f32.infinity.negative) });
  cases = cases.concat(linearRange(kValue.f32.positive.min, 0.5, 20).map((x) => truthFunc(x)));
  cases = cases.concat(linearRange(0.5, 2.0, 20).map((x) => truthFunc(x)));
  cases = cases.concat(biasedRange(2.0, 2 ** 32, 1000).map((x) => truthFunc(x)));

  const cfg = t.params;
  cfg.cmpFloats = (got, expected) => {
    if (expected >= 0.5 && expected <= 2.0) {
      return absThreshold(2 ** -21)(got, expected);
    }
    return ulpThreshold(3)(got, expected);
  };
  run(t, 'log2', [TypeF32], TypeF32, cfg, cases);
});
//# sourceMappingURL=log2.spec.js.map