import { assert } from '../../common/util/util.js';

import { kValue } from './constants.js';
import { flushSubnormalNumber, nextAfter, oneULP } from './math.js';

/** Represents a closed interval in the f32 range */
export class F32Interval {
  public readonly begin: number;
  public readonly end: number;
  private static _infinite: F32Interval;

  /** Constructor
   * @param begin non-NaN number indicating the lower bound of the interval
   * @param end non-NaN number indicating the upper bound of the interval
   */
  public constructor(begin: number, end: number) {
    assert(begin <= end, `begin (${begin}) must be equal or before end (${end})`);
    assert(!Number.isNaN(begin), `begin must not be NaN`);
    assert(!Number.isNaN(end), `end must not be NaN`);

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

  /** Is a point or interval completely within this interval? */
  public contains(x: number | F32Interval): boolean {
    if (Number.isNaN(x)) {
      // Being the infinite interval indicates that the accuracy is not defined for this test, so the test is just
      // checking that this input doesn't cause the implementation to misbehave, so NaN is acceptable.
      return this.begin === Number.NEGATIVE_INFINITY && this.end === Number.POSITIVE_INFINITY;
    }
    const i = toInterval(x);
    return this.begin <= i.begin && this.end >= i.end;
  }

  /** Create interval with the tightest bounds that includes all provided intervals */
  static span(...intervals: F32Interval[]): F32Interval {
    assert(intervals.length > 0, `span of an empty list of F32Intervals is not allowed`);
    const mins = new Set<number>();
    const maxs = new Set<number>();
    intervals.forEach(i => {
      mins.add(i.begin);
      maxs.add(i.end);
    });
    return new F32Interval(Math.min(...mins), Math.max(...maxs));
  }

  /** String-ify for printing */
  public toString(): string {
    return `[${this.begin}, ${this.end}]`;
  }

  /** Singleton for infinite interval.
   * This interval is used in situations where accuracy is not defined, so any result is valid.
   */
  public static infinite(): F32Interval {
    if (this._infinite === undefined) {
      this._infinite = new F32Interval(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
    }
    return this._infinite;
  }
}

/** Convert a number to an interval or return the provided interval */
function toInterval(n: number | F32Interval): F32Interval {
  if (n instanceof F32Interval) {
    return n;
  }
  n = n as number;
  return new F32Interval(n, n);
}

/** Function that converts a point to an interval of valid results  */
export interface NumberToInterval {
  (x: number): F32Interval;
}

/** Calculate the valid roundings for quantization to f32 */
function roundedF32Values(x: number): number[] {
  assert(!Number.isNaN(x), `correctly rounded not defined for NaN`);
  // Above f32 range
  if (x === Number.POSITIVE_INFINITY || x > kValue.f32.positive.max) {
    return [kValue.f32.positive.max, Number.POSITIVE_INFINITY];
  }

  // Below f32 range
  if (x === Number.NEGATIVE_INFINITY || x < kValue.f32.negative.min) {
    return [Number.NEGATIVE_INFINITY, kValue.f32.negative.min];
  }

  const x_32 = new Float32Array([x])[0];
  const converted: number = x_32;
  if (x === converted) {
    // x is precisely expressible as a f32, so should not be rounded
    return [x];
  }

  if (converted > x) {
    // x_32 rounded towards +inf, so is after x
    const other = nextAfter(x_32, false, false).value as number;
    return [other, converted];
  } else {
    // x_32 rounded towards -inf, so is before x
    const other = nextAfter(x_32, false, false).value as number;
    return [converted, other];
  }
}

/** Convert a point to an interval of valid rounded values, both flushed and not flushed */
function roundAndFlushInterval(n: number, fn: NumberToInterval) {
  assert(!Number.isNaN(n), `flush not defined for NaN`);
  const values = roundedF32Values(n);
  return F32Interval.span(
    ...values.map(x => fn(x)),
    ...values.map(x => fn(flushSubnormalNumber(x)))
  );
}

/** Convert a point to an interval correctly rounded around the point */
export function correctlyRoundedInterval(n: number): F32Interval {
  return roundAndFlushInterval(n, (n: number) => {
    assert(!Number.isNaN(n), `absolute not defined for NaN`);
    return toInterval(n);
  });
}

/** Convert a point to an interval of absolute error around the point */
export function absoluteInterval(n: number, rng: number): F32Interval {
  rng = Math.abs(rng);
  return roundAndFlushInterval(n, (n: number) => {
    assert(!Number.isNaN(n), `absolute not defined for NaN`);
    return new F32Interval(n - rng, n + rng);
  });
}

/** Convert a point to an interval of n ULP around the point */
export function ulpInterval(n: number, numULP: number): F32Interval {
  numULP = Math.abs(numULP);
  const ulp_flush = oneULP(n, true);
  const ulp_noflush = oneULP(n, false);
  const ulp = Math.max(ulp_flush, ulp_noflush);
  return new F32Interval(n - numULP * ulp, n + numULP * ulp);
}

/** Calculate an acceptance interval of x / y */
export function divInterval(x: number | F32Interval, y: number | F32Interval): F32Interval {
  const numULP = 2.5;

  const div = (x: number, y: number): F32Interval => {
    assert(y !== 0, `divInterval impl should never receive y === 0`);
    return F32Interval.span(
      ulpInterval(x / y, numULP),
      ulpInterval(flushSubnormalNumber(x) / y, numULP)
    );
  };

  const X = toInterval(x);
  const Y = toInterval(y);

  {
    const lower_bound = 2 ** -126;
    const upper_bound = 2 ** 126;
    // division accuracy is not defined outside of |denominator| on [2 **-126, 2**126]
    if (
      !new F32Interval(-upper_bound, -lower_bound).contains(Y) &&
      !new F32Interval(lower_bound, upper_bound).contains(Y)
    ) {
      return F32Interval.infinite();
    }
  }

  if (X.begin === X.end && Y.begin === Y.end) {
    return div(X.begin, Y.end);
  }
  return F32Interval.span(
    div(X.begin, Y.begin),
    div(X.begin, Y.end),
    div(X.end, Y.begin),
    div(X.end, Y.end)
  );
}

/** Calculate an acceptance interval of cos(x) */
export function cosInterval(n: number): F32Interval {
  return roundAndFlushInterval(n, (n: number) =>
    n <= Math.PI && n >= -Math.PI ? absoluteInterval(Math.cos(n), 2 ** -11) : F32Interval.infinite()
  );
}

/** Calculate an acceptance interval of sin(x) */
export function sinInterval(n: number): F32Interval {
  return roundAndFlushInterval(n, (n: number) =>
    n <= Math.PI && n >= -Math.PI ? absoluteInterval(Math.sin(n), 2 ** -11) : F32Interval.infinite()
  );
}

/** Calculate an acceptance interval of tan(x) */
export function tanInterval(n: number): F32Interval {
  return roundAndFlushInterval(n, (n: number) => divInterval(sinInterval(n), cosInterval(n)));
}
