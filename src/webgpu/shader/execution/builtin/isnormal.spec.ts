export const description = `WGSL execution test. Section: Value-testing built-in functions. Function: isNormal`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { TypeBool, TypeF32, f32, f32Bits, False, True } from '../../../util/conversion.js';
import { subnormalF32Examples, normalF32Examples, nanF32BitsExamples } from '../../values.js';

import { kBit, run } from './builtin.js';

export const g = makeTestGroup(GPUTest);

g.test('value_testing_builtin_functions,isNormal')
  .uniqueId('ea51009a88a27a15')
  .specURL('https://www.w3.org/TR/2021/WD-WGSL-20210929/#value-testing-builtin-functions')
  .desc(
    `
isNormal:
isNormal(e: I ) -> T Test a normal value according to IEEE-754. Component-wise when I is a vector.

Please read the following guidelines before contributing:
https://github.com/gpuweb/cts/blob/main/docs/plan_autogen.md
`
    // From IEEE 754-2008:
    // 2.1.38 normal number: For a particular format, a finite non-zero
    // floating-point number with magnitude greater than or equal to a
    // minimum b**emin value, where b is the radix. Normal numbers can use
    // the full precision available in a format. In this standard, zero is
    // neither normal nor subnormal.
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = [
      // Zero is not normal.
      { input: f32(0.0), expected: False },
      { input: f32(-0.0), expected: False },
      { input: f32Bits(kBit.f32.positive.zero), expected: False },
      { input: f32Bits(kBit.f32.negative.zero), expected: False },
      // Simple non-zero finite numbers.
      { input: f32(10.0), expected: True },
      { input: f32(-10.0), expected: True },
      // Infinities are not normal
      { input: f32Bits(kBit.f32.infinity.positive), expected: False },
      { input: f32Bits(kBit.f32.infinity.negative), expected: False },
      // NaNs are not normal
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
      // Normals are normal
      .concat(
        normalF32Examples().map(n => {
          return { input: f32(n), expected: True };
        })
      )
      // Subnormals are not normal
      .concat(
        subnormalF32Examples().map(n => {
          return { input: f32(n), expected: False };
        })
      );

    run(t, 'isNormal', [TypeF32], TypeBool, t.params, cases);
  });
