export const description = `
Floating Point unit tests.
`;

import { makeTestGroup } from '../common/framework/test_group.js';
import { objectEquals } from '../common/util/util.js';
import { kValue } from '../webgpu/util/constants.js';
import { FP, IntervalBounds } from '../webgpu/util/floating_point.js';
import { hexToF32, hexToF64, oneULPF32 } from '../webgpu/util/math.js';

import { UnitTest } from './unit_test.js';

export const g = makeTestGroup(UnitTest);

/** Bounds indicating an expectation of an interval of all possible values */
const kAnyBounds: IntervalBounds = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

/** @returns a number N * ULP less than the provided number */
function minusNULPF32(x: number, n: number): number {
  return x - n * oneULPF32(x);
}

/** @returns a number one ULP less than the provided number */
function minusOneULPF32(x: number): number {
  return minusNULPF32(x, 1);
}

interface ScalarToIntervalCase {
  input: number;
  expected: number | IntervalBounds;
}

g.test('absInterval_f32')
  .paramsSubcasesOnly<ScalarToIntervalCase>(
    // prettier-ignore
    [
      // Common usages
      { input: 1, expected: 1 },
      { input: -1, expected: 1 },
      { input: 0.1, expected: [hexToF32(0x3dcccccc), hexToF32(0x3dcccccd)] },
      { input: -0.1, expected: [hexToF32(0x3dcccccc), hexToF32(0x3dcccccd)] },

      // Edge cases
      { input: kValue.f32.infinity.positive, expected: kAnyBounds },
      { input: kValue.f32.infinity.negative, expected: kAnyBounds },
      { input: kValue.f32.positive.max, expected: kValue.f32.positive.max },
      { input: kValue.f32.positive.min, expected: kValue.f32.positive.min },
      { input: kValue.f32.negative.min, expected: kValue.f32.positive.max },
      { input: kValue.f32.negative.max, expected: kValue.f32.positive.min },

      // 32-bit subnormals
      { input: kValue.f32.subnormal.positive.max, expected: [0, kValue.f32.subnormal.positive.max] },
      { input: kValue.f32.subnormal.positive.min, expected: [0, kValue.f32.subnormal.positive.min] },
      { input: kValue.f32.subnormal.negative.min, expected: [0, kValue.f32.subnormal.positive.max] },
      { input: kValue.f32.subnormal.negative.max, expected: [0, kValue.f32.subnormal.positive.min] },

      // 64-bit subnormals
      { input: hexToF64(0x0000_0000_0000_0001n), expected: [0, kValue.f32.subnormal.positive.min] },
      { input: hexToF64(0x800f_ffff_ffff_ffffn), expected: [0, kValue.f32.subnormal.positive.min] },

      // Zero
      { input: 0, expected: 0 },
    ]
  )
  .fn(t => {
    const expected = FP.f32.toInterval(t.params.expected);
    const got = FP.f32.absInterval(t.params.input);
    t.expect(
      objectEquals(expected, got),
      `f32.absInterval(${t.params.input}) returned ${got}. Expected ${expected}`
    );
  });

g.test('acosInterval_f32')
  .paramsSubcasesOnly<ScalarToIntervalCase>(
    // prettier-ignore
    [
      // Some of these are hard coded, since the error intervals are difficult
      // to express in a closed human-readable form due to the complexity of
      // their derivation.
      //
      // The acceptance interval @ x = -1 and 1 is kAnyBounds, because
      // sqrt(1 - x*x) = sqrt(0), and sqrt is defined in terms of inverseqrt
      // The acceptance interval @ x = 0 is kAnyBounds, because atan2 is not
      // well-defined/implemented at 0.
      // Near 1, the absolute error should be larger and, away from 1 the atan2
      // inherited error should be larger.
      { input: kValue.f32.infinity.negative, expected: kAnyBounds },
      { input: kValue.f32.negative.min, expected: kAnyBounds },
      { input: -1, expected: kAnyBounds },
      { input: -1/2, expected: [hexToF32(0x4005fa91), hexToF32(0x40061a94)] },  // ~2π/3
      { input: 0, expected: kAnyBounds },
      { input: 1/2, expected: [hexToF32(0x3f85fa8f), hexToF32(0x3f861a94)] },  // ~π/3
      { input: minusOneULPF32(1), expected: [hexToF64(0x3f2f_fdff_6000_0000n), hexToF64(0x3f3b_106f_c933_4fb9n)] },  // ~0.0003
      { input: 1, expected: kAnyBounds },
      { input: kValue.f32.positive.max, expected: kAnyBounds },
      { input: kValue.f32.infinity.positive, expected: kAnyBounds },
    ]
  )
  .fn(t => {
    const expected = FP.f32.toInterval(t.params.expected);
    const got = FP.f32.acosInterval(t.params.input);
    t.expect(
      objectEquals(expected, got),
      `f32.acosInterval(${t.params.input}) returned ${got}. Expected ${expected}`
    );
  });

