/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { assert } from '../../common/util/util.js';import { kValue } from './constants.js';
import {
correctlyRoundedF32,
flushSubnormalNumber,
isF32Finite,
isSubnormalNumber,
oneULP } from
'./math.js';

/** Represents a closed interval in the f32 range */
export class F32Interval {




  /** Constructor
   *
   * Bounds that are out of range for F32 are converted to appropriate edge or
   * infinity values, so that all values above/below the f32 range are lumped
   * together.
   *
   * @param begin number indicating the lower bound of the interval
   * @param end number indicating the upper bound of the interval
   */
  constructor(begin, end) {
    assert(!Number.isNaN(begin) && !Number.isNaN(end), `bounds need to be non-NaN`);
    assert(begin <= end, `begin (${begin}) must be equal or before end (${end})`);

    if (begin === Number.NEGATIVE_INFINITY || begin < kValue.f32.negative.min) {
      this.begin = Number.NEGATIVE_INFINITY;
    } else if (begin === Number.POSITIVE_INFINITY || begin > kValue.f32.positive.max) {
      this.begin = kValue.f32.positive.max;
    } else {
      this.begin = begin;
    }

    if (end === Number.POSITIVE_INFINITY || end > kValue.f32.positive.max) {
      this.end = Number.POSITIVE_INFINITY;
    } else if (end === Number.NEGATIVE_INFINITY || end < kValue.f32.negative.min) {
      this.end = kValue.f32.negative.min;
    } else {
      this.end = end;
    }
  }

  /** @returns if a point or interval is completely contained by this interval
   *
   * Due to values that are above/below the f32 range being indistinguishable
   * from other values out of range in the same way, there some unintuitive
   * behaviours here, for example:
   *   [0, greater than max f32].contains(+∞) will return true.
   */
  contains(n) {
    if (Number.isNaN(n)) {
      // Being the infinite interval indicates that the accuracy is not defined
      // for this test, so the test is just checking that this input doesn't
      // cause the implementation to misbehave, so NaN is acceptable.
      return this.begin === Number.NEGATIVE_INFINITY && this.end === Number.POSITIVE_INFINITY;
    }
    const i = toInterval(n);
    return this.begin <= i.begin && this.end >= i.end;
  }

  /** @returns if this interval contains a single point */
  isPoint() {
    return this.begin === this.end;
  }

  /** @returns an interval with the tightest bounds that includes all provided intervals */
  static span(...intervals) {
    assert(intervals.length > 0, `span of an empty list of F32Intervals is not allowed`);
    let begin = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;
    intervals.forEach((i) => {
      begin = Math.min(i.begin, begin);
      end = Math.max(i.end, end);
    });
    return new F32Interval(begin, end);
  }

  /** @returns a string representation for logging purposes */
  toString() {
    return `[${this.begin}, ${this.end}]`;
  }

