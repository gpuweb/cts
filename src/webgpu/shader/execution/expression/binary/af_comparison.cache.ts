import { anyOf } from '../../../../util/compare.js';
import { abstractFloat, bool, Scalar } from '../../../../util/conversion.js';
import { flushSubnormalNumberF64, vectorF64Range } from '../../../../util/math.js';
import { Case } from '../case.js';
import { makeCaseCache } from '../case_cache.js';

/**
 * @returns a test case for the provided left hand & right hand values and truth function.
 * Handles quantization and subnormals.
 */
function makeCase(
  lhs: number,
  rhs: number,
  truthFunc: (lhs: Scalar, rhs: Scalar) => boolean
): Case {
  // Subnormal float values may be flushed at any time.
  // https://www.w3.org/TR/WGSL/#floating-point-evaluation
  const af_lhs = abstractFloat(lhs);
  const af_rhs = abstractFloat(rhs);
  const lhs_options = new Set([af_lhs, abstractFloat(flushSubnormalNumberF64(lhs))]);
  const rhs_options = new Set([af_rhs, abstractFloat(flushSubnormalNumberF64(rhs))]);
  const expected: Array<Scalar> = [];
  lhs_options.forEach(l => {
    rhs_options.forEach(r => {
      const result = bool(truthFunc(l, r));
      if (!expected.includes(result)) {
        expected.push(result);
      }
    });
  });

  return { input: [af_lhs, af_rhs], expected: anyOf(...expected) };
}

export const d = makeCaseCache('binary/af_logical', {
  equals: () => {
    const truthFunc = (lhs: Scalar, rhs: Scalar): boolean => {
      return (lhs.value as number) === (rhs.value as number);
    };

    return vectorF64Range(2).map(v => {
      return makeCase(v[0], v[1], truthFunc);
    });
  },
  not_equals: () => {
    const truthFunc = (lhs: Scalar, rhs: Scalar): boolean => {
      return (lhs.value as number) !== (rhs.value as number);
    };

    return vectorF64Range(2).map(v => {
      return makeCase(v[0], v[1], truthFunc);
    });
  },
  less_than: () => {
    const truthFunc = (lhs: Scalar, rhs: Scalar): boolean => {
      return (lhs.value as number) < (rhs.value as number);
    };

    return vectorF64Range(2).map(v => {
      return makeCase(v[0], v[1], truthFunc);
    });
  },
  less_equals: () => {
    const truthFunc = (lhs: Scalar, rhs: Scalar): boolean => {
      return (lhs.value as number) <= (rhs.value as number);
    };

    return vectorF64Range(2).map(v => {
      return makeCase(v[0], v[1], truthFunc);
    });
  },
  greater_than: () => {
    const truthFunc = (lhs: Scalar, rhs: Scalar): boolean => {
      return (lhs.value as number) > (rhs.value as number);
    };

    return vectorF64Range(2).map(v => {
      return makeCase(v[0], v[1], truthFunc);
    });
  },
  greater_equals: () => {
    const truthFunc = (lhs: Scalar, rhs: Scalar): boolean => {
      return (lhs.value as number) >= (rhs.value as number);
    };

    return vectorF64Range(2).map(v => {
      return makeCase(v[0], v[1], truthFunc);
    });
  },
});
