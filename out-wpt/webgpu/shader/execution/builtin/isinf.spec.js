/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `WGSL execution test. Section: Value-testing built-in functions Function: isInf`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { TypeBool, TypeF32, f32, f32Bits, False, True } from '../../../util/conversion.js';
import { subnormalF32Examples, normalF32Examples } from '../../values.js';

import { run, kBit } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('value_testing_builtin_functions,isInf')
  .uniqueId('3591ae3f3daa3871')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
isInf:
isInf(e: I ) -> T Test for infinity according to IEEE-754. Component-wise when I is a vector. (OpIsInf)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'])
      .combine('vectorize', [undefined, 2, 3, 4])
  )
  .fn(async t => {
    const cases = [
      // Non-infinity
      { input: f32(0.0), expected: False },
      { input: f32(10.0), expected: False },
      { input: f32(-10.0), expected: False },
      // Infinities
      { input: f32(Infinity), expected: True },
      { input: f32(-Infinity), expected: True },
      { input: f32Bits(kBit.f32.infinity.positive), expected: True },
      { input: f32Bits(kBit.f32.infinity.negative), expected: True },
      // NaNs
      { input: f32(NaN), expected: False },
      { input: f32(-NaN), expected: False },
      { input: f32Bits(kBit.f32.nan.positive.s), expected: False },
      { input: f32Bits(kBit.f32.nan.positive.q), expected: False },
      { input: f32Bits(kBit.f32.nan.negative.s), expected: False },
      { input: f32Bits(kBit.f32.nan.negative.q), expected: False },
    ]

      // Normal values are not infinite.
      .concat(
        normalF32Examples().map(n => {
          return { input: f32(n), expected: False };
        })
      )

      // Subnormal values are not infinite.
      .concat(
        subnormalF32Examples().map(n => {
          return { input: f32(n), expected: False };
        })
      );

    run(t, 'isInf', [TypeF32], TypeBool, t.params, cases);
  });