  /** @returns a singleton for the infinite interval
   * This interval is used in situations where accuracy is not defined, so any
   * result is valid.
   */
  static infinite() {
    if (this._infinite === undefined) {
      this._infinite = new F32Interval(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
    }
    return this._infinite;
  }}


/** @returns an interval containing the point or the original interval */
function toInterval(n) {
  if (n instanceof F32Interval) {
    return n;
  }
  return new F32Interval(n, n);
}

/**
 * A function that converts a point to an acceptance interval.
 * This is the public facing API for builtin implementations that is called
 * from tests.
 */









































































/** Converts a point to an acceptance interval, using a specific function
 *
 * This handles correctly rounding and flushing inputs as needed.
 * Duplicate inputs are pruned before invoking op.impl.
 * op.extrema is invoked before this point in the call stack.
 *
 * @param n value to flush & round then invoke op.impl on
 * @param op operation defining the function being run
 * @returns a span over all of the outputs of op.impl
 */
function roundAndFlushPointToInterval(n, op) {
  assert(!Number.isNaN(n), `flush not defined for NaN`);
  const values = correctlyRoundedF32(n);
  const inputs = new Set([...values, ...values.map(flushSubnormalNumber)]);
  const results = new Set([...inputs].map(op.impl));
  return F32Interval.span(...results);
}

/** Converts a pair to an acceptance interval, using a specific function
 *
 * This handles correctly rounding and flushing inputs as needed.
 * Duplicate inputs are pruned before invoking op.impl.
 * All unique combinations of x & y are run.
 * op.extrema is invoked before this point in the call stack.
 *
 * @param x first param to flush & round then invoke op.impl on
 * @param y second param to flush & round then invoke op.impl on
 * @param op operation defining the function being run
 * @returns a span over all of the outputs of op.impl
 */
function roundAndFlushBinaryToInterval(x, y, op) {
  assert(!Number.isNaN(x), `flush not defined for NaN`);
  assert(!Number.isNaN(y), `flush not defined for NaN`);
  const x_values = correctlyRoundedF32(x);
  const y_values = correctlyRoundedF32(y);
  const x_inputs = new Set([...x_values, ...x_values.map(flushSubnormalNumber)]);
  const y_inputs = new Set([...y_values, ...y_values.map(flushSubnormalNumber)]);
  const intervals = new Set();
  x_inputs.forEach((inner_x) => {
    y_inputs.forEach((inner_y) => {
      intervals.add(op.impl(inner_x, inner_y));
    });
  });
  return F32Interval.span(...intervals);
}

/** Converts a triplet to an acceptance interval, using a specific function
 *
 * This handles correctly rounding and flushing inputs as needed.
 * Duplicate inputs are pruned before invoking op.impl.
 * All unique combinations of x, y & z are run.
 * op.extrema is invoked before this point in the call stack.
 *
 * @param x first param to flush & round then invoke op.impl on
 * @param y second param to flush & round then invoke op.impl on
 * @param z third param to flush & round then invoke op.impl on
 * @param op operation defining the function being run
 * @returns a span over all of the outputs of op.impl
 */
function roundAndFlushTernaryToInterval(
x,
y,
z,
op)
{
  assert(!Number.isNaN(x), `flush not defined for NaN`);
  assert(!Number.isNaN(y), `flush not defined for NaN`);
  assert(!Number.isNaN(z), `flush not defined for NaN`);
  const x_values = correctlyRoundedF32(x);
  const y_values = correctlyRoundedF32(y);
  const z_values = correctlyRoundedF32(z);
  const x_inputs = new Set([...x_values, ...x_values.map(flushSubnormalNumber)]);
  const y_inputs = new Set([...y_values, ...y_values.map(flushSubnormalNumber)]);
  const z_inputs = new Set([...z_values, ...z_values.map(flushSubnormalNumber)]);
  const intervals = new Set();

  x_inputs.forEach((inner_x) => {
    y_inputs.forEach((inner_y) => {
      z_inputs.forEach((inner_z) => {
        intervals.add(op.impl(inner_x, inner_y, inner_z));
      });
    });
  });

  return F32Interval.span(...intervals);
}

/** Calculate the acceptance interval for a unary function over an interval
 *
 * If the interval is actually a point, this just decays to
 * roundAndFlushPointToInterval.
 *
 * The provided domain interval may be adjusted if the operation defines an
 * extrema function.
 *
 * @param x input domain interval
 * @param op operation defining the function being run
 * @returns a span over all of the outputs of op.impl
 */
function runPointOp(x, op) {
  if (x.isPoint()) {
    return roundAndFlushPointToInterval(x.begin, op);
  }

  if (op.extrema !== undefined) {
    x = op.extrema(x);
  }
  return F32Interval.span(
  roundAndFlushPointToInterval(x.begin, op),
  roundAndFlushPointToInterval(x.end, op));

}

/** Calculate the acceptance interval for a binary function over an interval
 *
 * The provided domain intervals may be adjusted if the operation defines an
 * extrema function.
 *
 * @param x first input domain interval
 * @param y second input domain interval
 * @param op operation defining the function being run
 * @returns a span over all of the outputs of op.impl
 */
// Will be used in test implementations

function runBinaryOp(x, y, op) {
  if (op.extrema !== undefined) {
    [x, y] = op.extrema(x, y);
  }
  const x_values = new Set([x.begin, x.end]);
  const y_values = new Set([y.begin, y.end]);

  const results = new Set();
  x_values.forEach((inner_x) => {
    y_values.forEach((inner_y) => {
      results.add(roundAndFlushBinaryToInterval(inner_x, inner_y, op));
    });
  });

  return F32Interval.span(...results);
}

/** Calculate the acceptance interval for a ternary function over an interval
 *
 * The provided domain intervals may be adjusted if the operation defines an
 * extrema function.
 *
 * @param x first input domain interval
 * @param y second input domain interval
 * @param z third input domain interval
 * @param op operation defining the function being run
 * @returns a span over all of the outputs of op.impl
 */
// Will be used in test implementations

function runTernaryOp(
x,
y,
z,
op)
{
  const x_values = new Set([x.begin, x.end]);
  const y_values = new Set([y.begin, y.end]);
  const z_values = new Set([z.begin, z.end]);
  const results = new Set();
  x_values.forEach((inner_x) => {
    y_values.forEach((inner_y) => {
      z_values.forEach((inner_z) => {
        results.add(roundAndFlushTernaryToInterval(inner_x, inner_y, inner_z, op));
      });
    });
  });

  return F32Interval.span(...results);
}

const CorrectlyRoundedIntervalOp = {
  impl: (n) => {
    assert(!Number.isNaN(n), `absolute not defined for NaN`);
    return toInterval(n);
  } };


/** @returns an interval of the correctly rounded values around the point */
export function correctlyRoundedInterval(n) {
  return roundAndFlushPointToInterval(n, CorrectlyRoundedIntervalOp);
}

/** @returns a PointToIntervalOp for [n - error_range, n + error_range] */
function AbsoluteErrorIntervalOp(error_range) {
  return {
    impl: (n) => {
      if (!isF32Finite(n)) {
        return toInterval(n);
      }

      assert(!Number.isNaN(n), `absolute not defined for NaN`);
      return new F32Interval(n - error_range, n + error_range);
    } };

}

/** @returns an interval of the absolute error around the point */
export function absoluteErrorInterval(n, error_range) {
  error_range = Math.abs(error_range);
  return roundAndFlushPointToInterval(n, AbsoluteErrorIntervalOp(error_range));
}

/** @returns a PointToIntervalOp for [n - numULP * ULP(n), n + numULP * ULP(n)] */
function ULPIntervalOp(numULP) {
  return {
    impl: (n) => {
      if (!isF32Finite(n)) {
        assert(!Number.isNaN(n), `ULP not defined for NaN`);
        return toInterval(n);
      }

      const ulp = oneULP(n);
      const begin = n - numULP * ulp;
      const end = n + numULP * ulp;

      return new F32Interval(
      Math.min(begin, flushSubnormalNumber(begin)),
      Math.max(end, flushSubnormalNumber(end)));

    } };

}

/** @returns an interval of N * ULP around the point */
export function ulpInterval(n, numULP) {
  numULP = Math.abs(numULP);
  return roundAndFlushPointToInterval(n, ULPIntervalOp(numULP));
}

const AbsIntervalOp = {
  impl: (n) => {
    return correctlyRoundedInterval(Math.abs(n));
  } };


/** Calculate an acceptance interval for abs(n) */
export function absInterval(n) {
  return runPointOp(toInterval(n), AbsIntervalOp);
}

const AdditionInnerOp = {
  impl: (x, y) => {
    if (!isF32Finite(x) && isF32Finite(y)) {
      return correctlyRoundedInterval(x);
    }

    if (isF32Finite(x) && !isF32Finite(y)) {
      return correctlyRoundedInterval(y);
    }

    if (!isF32Finite(x) && !isF32Finite(y)) {
      if (Math.sign(x) === Math.sign(y)) {
        return correctlyRoundedInterval(x);
      } else {
        return F32Interval.infinite();
      }
    }
    return correctlyRoundedInterval(x + y);
  } };


const AdditionIntervalOp = {
  impl: (x, y) => {
    return roundAndFlushBinaryToInterval(x, y, AdditionInnerOp);
  } };


/** Calculate an acceptance interval of x + y */
export function additionInterval(x, y) {
  return runBinaryOp(toInterval(x), toInterval(y), AdditionIntervalOp);
}

const AtanIntervalOp = {
  impl: (n) => {
    return ulpInterval(Math.atan(n), 4096);
  } };


/** Calculate an acceptance interval of atan(x) */
export function atanInterval(n) {
  return runPointOp(toInterval(n), AtanIntervalOp);
}

const Atan2IntervalOp = {
  impl: (y, x) => {
    const numULP = 4096;
    if (y === 0) {
      if (x === 0) {
        return F32Interval.infinite();
      } else {
        return F32Interval.span(
        ulpInterval(kValue.f32.negative.pi.whole, numULP),
        ulpInterval(kValue.f32.positive.pi.whole, numULP));

      }
    }
    return ulpInterval(Math.atan2(y, x), numULP);
  },
  extrema: (y, x) => {
    if (y.contains(0)) {
      if (x.contains(0)) {
        return [toInterval(0), toInterval(0)];
      }
      return [toInterval(0), x];
    }
    return [y, x];
  } };


/** Calculate an acceptance interval of atan2(y, x) */
export function atan2Interval(y, x) {
  return runBinaryOp(toInterval(y), toInterval(x), Atan2IntervalOp);
}

const CeilIntervalOp = {
  impl: (n) => {
    return correctlyRoundedInterval(Math.ceil(n));
  } };


/** Calculate an acceptance interval of ceil(x) */
export function ceilInterval(n) {
  return runPointOp(toInterval(n), CeilIntervalOp);
}

const CosIntervalOp = {
  impl: (n) => {
    return kValue.f32.negative.pi.whole <= n && n <= kValue.f32.positive.pi.whole ?
    absoluteErrorInterval(Math.cos(n), 2 ** -11) :
    F32Interval.infinite();
  } };


/** Calculate an acceptance interval of cos(x) */
export function cosInterval(n) {
  return runPointOp(toInterval(n), CosIntervalOp);
}

const DivisionIntervalOp = {
  impl: (x, y) => {
    assert(
    !isSubnormalNumber(y),
    `divisionInterval impl should never receive y === 0 or flush(y) === 0`);

    return ulpInterval(x / y, 2.5);
  } };


/** Calculate an acceptance interval of x / y */
export function divisionInterval(x, y) {
  {
    const Y = toInterval(y);
    const lower_bound = 2 ** -126;
    const upper_bound = 2 ** 126;
    // division accuracy is not defined outside of |denominator| on [2 ** -126, 2 ** 126]
    if (
    !new F32Interval(-upper_bound, -lower_bound).contains(Y) &&
    !new F32Interval(lower_bound, upper_bound).contains(Y))
    {
      return F32Interval.infinite();
    }
  }

  return runBinaryOp(toInterval(x), toInterval(y), DivisionIntervalOp);
}

const ExpIntervalOp = {
  impl: (x) => {
    return ulpInterval(Math.exp(x), 3 + 2 * Math.abs(x));
  } };


/** Calculate an acceptance interval for exp(x) */
export function expInterval(x) {
  return runPointOp(toInterval(x), ExpIntervalOp);
}

const Exp2IntervalOp = {
  impl: (x) => {
    return ulpInterval(Math.pow(2, x), 3 + 2 * Math.abs(x));
  } };


/** Calculate an acceptance interval for exp2(x) */
export function exp2Interval(x) {
  return runPointOp(toInterval(x), Exp2IntervalOp);
}

const FloorIntervalOp = {
  impl: (n) => {
    return correctlyRoundedInterval(Math.floor(n));
  } };


/** Calculate an acceptance interval of floor(x) */
export function floorInterval(n) {
  return runPointOp(toInterval(n), FloorIntervalOp);
}

const InverseSqrtIntervalOp = {
  impl: (n) => {
    if (n <= 0) {
      // 1 / sqrt(n) for n <= 0 is not meaningfully defined for real f32
      return F32Interval.infinite();
    }
    return ulpInterval(1 / Math.sqrt(n), 2);
  } };


/** Calculate an acceptance interval of inverseSqrt(x) */
export function inverseSqrtInterval(n) {
  return runPointOp(toInterval(n), InverseSqrtIntervalOp);
}

const LogIntervalOp = {
  impl: (x) => {
    if (x >= 0.5 && x <= 2.0) {
      return absoluteErrorInterval(Math.log(x), 2 ** -21);
    }
    return ulpInterval(Math.log(x), 3);
  } };


/** Calculate an acceptance interval of log(x) */
export function logInterval(x) {
  return runPointOp(toInterval(x), LogIntervalOp);
}

const Log2IntervalOp = {
  impl: (x) => {
    if (x >= 0.5 && x <= 2.0) {
      return absoluteErrorInterval(Math.log2(x), 2 ** -21);
    }
    return ulpInterval(Math.log2(x), 3);
  } };


/** Calculate an acceptance interval of log2(x) */
export function log2Interval(x) {
  return runPointOp(toInterval(x), Log2IntervalOp);
}

const MaxIntervalOp = {
  impl: (x, y) => {
    return correctlyRoundedInterval(Math.max(x, y));
  } };


/** Calculate an acceptance interval of max(x, y) */
export function maxInterval(x, y) {
  return runBinaryOp(toInterval(x), toInterval(y), MaxIntervalOp);
}

const MinIntervalOp = {
  impl: (x, y) => {
    return correctlyRoundedInterval(Math.min(x, y));
  } };


/** Calculate an acceptance interval of min(x, y) */
export function minInterval(x, y) {
  return runBinaryOp(toInterval(x), toInterval(y), MinIntervalOp);
}

const MultiplicationInnerOp = {
  impl: (x, y) => {
    if (x === 0 || y === 0) {
      return correctlyRoundedInterval(0);
    }

    const appropriate_infinity =
    Math.sign(x) === Math.sign(y) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    if (!isF32Finite(x) || !isF32Finite(y)) {
      return correctlyRoundedInterval(appropriate_infinity);
    }

    return correctlyRoundedInterval(x * y);
  } };


const MultiplicationIntervalOp = {
  impl: (x, y) => {
    return roundAndFlushBinaryToInterval(x, y, MultiplicationInnerOp);
  } };


/** Calculate an acceptance interval of x * y */
export function multiplicationInterval(
x,
y)
{
  return runBinaryOp(toInterval(x), toInterval(y), MultiplicationIntervalOp);
}

const NegationIntervalOp = {
  impl: (n) => {
    return correctlyRoundedInterval(-n);
  } };


/** Calculate an acceptance interval of -x */
export function negationInterval(n) {
  return runPointOp(toInterval(n), NegationIntervalOp);
}

const SinIntervalOp = {
  impl: (n) => {
    return kValue.f32.negative.pi.whole <= n && n <= kValue.f32.positive.pi.whole ?
    absoluteErrorInterval(Math.sin(n), 2 ** -11) :
    F32Interval.infinite();
  } };


/** Calculate an acceptance interval of sin(x) */
export function sinInterval(n) {
  return runPointOp(toInterval(n), SinIntervalOp);
}

const SubtractionInnerOp = {
  impl: (x, y) => {
    if (!isF32Finite(x) && isF32Finite(y)) {
      return correctlyRoundedInterval(x);
    }

    if (isF32Finite(x) && !isF32Finite(y)) {
      const result = Math.sign(y) > 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
      return correctlyRoundedInterval(result);
    }

    if (!isF32Finite(x) && !isF32Finite(y)) {
      if (Math.sign(x) === -Math.sign(y)) {
        return correctlyRoundedInterval(x);
      } else {
        return F32Interval.infinite();
      }
    }
    return correctlyRoundedInterval(x - y);
  } };


const SubtractionIntervalOp = {
  impl: (x, y) => {
    return roundAndFlushBinaryToInterval(x, y, SubtractionInnerOp);
  } };


/** Calculate an acceptance interval of x - y */
export function subtractionInterval(x, y) {
  return runBinaryOp(toInterval(x), toInterval(y), SubtractionIntervalOp);
}

const TanIntervalOp = {
  impl: (n) => {
    return divisionInterval(sinInterval(n), cosInterval(n));
  } };


/** Calculate an acceptance interval of tan(x) */
export function tanInterval(n) {
  return runPointOp(toInterval(n), TanIntervalOp);
}
//# sourceMappingURL=f32_interval.js.map