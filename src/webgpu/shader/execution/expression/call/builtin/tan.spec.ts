export const description = `
Execution tests for the 'tan' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn tan(e: T ) -> T
Returns the tangent of e. Component-wise when T is a vector.
`;

import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32 } from '../../../../../util/conversion.js';
import { tanInterval } from '../../../../../util/f32_interval.js';
import { fullF32Range, linearRange } from '../../../../../util/math.js';
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
    const makeCase = (n: number): Case => {
      return makeUnaryF32IntervalCase(n, tanInterval);
    };

    const cases: Array<Case> = [
      // Defined accuracy range
      ...linearRange(-Math.PI, Math.PI, 1000).filter(x => x !== Math.PI / 2 && x !== -Math.PI / 2),
      // Undefined accuracy range
      -Math.PI / 2,
      Math.PI / 2,
      ...fullF32Range(),
    ].map(makeCase);
    run(t, builtin('tan'), [TypeF32], TypeF32, t.params, cases);
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
