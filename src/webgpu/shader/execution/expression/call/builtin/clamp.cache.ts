import { kValue } from '../../../../../util/constants.js';
import { ScalarType, TypeAbstractInt, TypeI32, TypeU32 } from '../../../../../util/conversion.js';
import { FP } from '../../../../../util/floating_point.js';
import { maxBigInt, minBigInt } from '../../../../../util/math.js';
import { Case } from '../../case.js';
import { makeCaseCache } from '../../case_cache.js';

const u32Values = [0, 1, 2, 3, 0x70000000, 0x80000000, kValue.u32.max];

const i32Values = [
  kValue.i32.negative.min,
  -3,
  -2,
  -1,
  0,
  1,
  2,
  3,
  0x70000000,
  kValue.i32.positive.max,
];

const abstractFloatValues = [
  kValue.i64.negative.min,
  -3n,
  -2n,
  -1n,
  0n,
  1n,
  2n,
  3n,
  0x70000000n,
  kValue.i64.positive.max,
];

/** @returns a set of clamp test cases from an ascending list of concrete integer values */
function generateConcreteIntegerTestCases(
  test_values: Array<number>,
  type: ScalarType,
  stage: 'const' | 'non_const'
): Array<Case> {
  return test_values.flatMap(low =>
    test_values.flatMap(high =>
      stage === 'const' && low > high
        ? []
        : test_values.map(e => ({
            input: [type.create(e), type.create(low), type.create(high)],
            expected: type.create(Math.min(Math.max(e, low), high)),
          }))
    )
  );
}

/** @returns a set of clamp test cases from an ascending list of abstract integer values */
function generateAbstractIntegerTestCases(test_values: Array<bigint>): Array<Case> {
  return test_values.flatMap(low =>
    test_values.flatMap(high =>
      low > high
        ? []
        : test_values.map(e => ({
            input: [
              TypeAbstractInt.create(e),
              TypeAbstractInt.create(low),
              TypeAbstractInt.create(high),
            ],
            expected: TypeAbstractInt.create(minBigInt(maxBigInt(e, low), high)),
          }))
    )
  );
}

function generateFloatTestCases(
  test_values: readonly number[],
  trait: 'f32' | 'f16' | 'abstract',
  stage: 'const' | 'non_const'
): Array<Case> {
  return test_values.flatMap(low =>
    test_values.flatMap(high =>
      stage === 'const' && low > high
        ? []
        : test_values.flatMap(e => {
            const c = FP[trait].makeScalarTripleToIntervalCase(
              e,
              low,
              high,
              stage === 'const' ? 'finite' : 'unfiltered',
              ...FP[trait].clampIntervals
            );
            return c === undefined ? [] : [c];
          })
    )
  );
}

// Cases: [f32|f16|abstract]_[non_]const
// abstract_non_const is empty and unused
const fp_cases = (['f32', 'f16', 'abstract'] as const)
  .flatMap(trait =>
    ([true, false] as const).map(nonConst => ({
      [`${trait}_${nonConst ? 'non_const' : 'const'}`]: () => {
        if (trait === 'abstract' && nonConst) {
          return [];
        }
        return generateFloatTestCases(
          FP[trait].sparseScalarRange(),
          trait,
          nonConst ? 'non_const' : 'const'
        );
      },
    }))
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('clamp', {
  u32_non_const: () => {
    return generateConcreteIntegerTestCases(u32Values, TypeU32, 'non_const');
  },
  u32_const: () => {
    return generateConcreteIntegerTestCases(u32Values, TypeU32, 'const');
  },
  i32_non_const: () => {
    return generateConcreteIntegerTestCases(i32Values, TypeI32, 'non_const');
  },
  i32_const: () => {
    return generateConcreteIntegerTestCases(i32Values, TypeI32, 'const');
  },
  abstract_int: () => {
    return generateAbstractIntegerTestCases(abstractFloatValues);
  },
  ...fp_cases,
});
