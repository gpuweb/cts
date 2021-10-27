export const description = `WGSL execution test. Section: Value-testing built-in functions. Function: isFinite`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { TypeBool, TypeF32, f32, f32Bits, False, True } from '../../../util/conversion.js';
import { subnormalF32Examples, normalF32Examples, nanF32BitsExamples } from '../../values.js';

import { kBit, run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('value_testing_builtin_functions,isFinite')
  .uniqueId('bf8ee3764330ceb4')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
isFinite:
isFinite(e: I ) -> T Test a finite value according to IEEE-754. Component-wise when I is a vector.

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = [
      // Simple finite numbers.
      { input: f32(0.0), expected: True },
      { input: f32(10.0), expected: True },
      { input: f32(-10.0), expected: True },
      // Infinities
      { input: f32Bits(kBit.f32.infinity.positive), expected: False },
      { input: f32Bits(kBit.f32.infinity.negative), expected: False },
      // NaNs
      { input: f32Bits(kBit.f32.nan.positive.s), expected: False },
      { input: f32Bits(kBit.f32.nan.positive.q), expected: False },
      { input: f32Bits(kBit.f32.nan.negative.s), expected: False },
      { input: f32Bits(kBit.f32.nan.negative.q), expected: False },
    ]
      // Try exotic NaN patterns.
      .concat(
        nanF32BitsExamples().map(n => {
          return { input: f32Bits(n), expected: False };
        })
      )
      // Normals are finite
      .concat(
        normalF32Examples().map(n => {
          return { input: f32(n), expected: True };
        })
      )
      // Subnormals are finite
      .concat(
        subnormalF32Examples().map(n => {
          return { input: f32(n), expected: True };
        })
      );

    run(t, 'isFinite', [TypeF32], TypeBool, t.params, cases);
  });
