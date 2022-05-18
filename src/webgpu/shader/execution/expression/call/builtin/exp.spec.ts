export const description = `
Execution tests for the 'exp' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn exp(e1: T ) -> T
Returns the natural exponentiation of e1 (e.g. e^e1). Component-wise when T is a vector.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { kValue } from '../../../../../util/constants.js';
import { TypeF32 } from '../../../../../util/conversion.js';
import { expInterval } from '../../../../../util/f32_interval.js';
import { biasedRange } from '../../../../../util/math.js';
import { Case, makeUnaryF32IntervalCase, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`abstract float tests`)
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`f32 tests`)
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const makeCase = (x: number): Case => {
      return makeUnaryF32IntervalCase(x, expInterval);
    };

    // floor(ln(max f32 value)) = 88, so exp(88) will be within range of a f32, but exp(89) will not
    const cases: Array<Case> = [
      0, // Returns 1 by definition
      -89, // Returns subnormal value
      kValue.f32.negative.min, // Closest to returning 0 as possible
      89, // Overflows
      ...biasedRange(kValue.f32.negative.max, -88, 100),
      ...biasedRange(kValue.f32.positive.min, 88, 100),
    ].map(x => makeCase(x));

    run(t, builtin('exp'), [TypeF32], TypeF32, t.params, cases);
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`f16 tests`)
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();
