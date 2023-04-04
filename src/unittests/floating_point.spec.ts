export const description = `
Floating Point unit tests.
`;

import { makeTestGroup } from '../common/framework/test_group.js';
import { objectEquals } from '../common/util/util.js';
import { kValue } from '../webgpu/util/constants.js';
import { FP, IntervalBounds } from '../webgpu/util/floating_point.js';
import { hexToF32, hexToF64 } from '../webgpu/util/math.js';

import { UnitTest } from './unit_test.js';

export const g = makeTestGroup(UnitTest);

/** Bounds indicating an expectation of an interval of all possible values */
const kAnyBounds: IntervalBounds = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];

interface ScalarToIntervalCase {
  input: number;
  expected: number | IntervalBounds;
}

g.test('absInterval')
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