g.test('acoshAlternativeInterval_f32')
  .paramsSubcasesOnly<ScalarToIntervalCase>(
    // prettier-ignore
    [
      // Some of these are hard coded, since the error intervals are difficult
      // to express in a closed human-readable form due to the inherited nature
      // of the errors.
      { input: kValue.f32.infinity.negative, expected: kAnyBounds },
      { input: kValue.f32.negative.min, expected: kAnyBounds },
      { input: -1, expected: kAnyBounds },
      { input: 0, expected: kAnyBounds },
      { input: 1, expected: kAnyBounds },  // 1/0 occurs in inverseSqrt in this formulation
      { input: 1.1, expected: [hexToF64(0x3fdc_6368_8000_0000n), hexToF64(0x3fdc_636f_2000_0000n)] },  // ~0.443..., differs from the primary in the later digits
      { input: 10, expected: [hexToF64(0x4007_f21e_4000_0000n), hexToF64(0x4007_f21f_6000_0000n)] },  // ~2.993...
      { input: kValue.f32.positive.max, expected: kAnyBounds },
      { input: kValue.f32.infinity.positive, expected: kAnyBounds },
    ]
  )
  .fn(t => {
    const expected = FP.f32.toInterval(t.params.expected);
    const got = FP.f32.acoshAlternativeInterval(t.params.input);
    t.expect(
      objectEquals(expected, got),
      `f32.acoshInterval(${t.params.input}) returned ${got}. Expected ${expected}`
    );
  });

g.test('acoshPrimaryInterval_f32')
  .paramsSubcasesOnly<ScalarToIntervalCase>(
    // prettier-ignore
    [
      // Some of these are hard coded, since the error intervals are difficult
      // to express in a closed human-readable form due to the inherited nature
      // of the errors.
      { input: kValue.f32.infinity.negative, expected: kAnyBounds },
      { input: kValue.f32.negative.min, expected: kAnyBounds },
      { input: -1, expected: kAnyBounds },
      { input: 0, expected: kAnyBounds },
      { input: 1, expected: kAnyBounds },  // 1/0 occurs in inverseSqrt in this formulation
      { input: 1.1, expected: [hexToF64(0x3fdc_6368_2000_0000n), hexToF64(0x3fdc_636f_8000_0000n)] }, // ~0.443..., differs from the alternative in the later digits
      { input: 10, expected: [hexToF64(0x4007_f21e_4000_0000n), hexToF64(0x4007_f21f_6000_0000n)] },  // ~2.993...
      { input: kValue.f32.positive.max, expected: kAnyBounds },
      { input: kValue.f32.infinity.positive, expected: kAnyBounds },
    ]
  )
  .fn(t => {
    const expected = FP.f32.toInterval(t.params.expected);
    const got = FP.f32.acoshPrimaryInterval(t.params.input);
    t.expect(
      objectEquals(expected, got),
      `f32.acoshInterval(${t.params.input}) returned ${got}. Expected ${expected}`
    );
  });

g.test('asinInterval_f32')
  .paramsSubcasesOnly<ScalarToIntervalCase>(
    // prettier-ignore
    [
      // Some of these are hard coded, since the error intervals are difficult
      // to express in a simple human-readable form due to the complexity of their derivation.
      //
      // The acceptance interval @ x = -1 and 1 is kAnyBounds, because
      // sqrt(1 - x*x) = sqrt(0), and sqrt is defined in terms of inversqrt.
      // The acceptance interval @ x = 0 is kAnyBounds, because atan2 is not
      // well-defined/implemented at 0.
      // Near 0, but not subnormal the absolute error should be larger, so will
      // be +/- 6.77e-5, away from 0 the atan2 inherited error should be larger.
      { input: kValue.f32.infinity.negative, expected: kAnyBounds },
      { input: kValue.f32.negative.min, expected: kAnyBounds },
      { input: -1, expected: kAnyBounds },
      { input: -1/2, expected: [hexToF64(0xbfe0_c352_c000_0000n), hexToF64(0xbfe0_bf51_c000_0000n)] },  // ~-π/6
      { input: kValue.f32.negative.max, expected: [-6.77e-5, 6.77e-5] },  // ~0
      { input: 0, expected: kAnyBounds },
      { input: kValue.f32.positive.min, expected: [-6.77e-5, 6.77e-5] },  // ~0
      { input: 1/2, expected: [hexToF64(0x3fe0_bf51_c000_0000n), hexToF64(0x3fe0_c352_c000_0000n)] },  // ~π/6
      { input: 1, expected: kAnyBounds },  // ~π/2
      { input: kValue.f32.positive.max, expected: kAnyBounds },
      { input: kValue.f32.infinity.positive, expected: kAnyBounds },
    ]
  )
  .fn(t => {
    const expected = FP.f32.toInterval(t.params.expected);
    const got = FP.f32.asinInterval(t.params.input);
    t.expect(
      objectEquals(expected, got),
      `f32.asinInterval(${t.params.input}) returned ${got}. Expected ${expected}`
    );
  });
