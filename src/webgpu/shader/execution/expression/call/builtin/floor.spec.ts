export const description = `
Execution tests for the 'floor' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn floor(e: T ) -> T
Returns the floor of e. Component-wise when T is a vector.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32 } from '../../../../../util/conversion.js';
import { floorInterval } from '../../../../../util/f32_interval.js';
import { fullF32Range } from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, Case, makeUnaryToF32IntervalCase, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

export const d = makeCaseCache('floor', {
  f32: () => {
    const makeCase = (x: number): Case => {
      return makeUnaryToF32IntervalCase(x, floorInterval);
    };

    return [
      // Small positive numbers
      0.1,
      0.9,
      1.0,
      1.1,
      1.9,
      // Small negative numbers
      -0.1,
      -0.9,
      -1.0,
      -1.1,
      -1.9,
      ...fullF32Range(),
    ].map(x => makeCase(x));
  },
});

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
    const cases = await d.get('f32');
    await run(t, builtin('floor'), [TypeF32], TypeF32, t.params, cases);
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`f16 tests`)
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();
