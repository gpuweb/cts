export const description = `WGSL execution test. Section: Value-testing built-in functions Function: isInf`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { TypeBool, TypeF32, bool, f32, f32Bits } from '../../../util/conversion.js';
import { subnormalF32Examples, normalF32Examples } from '../../values.js';

import { anyOf, run, kBit } from './builtin.js';

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
  .params(
    u =>
      u
        .combine('storageClass', ['storage_r'] as const)
        .combine('vectorize', [undefined, 2] as const)
    //.combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const make = (the_input: number, expected: boolean) => {
      return {
        input: f32(the_input),
        expected: bool(expected),
      };
    };
    const anyBool = anyOf(bool(false), bool(true));
    const cases = [
      // Non-infinity
      make(0.0, false),
      make(10.0, false),
      make(-10.0, false),
      // Infinities
      // "Implementations may assume that NaNs, infinities are not
      // present."
      { input: f32(Infinity), expected: anyBool },
      { input: f32(-Infinity), expected: anyBool },
      { input: f32Bits(kBit.f32.infinity.positive), expected: anyBool },
      { input: f32Bits(kBit.f32.infinity.negative), expected: anyBool },
      // NaNs
      make(NaN, false),
      make(-NaN, false),
      { input: f32Bits(kBit.f32.nan.positive.s), expected: bool(false) },
      { input: f32Bits(kBit.f32.nan.positive.q), expected: bool(false) },
      { input: f32Bits(kBit.f32.nan.negative.s), expected: bool(false) },
      { input: f32Bits(kBit.f32.nan.negative.q), expected: bool(false) },
    ]
      // Normal values are not infinite.
      .concat(normalF32Examples().map(n => make(n, false)))
      // Subnormal values are not infinite.
      .concat(subnormalF32Examples().map(n => make(n, false)));

    run(t, 'isInf', [TypeF32], TypeBool, t.params, cases);
  });
