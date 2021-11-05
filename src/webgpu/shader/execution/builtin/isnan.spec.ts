export const description = `WGSL execution test. Section: Value-testing built-in functions. Function: isNan`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { TypeBool, TypeF32, f32, f32Bits, False, True } from '../../../util/conversion.js';
import { subnormalF32Examples, normalF32Examples, nanF32BitsExamples } from '../../values.js';

import { anyOf, kBit, run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('value_testing_builtin_functions,isNan')
  .uniqueId('fdd1e7105af70b74')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
isNan:
I is f32 or vecN<f32> T is bool if I is a scalar, or vecN<bool> if I is a vector isNan(e: I ) -> T Test for NaN according to IEEE-754. Component-wise when I is a vector. (OpIsNan)

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
  )
  // https://gpuweb.github.io/gpuweb/wgsl/#floating-point-evaluation says:
  //
  //    Implementations may assume that NaNs, inifinities are not present
  //
  //       Note: This means some functions (e.g. isInf, isNan, min and max) may not return
  //       the expected result due to optimizations about the presence of NaNs and infinities.
  //
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = [
      // Simple non-NaN
      { input: f32(0.0), expected: False },
      { input: f32(10.0), expected: False },
      { input: f32(-10.0), expected: False },
      // Infinities
      { input: f32Bits(kBit.f32.infinity.positive), expected: False },
      { input: f32Bits(kBit.f32.infinity.negative), expected: False },
      // NaNs
      { input: f32Bits(kBit.f32.nan.positive.s), expected: anyOf(True, False) },
      { input: f32Bits(kBit.f32.nan.positive.q), expected: anyOf(True, False) },
      { input: f32Bits(kBit.f32.nan.negative.s), expected: anyOf(True, False) },
      { input: f32Bits(kBit.f32.nan.negative.q), expected: anyOf(True, False) },
    ]
      // Try exotic NaN patterns.
      .concat(
        nanF32BitsExamples().map(n => {
          return { input: f32Bits(n), expected: anyOf(True, False) };
        })
      )
      // Normals are not Nan
      .concat(
        normalF32Examples().map(n => {
          return { input: f32(n), expected: False };
        })
      )
      // Subnormals are not Nan
      .concat(
        subnormalF32Examples().map(n => {
          return { input: f32(n), expected: False };
        })
      );

    run(t, 'isNan', [TypeF32], TypeBool, t.params, cases);
  });
