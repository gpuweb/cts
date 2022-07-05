export const description = `
Execution tests for the 'log' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn log(e: T ) -> T
Returns the natural logarithm of e. Component-wise when T is a vector.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { kValue } from '../../../../../util/constants.js';
import { TypeF32 } from '../../../../../util/conversion.js';
import { logInterval } from '../../../../../util/f32_interval.js';
import { biasedRange, fullF32Range, linearRange } from '../../../../../util/math.js';
import { allInputSources, Case, makeUnaryF32IntervalCase, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`abstract float tests`)
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();

g.test('f32')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
f32 tests

TODO(#792): Decide what the ground-truth is for these tests. [1]
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    // [1]: Need to decide what the ground-truth is.
    const makeCase = (x: number): Case => {
      return makeUnaryF32IntervalCase(x, logInterval);
    };

    const cases: Array<Case> = [
      // log's accuracy is defined in three regions { [0, 0.5), [0.5, 2.0], (2.0, +∞] }
      ...linearRange(kValue.f32.positive.min, 0.5, 20),
      ...linearRange(0.5, 2.0, 20),
      ...biasedRange(2.0, 2 ** 32, 1000),
      ...fullF32Range(),
    ].map(x => makeCase(x));

    run(t, builtin('log'), [TypeF32], TypeF32, t.params, cases);
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`f16 tests`)
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();
