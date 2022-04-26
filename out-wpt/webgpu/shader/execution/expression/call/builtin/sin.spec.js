/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Execution tests for the 'sin' builtin function
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { absThreshold } from '../../../../../util/compare.js';
import { f32, TypeF32 } from '../../../../../util/conversion.js';
import { linearRange } from '../../../../../util/math.js';
import { run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('abstract_float')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn sin(e: T ) -> T
Returns the sine of e. Component-wise when T is a vector.
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
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn sin(e: T ) -> T
Returns the sine of e. Component-wise when T is a vector.

TODO(#792): Decide what the ground-truth is for these tests. [1]
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])
      .combine('vectorize', [undefined, 2, 3, 4])
  )
  .fn(async t => {
    // [1]: Need to decide what the ground-truth is.
    const makeCase = x => {
      return { input: f32(x), expected: f32(Math.sin(x)) };
    };

    // Spec defines accuracy on [-π, π]
    const cases = linearRange(-Math.PI, Math.PI, 1000).map(x => makeCase(x));

    const cfg = t.params;
    cfg.cmpFloats = absThreshold(2 ** -11);
    run(t, builtin('sin'), [TypeF32], TypeF32, cfg, cases);
  });

g.test('f16')
  .specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions')
  .desc(
    `
T is AbstractFloat, f32, f16, vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn sin(e: T ) -> T
Returns the sine of e. Component-wise when T is a vector.

TODO(#792): Decide what the ground-truth is for these tests. [1]
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])
      .combine('vectorize', [undefined, 2, 3, 4])
  )
  .unimplemented();
