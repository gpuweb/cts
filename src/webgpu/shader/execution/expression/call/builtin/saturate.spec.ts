export const description = `
Execution tests for the 'saturate' builtin function

S is AbstractFloat, f32, or f16
T is S or vecN<S>
@const fn saturate(e: T) -> T
Returns clamp(e, 0.0, 1.0). Component-wise when T is a vector.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32 } from '../../../../../util/conversion.js';
import { saturateInterval } from '../../../../../util/f32_interval.js';
import { fullF32Range, linearRange } from '../../../../../util/math.js';
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
  .desc(`f32 tests`)
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const makeCase = (n: number): Case => {
      return makeUnaryF32IntervalCase(n, saturateInterval);
    };

    const cases: Array<Case> = [
      // Non-clamped values
      ...linearRange(0.0, 1.0, 100),

      ...fullF32Range(),
    ].map(makeCase);
    run(t, builtin('saturate'), [TypeF32], TypeF32, t.params, cases);
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`f16 tests`)
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();
