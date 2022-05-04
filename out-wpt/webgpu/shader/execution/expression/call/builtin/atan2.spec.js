/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Execution tests for the 'atan2' builtin function
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { ulpThreshold } from '../../../../../util/compare.js';
import { TypeF32 } from '../../../../../util/conversion.js';
import { flushSubnormalNumber, fullF32Range } from '../../../../../util/math.js';
import { makeBinaryF32Case, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
atan2:
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn atan2(e1: T ,e2: T ) -> T
Returns the arc tangent of e1 over e2. Component-wise when T is a vector.

TODO(#792): Decide what the ground-truth is for these tests. [1]
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])
      .combine('vectorize', [undefined, 2, 3, 4])
  )
  .unimplemented();

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
atan2:
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn atan2(e1: T ,e2: T ) -> T
Returns the arc tangent of e1 over e2. Component-wise when T is a vector.

TODO(#792): Decide what the ground-truth is for these tests. [1]
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])
      .combine('vectorize', [undefined, 2, 3, 4])
  )
  .fn(async t => {
    const cfg = t.params;
    cfg.cmpFloats = ulpThreshold(4096);

    // [1]: Need to decide what the ground-truth is.
    const makeCase = (y, x) => {
      return makeBinaryF32Case(y, x, Math.atan2, true);
    };

    const numeric_range = fullF32Range({
      neg_norm: 100,
      neg_sub: 10,
      pos_sub: 10,
      pos_norm: 100,
    });

    const cases = [];
    numeric_range.forEach((y, y_idx) => {
      numeric_range.forEach((x, x_idx) => {
        // atan2(y, 0) is not well defined, so skipping those cases
        if (flushSubnormalNumber(x) !== 0) {
          if (x_idx >= y_idx) {
            cases.push(makeCase(y, x));
          }
        }
      });
    });
    run(t, builtin('atan2'), [TypeF32, TypeF32], TypeF32, cfg, cases);
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
atan2:
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn atan2(e1: T ,e2: T ) -> T
Returns the arc tangent of e1 over e2. Component-wise when T is a vector.

TODO(#792): Decide what the ground-truth is for these tests. [1]
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])
      .combine('vectorize', [undefined, 2, 3, 4])
  )
  .unimplemented();
