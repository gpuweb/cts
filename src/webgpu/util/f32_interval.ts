import { assert } from '../../common/util/util.js';

import { kValue } from './constants.js';
import { flushSubnormalNumber, isSubnormalNumber, nextAfter, oneULP } from './math.js';

/** Represents a closed interval in the f32 range */
export class F32Interval {
  public readonly begin: number;
  public readonly end: number;
  private static _infinite: F32Interval;

  /** Constructor
   * @param begin number indicating the lower bound of the interval
   * @param end number indicating the upper bound of the interval
   */
  public constructor(begin: number, end: number) {
    assert(Number.isNaN(begin) === Number.isNaN(end), `bounds need to be both NaN or non-NaN`);
    if (Number.isNaN(begin)) {
      this.begin = Number.NaN;
      this.end = Number.NaN;
      return;
    }

    assert(begin <= end, `begin (${begin}) must be equal or before end (${end})`);

    if (begin === Number.NEGATIVE_INFINITY || begin <= kValue.f32.negative.min) {
      this.begin = Number.NEGATIVE_INFINITY;
    } else if (begin === Number.POSITIVE_INFINITY || begin >= kValue.f32.positive.max) {
      this.begin = kValue.f32.positive.max;
    } else {
      this.begin = begin;
    }

    if (end === Number.POSITIVE_INFINITY || end >= kValue.f32.positive.max) {
      this.end = Number.POSITIVE_INFINITY;
    } else if (end === Number.NEGATIVE_INFINITY || end <= kValue.f32.negative.min) {
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

  /** Is this interval just a single point? */
  public isPoint(): boolean {
    return this.begin === this.end;
  }

  /** Create interval with the tightest bounds that includes all provided intervals */
  static span(...intervals: F32Interval[]): F32Interval {
    assert(intervals.length > 0, `span of an empty list of F32Intervals is not allowed`);
    let begin = Number.POSITIVE_INFINITY;
    let end = Number.NEGATIVE_INFINITY;
    intervals.forEach(i => {
      begin = Math.min(i.begin, begin);
      end = Math.max(i.end, end);
    });
    return new F32Interval(begin, end);
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

/** Does a number fit into the range of f32 [min, max]? */
function isF32Finite(n: number) {
  return n >= kValue.f32.negative.min && n <= kValue.f32.positive.max;
}

/** Operation that converts a point to an interval of valid results  */
export interface PointToInterval {
  (x: number): F32Interval;
}

/** Operation that converts a pair of points to an interval of valid results  */
export interface BinaryToInterval {
  (x: number, y: number): F32Interval;
}

/** Operation that converts a triplet of points to an interval of valid results  */
export interface TernaryToInterval {
  (x: number, y: number, z: number): F32Interval;
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
    const other = nextAfter(x_32, true, false).value as number;
    return [converted, other];
  }
}

/** Convert a point to an interval of valid rounded values, both flushed and not flushed */
function roundAndFlushPointToInterval(n: number, fn: PointToInterval) {
  assert(!Number.isNaN(n), `flush not defined for NaN`);
  const values = roundedF32Values(n);
  const inputs = new Set<number>([...values, ...values.map(flushSubnormalNumber)]);
  const results = new Set<F32Interval>([...inputs].map(fn));
  return F32Interval.span(...results);
}

/** Convert a pair of points to an interval of valid rounded values, both flushed and not flushed */
function roundAndFlushBinaryToInterval(x: number, y: number, fn: BinaryToInterval): F32Interval {
  assert(!Number.isNaN(x), `flush not defined for NaN`);
  assert(!Number.isNaN(y), `flush not defined for NaN`);
  const x_values = roundedF32Values(x);
  const y_values = roundedF32Values(y);
  const x_inputs = new Set<number>([...x_values, ...x_values.map(flushSubnormalNumber)]);
  const y_inputs = new Set<number>([...y_values, ...y_values.map(flushSubnormalNumber)]);
  const intervals = new Set<F32Interval>();
  x_inputs.forEach(inner_x => {
    y_inputs.forEach(inner_y => {
      intervals.add(fn(inner_x, inner_y));
    });
  });
  return F32Interval.span(...intervals);
}

/** Convert a triplet of points to an interval of valid rounded values, both flushed and not flushed */
function roundAndFlushTernaryToInterval(
  x: number,
  y: number,
  z: number,
  fn: TernaryToInterval
): F32Interval {
  assert(!Number.isNaN(x), `flush not defined for NaN`);
  assert(!Number.isNaN(y), `flush not defined for NaN`);
  assert(!Number.isNaN(z), `flush not defined for NaN`);
  const x_values = roundedF32Values(x);
  const y_values = roundedF32Values(y);
  const z_values = roundedF32Values(z);
  const x_inputs = new Set<number>([...x_values, ...x_values.map(flushSubnormalNumber)]);
  const y_inputs = new Set<number>([...y_values, ...y_values.map(flushSubnormalNumber)]);
  const z_inputs = new Set<number>([...z_values, ...z_values.map(flushSubnormalNumber)]);
  const intervals = new Set<F32Interval>();
  // prettier-ignore
  x_inputs.forEach(inner_x => {
    y_inputs.forEach(inner_y => {
      z_inputs.forEach(inner_z => {
        intervals.add(fn(inner_x, inner_y, inner_z));
      });
    });
  });

  return F32Interval.span(...intervals);
}

/** Convert a point to an interval correctly rounded around the point */
export function correctlyRoundedInterval(n: number): F32Interval {
  return roundAndFlushPointToInterval(n, (n: number) => {
    assert(!Number.isNaN(n), `absolute not defined for NaN`);
    return toInterval(n);
  });
}

/** Convert a point to an interval of absolute error around the point */
export function absoluteErrorInterval(n: number, rng: number): F32Interval {
  rng = Math.abs(rng);
  const impl = (impl_n: number): F32Interval => {
    assert(!Number.isNaN(impl_n), `absolute not defined for NaN`);
    return new F32Interval(impl_n - rng, impl_n + rng);
  };

  return runPointImpl(toInterval(n), impl);
}

/** Convert a point to an interval of n ULP around the point */
export function ulpInterval(n: number, numULP: number): F32Interval {
  numULP = Math.abs(numULP);
  const ulp_flush = oneULP(n, true);
  const ulp_noflush = oneULP(n, false);
  const ulp = Math.max(ulp_flush, ulp_noflush);
  return new F32Interval(n - numULP * ulp, n + numULP * ulp);
}

/** For a point operation run its impl over the input that may be an interval */
function runPointImpl(x: F32Interval, impl: PointToInterval): F32Interval {
  if (x.isPoint()) {
    return roundAndFlushPointToInterval(x.begin, impl);
  }
  return F32Interval.span(
    roundAndFlushPointToInterval(x.begin, impl),
    roundAndFlushPointToInterval(x.end, impl)
  );
}

/** For a binary operation run its impl over the inputs  that may be intervals */
function runBinaryImpl(x: F32Interval, y: F32Interval, impl: BinaryToInterval): F32Interval {
  const x_values = new Set<number>([x.begin, x.end]);
  const y_values = new Set<number>([y.begin, y.end]);
  const results = new Set<F32Interval>();

  x_values.forEach(inner_x => {
    y_values.forEach(inner_y => {
      results.add(roundAndFlushBinaryToInterval(inner_x, inner_y, impl));
    });
  });

  return F32Interval.span(...results);
}

/** For a ternary operation run its impl over the inputs that may be intervals */
function runTernaryImpl(
  x: F32Interval,
  y: F32Interval,
  z: F32Interval,
  impl: TernaryToInterval
): F32Interval {
  const x_values = new Set<number>([x.begin, x.end]);
  const y_values = new Set<number>([y.begin, y.end]);
  const z_values = new Set<number>([z.begin, z.end]);
  const results = new Set<F32Interval>();

  x_values.forEach(inner_x => {
    y_values.forEach(inner_y => {
      z_values.forEach(inner_z => {
        results.add(roundAndFlushTernaryToInterval(inner_x, inner_y, inner_z, impl));
      });
    });
  });

  return F32Interval.span(...results);
}

/** Calculate an acceptance interval of abs(x) */
export function absInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    return correctlyRoundedInterval(Math.abs(impl_n));
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of x + y */
export function addInterval(x: number | F32Interval, y: number | F32Interval): F32Interval {
  const impl = (impl_x: number, impl_y: number): F32Interval => {
    return roundAndFlushBinaryToInterval(
      impl_x,
      impl_y,
      (inner_x: number, inner_y: number): F32Interval => {
        if (!isF32Finite(inner_x) && isF32Finite(inner_y)) {
          return correctlyRoundedInterval(inner_x);
        }

        if (isF32Finite(inner_x) && !isF32Finite(inner_y)) {
          return correctlyRoundedInterval(inner_y);
        }

        if (!isF32Finite(inner_x) && !isF32Finite(inner_y)) {
          if (Math.sign(inner_x) === Math.sign(inner_y)) {
            return correctlyRoundedInterval(inner_x);
          } else {
            return F32Interval.infinite();
          }
        }
        return correctlyRoundedInterval(inner_x + inner_y);
      }
    );
  };

  return runBinaryImpl(toInterval(x), toInterval(y), impl);
}

/** Calculate an acceptance interval of atan(x) */
export function atanInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    return ulpInterval(Math.atan(impl_n), 4096);
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of atan2(y, x) */
export function atan2Interval(y: number | F32Interval, x: number | F32Interval): F32Interval {
  const impl = (impl_y: number, impl_x: number): F32Interval => {
    return ulpInterval(Math.atan2(impl_y, impl_x), 4096);
  };

  return runBinaryImpl(toInterval(y), toInterval(x), impl);
}

/** Calculate an acceptance interval of ceil(x) */
export function ceilInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    return correctlyRoundedInterval(Math.ceil(impl_n));
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of clamp(x, high, low) via min-max or median */
export function clampInterval(
  x: number | F32Interval,
  low: number | F32Interval,
  high: number | F32Interval
): F32Interval {
  const impl = (impl_x: number, impl_low: number, impl_high: number): F32Interval => {
    const minmax_interval = clampMinMaxInterval(impl_x, impl_low, impl_high);
    const median_interval = clampMedianInterval(impl_x, impl_low, impl_high);
    return F32Interval.span(minmax_interval, median_interval);
  };

  return runTernaryImpl(toInterval(x), toInterval(low), toInterval(high), impl);
}

/** Calculate an acceptance interval of clamp(x, high, low) via median(e, low, high) */
function clampMedianInterval(
  x: number | F32Interval,
  y: number | F32Interval,
  z: number | F32Interval
): F32Interval {
  const impl = (impl_x: number, impl_y: number, impl_z: number): F32Interval => {
    return correctlyRoundedInterval([impl_x, impl_y, impl_z].sort()[1]);
  };

  return runTernaryImpl(toInterval(x), toInterval(y), toInterval(z), impl);
}

/** Calculate an acceptance interval of clamp(x, high, low) via min(max(e, low, high) */
function clampMinMaxInterval(
  x: number | F32Interval,
  low: number | F32Interval,
  high: number | F32Interval
): F32Interval {
  const impl = (impl_x: number, impl_low: number, impl_high: number): F32Interval => {
    return minInterval(maxInterval(impl_x, impl_low), impl_high);
  };

  return runTernaryImpl(toInterval(x), toInterval(low), toInterval(high), impl);
}

/** Calculate an acceptance interval of cos(x) */
export function cosInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    return impl_n <= Math.PI && impl_n >= -Math.PI
      ? absoluteErrorInterval(Math.cos(impl_n), 2 ** -11)
      : F32Interval.infinite();
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of x / y */
export function divInterval(x: number | F32Interval, y: number | F32Interval): F32Interval {
  const impl = (impl_x: number, impl_y: number): F32Interval => {
    assert(
      !isSubnormalNumber(impl_y),
      `divInterval impl should never receive y === 0 or flush(y) === 0`
    );
    return ulpInterval(impl_x / impl_y, 2.5);
  };

  {
    const Y = toInterval(y);
    const lower_bound = 2 ** -126;
    const upper_bound = 2 ** 126;
    // division accuracy is not defined outside of |denominator| on [2 ** -126, 2 ** 126]
    if (
      !new F32Interval(-upper_bound, -lower_bound).contains(Y) &&
      !new F32Interval(lower_bound, upper_bound).contains(Y)
    ) {
      return F32Interval.infinite();
    }
  }

  return runBinaryImpl(toInterval(x), toInterval(y), impl);
}

/** Calculate an acceptance interval for exp(x) */
export function expInterval(x: number | F32Interval): F32Interval {
  const impl = (impl_x: number): F32Interval => {
    return ulpInterval(Math.exp(impl_x), 3 + 2 * Math.abs(impl_x));
  };

  return runPointImpl(toInterval(x), impl);
}

/** Calculate an acceptance interval for exp2(x) */
export function exp2Interval(x: number | F32Interval): F32Interval {
  const impl = (impl_x: number): F32Interval => {
    return ulpInterval(Math.pow(2, impl_x), 3 + 2 * Math.abs(impl_x));
  };

  return runPointImpl(toInterval(x), impl);
}

/** Calculate an acceptance interval of floor(x) */
export function floorInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    return correctlyRoundedInterval(Math.floor(impl_n));
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of fract(x) */
export function fractInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    const result = subInterval(impl_n, floorInterval(impl_n));
    if (result.contains(1)) {
      // Very small negative numbers can lead to catastrophic cancellation, thus calculating a fract of 1.0, which is
      // technically not a fractional part, so some implementations clamp the result to next nearest number.
      return F32Interval.span(result, toInterval(kValue.f32.positive.below_one));
    }
    return result;
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of inverseSqrt(x) */
export function inverseSqrtInterval(n: number | F32Interval): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    if (impl_n <= 0) {
      // 1 / sqrt(n) for n <= 0 is not meaningfully defined for real f32
      return F32Interval.infinite();
    }
    return ulpInterval(1 / Math.sqrt(impl_n), 2);
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of ldexp(e1, e2) */
export function ldexpInterval(e1: number, e2: number): F32Interval {
  const impl = (impl_e1: number, impl_e2: number): F32Interval => {
    return multInterval(impl_e1, powInterval(2, impl_e2));
  };
  return roundAndFlushBinaryToInterval(e1, e2, impl);
}

/** Calculate an acceptance interval of log(x) */
export function logInterval(x: number | F32Interval): F32Interval {
  const impl = (impl_x: number): F32Interval => {
    if (impl_x >= 0.5 && impl_x <= 2.0) {
      return absoluteErrorInterval(Math.log(impl_x), 2 ** -21);
    }
    return ulpInterval(Math.log(impl_x), 3);
  };

  return runPointImpl(toInterval(x), impl);
}

/** Calculate an acceptance interval of log2(x) */
export function log2Interval(x: number | F32Interval): F32Interval {
  const impl = (impl_x: number): F32Interval => {
    if (impl_x >= 0.5 && impl_x <= 2.0) {
      return absoluteErrorInterval(Math.log2(impl_x), 2 ** -21);
    }
    return ulpInterval(Math.log2(impl_x), 3);
  };

  return runPointImpl(toInterval(x), impl);
}

/** Calculate an acceptance interval of max(x, y) */
export function maxInterval(x: number | F32Interval, y: number | F32Interval): F32Interval {
  const impl = (impl_x: number, impl_y: number): F32Interval => {
    return correctlyRoundedInterval(Math.max(impl_x, impl_y));
  };

  return runBinaryImpl(toInterval(x), toInterval(y), impl);
}

/** Calculate an acceptance interval of min(x, y) */
export function minInterval(x: number | F32Interval, y: number | F32Interval): F32Interval {
  const impl = (impl_x: number, impl_y: number): F32Interval => {
    return correctlyRoundedInterval(Math.min(impl_x, impl_y));
  };

  return runBinaryImpl(toInterval(x), toInterval(y), impl);
}

/** Calculate an acceptance interval of x * y */
export function multInterval(x: number | F32Interval, y: number | F32Interval): F32Interval {
  const inner = (inner_x: number, inner_y: number): F32Interval => {
    if (inner_x === 0 || inner_y === 0) {
      return correctlyRoundedInterval(0);
    }

    const appropriate_infinity =
      Math.sign(inner_x) === Math.sign(inner_y)
        ? Number.POSITIVE_INFINITY
        : Number.NEGATIVE_INFINITY;

    if (!isF32Finite(inner_x) && isF32Finite(inner_y)) {
      return correctlyRoundedInterval(appropriate_infinity);
    }

    if (isF32Finite(inner_x) && !isF32Finite(inner_y)) {
      return correctlyRoundedInterval(appropriate_infinity);
    }

    if (!isF32Finite(inner_x) && !isF32Finite(inner_y)) {
      return correctlyRoundedInterval(appropriate_infinity);
    }
    return correctlyRoundedInterval(inner_x * inner_y);
  };

  const impl = (impl_x: number, impl_y: number): F32Interval => {
    return roundAndFlushBinaryToInterval(impl_x, impl_y, inner);
  };

  return runBinaryImpl(toInterval(x), toInterval(y), impl);
}

/** Calculate an acceptance interval of pow(x, y) */
export function powInterval(x: number | F32Interval, y: number | F32Interval): F32Interval {
  const impl = (impl_x: number, impl_y: number): F32Interval => {
    return exp2Interval(multInterval(impl_y, log2Interval(impl_x)));
  };

  return runBinaryImpl(toInterval(x), toInterval(y), impl);
}

/** Calculate an acceptance interval of -x */
export function negInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    return correctlyRoundedInterval(-impl_n);
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of sin(x) */
export function sinInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    return impl_n <= Math.PI && impl_n >= -Math.PI
      ? absoluteErrorInterval(Math.sin(n), 2 ** -11)
      : F32Interval.infinite();
  };

  return runPointImpl(toInterval(n), impl);
}

/** Calculate an acceptance interval of x - y */
export function subInterval(x: number | F32Interval, y: number | F32Interval): F32Interval {
  const impl = (impl_x: number, impl_y: number): F32Interval => {
    return roundAndFlushBinaryToInterval(
      impl_x,
      impl_y,
      (inner_x: number, inner_y: number): F32Interval => {
        if (!isF32Finite(inner_x) && isF32Finite(inner_y)) {
          return correctlyRoundedInterval(inner_x);
        }

        if (isF32Finite(inner_x) && !isF32Finite(inner_y)) {
          const result =
            Math.sign(inner_y) > 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
          return correctlyRoundedInterval(result);
        }

        if (!isF32Finite(inner_x) && !isF32Finite(inner_y)) {
          if (Math.sign(inner_x) === -Math.sign(inner_y)) {
            return correctlyRoundedInterval(inner_x);
          } else {
            return F32Interval.infinite();
          }
        }
        return correctlyRoundedInterval(inner_x - inner_y);
      }
    );
  };

  return runBinaryImpl(toInterval(x), toInterval(y), impl);
}

/** Calculate an acceptance interval of tan(x) */
export function tanInterval(n: number): F32Interval {
  const impl = (impl_n: number): F32Interval => {
    return divInterval(sinInterval(impl_n), cosInterval(impl_n));
  };

  return runPointImpl(toInterval(n), impl);
}
