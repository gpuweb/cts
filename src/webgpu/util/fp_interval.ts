import { assert } from '../../common/util/util.js';

import { kValue } from './constants.js';
import { flushSubnormalNumber, nextAfter, oneULP } from './math.js';

export class FPInterval {
  public readonly begin: number;
  public readonly end: number;

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

  public contains(x: number): boolean {
    return this.begin <= x && x <= this.end;
  }

  static span(...intervals: FPInterval[]): FPInterval {
    assert(intervals.length > 0, `span of an empty list of FPIntervals is not allowed`);
    const mins = new Set<number>();
    const maxs = new Set<number>();
    intervals.forEach(i => {
      mins.add(i.begin);
      maxs.add(i.end);
    });
    return new FPInterval(Math.min(...mins), Math.max(...maxs));
  }

  public toString(): string {
    return `[${this.begin}, ${this.end}]`;
  }
}

export interface FPUnaryIntervalBuilder {
  singular(x: number): FPInterval;
  range?(i: FPInterval): FPInterval;
}

export interface FPBinaryIntervalBuilder {
  singular(x: number, y: number): FPInterval;
  range?(ix: FPInterval, iy: FPInterval): FPInterval;
}

class AbsoluteFPIntervalBuilder implements FPUnaryIntervalBuilder {
  protected readonly n: number;

  public constructor(n: number) {
    this.n = Math.abs(n);
  }

  public singular(x: number): FPInterval {
    assert(!Number.isNaN(x), `absolute not defined for NaN`);
    return FPInterval.span(this.impl(x), this.impl(flushSubnormalNumber(x)));
  }

  public range(i: FPInterval): FPInterval {
    if (i.begin === i.end) {
      return this.singular(i.begin);
    }
    return FPInterval.span(this.singular(i.begin), this.singular(i.end));
  }

  private impl(x: number): FPInterval {
    return new FPInterval(x - this.n, x + this.n);
  }
}

class CorrectlyRoundedFPIntervalBuilder implements FPUnaryIntervalBuilder {
  public constructor() {}

  public singular(x: number): FPInterval {
    assert(!Number.isNaN(x), `correctlyRounded not defined for NaN`);
    return FPInterval.span(this.impl(x), this.impl(flushSubnormalNumber(x)));
  }

  public range(i: FPInterval): FPInterval {
    if (i.begin === i.end) {
      return this.singular(i.begin);
    }
    return FPInterval.span(this.singular(i.begin), this.singular(i.end));
  }

  private impl(x: number): FPInterval {
    if (x === Number.POSITIVE_INFINITY || x > kValue.f32.positive.max) {
      return new FPInterval(kValue.f32.positive.max, Number.POSITIVE_INFINITY);
    }

    if (x === Number.NEGATIVE_INFINITY || x < kValue.f32.negative.min) {
      return new FPInterval(Number.NEGATIVE_INFINITY, kValue.f32.negative.min);
    }

    const x_32 = new Float32Array([x])[0];
    const converted: number = x_32;
    if (x === converted) {
      // x is precisely expressible as a f32, so correctly rounding degrades to exactly matching
      return new FPInterval(x, x);
    }

    if (converted > x) {
      // x_32 rounded towards +inf, so is after x
      const otherside = nextAfter(x_32, false, false).value as number;
      return new FPInterval(otherside, converted);
    } else {
      // x_32 rounded towards -inf, so is before x
      const otherside = nextAfter(x_32, false, false).value as number;
      return new FPInterval(converted, otherside);
    }
  }
}

class ULPFPIntervalBuilder implements FPUnaryIntervalBuilder {
  protected readonly n: number;

  public constructor(n: number) {
    this.n = Math.abs(n);
  }

  public singular(x: number): FPInterval {
    assert(!Number.isNaN(x), `ULP not defined for NaN`);
    return FPInterval.span(this.impl(x), this.impl(flushSubnormalNumber(x)));
  }

  public range(i: FPInterval): FPInterval {
    if (i.begin === i.end) {
      return this.singular(i.begin);
    }
    return FPInterval.span(this.singular(i.begin), this.singular(i.end));
  }

  private impl(x: number): FPInterval {
    const ulp_flush = oneULP(x, true);
    const ulp_noflush = oneULP(x, false);
    const ulp = Math.max(ulp_flush, ulp_noflush);

    return new FPInterval(x - this.n * ulp, x + this.n * ulp);
  }
}

export class CosFPIntervalBuilder implements FPUnaryIntervalBuilder {
  private readonly builder;

  public constructor() {
    this.builder = new AbsoluteFPIntervalBuilder(2 ** -11);
  }

  public singular(x: number): FPInterval {
    return FPInterval.span(this.impl(x), this.impl(flushSubnormalNumber(x)));
  }

  private impl(x: number): FPInterval {
    return this.builder.singular(Math.cos(x));
  }
}

export class SinFPIntervalBuilder implements FPUnaryIntervalBuilder {
  private readonly builder;

  public constructor() {
    this.builder = new AbsoluteFPIntervalBuilder(2 ** -11);
  }

  public singular(x: number): FPInterval {
    return FPInterval.span(this.impl(x), this.impl(flushSubnormalNumber(x)));
  }

  private impl(x: number): FPInterval {
    return this.builder.singular(Math.sin(x));
  }
}

export class DivisionFPIntervalBuilder implements FPBinaryIntervalBuilder {
  private readonly builder;

  public constructor() {
    this.builder = new ULPFPIntervalBuilder(2.5);
  }

  public singular(x: number, y: number): FPInterval {
    assert(y !== 0, `division by 0 is not defined`);
    return FPInterval.span(this.impl(x, y), this.impl(flushSubnormalNumber(x), y));
  }

  public range(ix: FPInterval, iy: FPInterval): FPInterval {
    if (ix.begin === ix.end && iy.begin === iy.end) {
      return this.singular(ix.begin, iy.begin);
    }
    return FPInterval.span(
      this.singular(ix.begin, iy.begin),
      this.singular(ix.begin, iy.end),
      this.singular(ix.end, iy.begin),
      this.singular(ix.end, iy.end)
    );
  }

  private impl(x: number, y: number): FPInterval {
    return this.builder.singular(x / y);
  }
}

export class TanFPIntervalBuilder implements FPUnaryIntervalBuilder {
  private readonly cos_builder;
  private readonly sin_builder;
  private readonly divide_builder;

  public constructor() {
    this.cos_builder = new CosFPIntervalBuilder();
    this.sin_builder = new SinFPIntervalBuilder();
    this.divide_builder = new DivisionFPIntervalBuilder();
  }

  public singular(x: number): FPInterval {
    return FPInterval.span(this.impl(x), this.impl(flushSubnormalNumber(x)));
  }

  private impl(x: number): FPInterval {
    const cos_interval = this.cos_builder.singular(x);
    const sin_interval = this.sin_builder.singular(x);
    return this.divide_builder.range(sin_interval, cos_interval);
  }
}
