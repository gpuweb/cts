export const description = `
Execution Tests for the 'atan2' builtin function
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { assert } from '../../../../common/util/util.js';
import { GPUTest } from '../../../gpu_test.js';
import { f32, f32Bits, TypeF32, u32 } from '../../../util/conversion.js';
import { biasedRange, linearRange } from '../../../util/math.js';

import { Case, Config, kBit, run, ulpThreshold } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('float_builtin_functions,atan2')
  .uniqueId('cc85953f226ac95c')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
atan2:
T is f32 or vecN<f32> atan2(e1: T ,e2: T ) -> T Returns the arc tangent of e1 over e2. Component-wise when T is a vector. (GLSLstd450Atan2)

TODO(#792): Decide what the ground-truth is for these tests. [1]
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    // [1]: Need to decide what the ground-truth is.
    const truthFunc = (y: number, x: number): Case => {
      assert(x !== 0, 'atan2 is undefined for x = 0');
      return { input: [f32(y), f32(x)], expected: f32(Math.atan2(y, x)) };
    };

    let numeric_range: Array<number> = [];
    // //  -2^32 < x <= -1, biased towards -1
    numeric_range = numeric_range.concat(biasedRange(-1, -(2 ** 32), 50));
    // -1 <= x < 0, linearly spread
    numeric_range = numeric_range.concat(
      linearRange(-1, f32Bits(kBit.f32.negative.max).value as number, 20)
    );
    // 0 < x < -1, linearly spread
    numeric_range = numeric_range.concat(
      linearRange(f32Bits(kBit.f32.positive.min).value as number, 1, 20)
    );
    // // 1 <= x < 2^32, biased towards 1
    numeric_range = numeric_range.concat(biasedRange(1, 2 ** 32, 50));

    let cases: Array<Case> = [];
    cases = cases.concat(numeric_range.map(x => truthFunc(0, x)));
    numeric_range.forEach((y, y_idx) => {
      numeric_range.forEach((x, x_idx) => {
        if (x_idx >= y_idx) {
          cases = cases.concat(truthFunc(y, x));
        }
      });
    });
    const cfg: Config = t.params;
    cfg.cmpFloats = ulpThreshold(4096);
    run(t, 'atan2', [TypeF32, TypeF32], TypeF32, cfg, cases);
  });
