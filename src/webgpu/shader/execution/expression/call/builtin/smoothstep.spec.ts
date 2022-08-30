export const description = `
Execution tests for the 'smoothstep' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn smoothstep(low: T , high: T , x: T ) -> T
Returns the smooth Hermite interpolation between 0 and 1.
Component-wise when T is a vector.
For scalar T, the result is t * t * (3.0 - 2.0 * t), where t = clamp((x - low) / (high - low), 0.0, 1.0).
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32 } from '../../../../../util/conversion.js';
import { smoothStepInterval } from '../../../../../util/f32_interval.js';
import { sparseF32Range } from '../../../../../util/math.js';
import { allInputSources, Case, makeTernaryToF32IntervalCase, run } from '../../expression.js';

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
    const makeCase = (x: number, y: number, z: number): Case => {
      return makeTernaryToF32IntervalCase(x, y, z, smoothStepInterval);
    };

    // Using sparseF32Range since this will generate N^3 test cases
    const values = sparseF32Range();
    const cases: Array<Case> = [];
    values.forEach(x => {
      values.forEach(y => {
        values.forEach(z => {
          cases.push(makeCase(x, y, z));
        });
      });
    });

    await run(t, builtin('smoothstep'), [TypeF32, TypeF32, TypeF32], TypeF32, t.params, cases);
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(`f16 tests`)
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .unimplemented();
