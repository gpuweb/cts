/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { assert } from '../../common/util/util.js';import { kValue } from './constants.js';
import { correctlyRoundedF32, flushSubnormalNumber, isF32Finite, oneULP } from './math.js';

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

/** @returns an interval of the correctly rounded values around the point */
export function correctlyRoundedInterval(n) {
  return roundAndFlushPointToInterval(n, {
    impl: (impl_n) => {
      assert(!Number.isNaN(impl_n), `absolute not defined for NaN`);
      return toInterval(impl_n);
    } });

}

/** @returns an interval of the absolute error around the point */
export function absoluteErrorInterval(n, error_range) {
  return roundAndFlushPointToInterval(n, {
    impl: (impl_n) => {
      assert(!Number.isNaN(n), `absolute not defined for NaN`);
      if (!isF32Finite(n)) {
        return toInterval(n);
      }

      return new F32Interval(impl_n - error_range, impl_n + error_range);
    } });

}

/** @returns an interval of N * ULP around the point */
export function ulpInterval(n, numULP) {
  numULP = Math.abs(numULP);
  return roundAndFlushPointToInterval(n, {
    impl: (impl_n) => {
      if (!isF32Finite(n)) {
        return toInterval(n);
      }

      const ulp = oneULP(impl_n);
      const begin = impl_n - numULP * ulp;
      const end = impl_n + numULP * ulp;

      return new F32Interval(
      Math.min(begin, flushSubnormalNumber(begin)),
      Math.max(end, flushSubnormalNumber(end)));

    } });

}

/** Calculate an acceptance interval for abs(n) */
export function absInterval(n) {
  const op = {
    impl: (impl_n) => {
      return correctlyRoundedInterval(Math.abs(impl_n));
    } };


  return runPointOp(toInterval(n), op);
}

/** Calculate an acceptance interval of atan(x) */
export function atanInterval(n) {
  const op = {
    impl: (impl_n) => {
      return ulpInterval(Math.atan(impl_n), 4096);
    } };


  return runPointOp(toInterval(n), op);
}

/** Calculate an acceptance interval of ceil(x) */
export function ceilInterval(n) {
  const op = {
    impl: (impl_n) => {
      return correctlyRoundedInterval(Math.ceil(impl_n));
    } };


  return runPointOp(toInterval(n), op);
}

/** Calculate an acceptance interval of cos(x) */
export function cosInterval(n) {
  const op = {
    impl: (impl_n) => {
      return kValue.f32.negative.pi.whole <= impl_n && impl_n <= kValue.f32.positive.pi.whole ?
      absoluteErrorInterval(Math.cos(impl_n), 2 ** -11) :
      F32Interval.infinite();
    } };


  return runPointOp(toInterval(n), op);
}
//# sourceMappingURL=f32_interval.js.map