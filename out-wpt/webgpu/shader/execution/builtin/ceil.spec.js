/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
Execution Tests for the 'ceil' builtin function
`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { F32, F32Bits, TypeF32 } from '../../../util/conversion.js';

import { anyOf, kBit, kValue, run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('float_builtin_functions,ceil')
  .uniqueId('38d65728ea728bc5')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#float-builtin-functions')
  .desc(
    `
ceil:
T is f32 or vecN<f32> ceil(e: T ) -> T Returns the ceiling of e. Component-wise when T is a vector. (GLSLstd450Ceil)

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
    run(t, 'ceil', [TypeF32], TypeF32, t.params, [
      // Small positive numbers
      { input: F32(0.1), expected: F32(1.0) },
      { input: F32(0.9), expected: F32(1.0) },
      { input: F32(1.1), expected: F32(2.0) },
      { input: F32(1.9), expected: F32(2.0) },

      // Small negative numbers
      { input: F32(-0.1), expected: F32(0.0) },
      { input: F32(-0.9), expected: F32(0.0) },
      { input: F32(-1.1), expected: F32(-1.0) },
      { input: F32(-1.9), expected: F32(-1.0) },

      // Min and Max f32
      { input: F32Bits(kBit.f32.negative.max), expected: F32(0.0) },
      { input: F32Bits(kBit.f32.negative.min), expected: F32Bits(kBit.f32.negative.min) },
      { input: F32Bits(kBit.f32.positive.min), expected: F32(1.0) },
      { input: F32Bits(kBit.f32.positive.max), expected: F32Bits(kBit.f32.positive.max) },

      // Subnormal f32
      { input: F32Bits(kBit.f32.subnormal.positive.max), expected: anyOf(F32(1.0), F32(0.0)) },
      { input: F32Bits(kBit.f32.subnormal.positive.min), expected: anyOf(F32(1.0), F32(0.0)) },

      // Infinity f32
      { input: F32Bits(kBit.f32.infinity.negative), expected: F32Bits(kBit.f32.infinity.negative) },
      { input: F32Bits(kBit.f32.infinity.positive), expected: F32Bits(kBit.f32.infinity.positive) },

      // Powers of +2.0: 2.0^i: 1 <= i <= 31
      { input: F32(kValue.powTwo.to1), expected: F32(kValue.powTwo.to1) },
      { input: F32(kValue.powTwo.to2), expected: F32(kValue.powTwo.to2) },
      { input: F32(kValue.powTwo.to3), expected: F32(kValue.powTwo.to3) },
      { input: F32(kValue.powTwo.to4), expected: F32(kValue.powTwo.to4) },
      { input: F32(kValue.powTwo.to5), expected: F32(kValue.powTwo.to5) },
      { input: F32(kValue.powTwo.to6), expected: F32(kValue.powTwo.to6) },
      { input: F32(kValue.powTwo.to7), expected: F32(kValue.powTwo.to7) },
      { input: F32(kValue.powTwo.to8), expected: F32(kValue.powTwo.to8) },
      { input: F32(kValue.powTwo.to9), expected: F32(kValue.powTwo.to9) },
      { input: F32(kValue.powTwo.to10), expected: F32(kValue.powTwo.to10) },
      { input: F32(kValue.powTwo.to11), expected: F32(kValue.powTwo.to11) },
      { input: F32(kValue.powTwo.to12), expected: F32(kValue.powTwo.to12) },
      { input: F32(kValue.powTwo.to13), expected: F32(kValue.powTwo.to13) },
      { input: F32(kValue.powTwo.to14), expected: F32(kValue.powTwo.to14) },
      { input: F32(kValue.powTwo.to15), expected: F32(kValue.powTwo.to15) },
      { input: F32(kValue.powTwo.to16), expected: F32(kValue.powTwo.to16) },
      { input: F32(kValue.powTwo.to17), expected: F32(kValue.powTwo.to17) },
      { input: F32(kValue.powTwo.to18), expected: F32(kValue.powTwo.to18) },
      { input: F32(kValue.powTwo.to19), expected: F32(kValue.powTwo.to19) },
      { input: F32(kValue.powTwo.to20), expected: F32(kValue.powTwo.to20) },
      { input: F32(kValue.powTwo.to21), expected: F32(kValue.powTwo.to21) },
      { input: F32(kValue.powTwo.to22), expected: F32(kValue.powTwo.to22) },
      { input: F32(kValue.powTwo.to23), expected: F32(kValue.powTwo.to23) },
      { input: F32(kValue.powTwo.to24), expected: F32(kValue.powTwo.to24) },
      { input: F32(kValue.powTwo.to25), expected: F32(kValue.powTwo.to25) },
      { input: F32(kValue.powTwo.to26), expected: F32(kValue.powTwo.to26) },
      { input: F32(kValue.powTwo.to27), expected: F32(kValue.powTwo.to27) },
      { input: F32(kValue.powTwo.to28), expected: F32(kValue.powTwo.to28) },
      { input: F32(kValue.powTwo.to29), expected: F32(kValue.powTwo.to29) },
      { input: F32(kValue.powTwo.to30), expected: F32(kValue.powTwo.to30) },
      { input: F32(kValue.powTwo.to31), expected: F32(kValue.powTwo.to31) },

      // Powers of -2.0: -2.0^i: 1 <= i <= 31
      { input: F32(kValue.negPowTwo.to1), expected: F32(kValue.negPowTwo.to1) },
      { input: F32(kValue.negPowTwo.to2), expected: F32(kValue.negPowTwo.to2) },
      { input: F32(kValue.negPowTwo.to3), expected: F32(kValue.negPowTwo.to3) },
      { input: F32(kValue.negPowTwo.to4), expected: F32(kValue.negPowTwo.to4) },
      { input: F32(kValue.negPowTwo.to5), expected: F32(kValue.negPowTwo.to5) },
      { input: F32(kValue.negPowTwo.to6), expected: F32(kValue.negPowTwo.to6) },
      { input: F32(kValue.negPowTwo.to7), expected: F32(kValue.negPowTwo.to7) },
      { input: F32(kValue.negPowTwo.to8), expected: F32(kValue.negPowTwo.to8) },
      { input: F32(kValue.negPowTwo.to9), expected: F32(kValue.negPowTwo.to9) },
      { input: F32(kValue.negPowTwo.to10), expected: F32(kValue.negPowTwo.to10) },
      { input: F32(kValue.negPowTwo.to11), expected: F32(kValue.negPowTwo.to11) },
      { input: F32(kValue.negPowTwo.to12), expected: F32(kValue.negPowTwo.to12) },
      { input: F32(kValue.negPowTwo.to13), expected: F32(kValue.negPowTwo.to13) },
      { input: F32(kValue.negPowTwo.to14), expected: F32(kValue.negPowTwo.to14) },
      { input: F32(kValue.negPowTwo.to15), expected: F32(kValue.negPowTwo.to15) },
      { input: F32(kValue.negPowTwo.to16), expected: F32(kValue.negPowTwo.to16) },
      { input: F32(kValue.negPowTwo.to17), expected: F32(kValue.negPowTwo.to17) },
      { input: F32(kValue.negPowTwo.to18), expected: F32(kValue.negPowTwo.to18) },
      { input: F32(kValue.negPowTwo.to19), expected: F32(kValue.negPowTwo.to19) },
      { input: F32(kValue.negPowTwo.to20), expected: F32(kValue.negPowTwo.to20) },
      { input: F32(kValue.negPowTwo.to21), expected: F32(kValue.negPowTwo.to21) },
      { input: F32(kValue.negPowTwo.to22), expected: F32(kValue.negPowTwo.to22) },
      { input: F32(kValue.negPowTwo.to23), expected: F32(kValue.negPowTwo.to23) },
      { input: F32(kValue.negPowTwo.to24), expected: F32(kValue.negPowTwo.to24) },
      { input: F32(kValue.negPowTwo.to25), expected: F32(kValue.negPowTwo.to25) },
      { input: F32(kValue.negPowTwo.to26), expected: F32(kValue.negPowTwo.to26) },
      { input: F32(kValue.negPowTwo.to27), expected: F32(kValue.negPowTwo.to27) },
      { input: F32(kValue.negPowTwo.to28), expected: F32(kValue.negPowTwo.to28) },
      { input: F32(kValue.negPowTwo.to29), expected: F32(kValue.negPowTwo.to29) },
      { input: F32(kValue.negPowTwo.to30), expected: F32(kValue.negPowTwo.to30) },
      { input: F32(kValue.negPowTwo.to31), expected: F32(kValue.negPowTwo.to31) },
    ]);
  });
