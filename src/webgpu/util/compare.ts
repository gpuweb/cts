import { Colors } from '../../common/util/colors.js';

import { isFloatValue, Scalar, Value, Vector } from './conversion.js';
import { F32Interval } from './f32_interval.js';

/** Comparison describes the result of a Comparator function. */
export interface Comparison {
  matched: boolean; // True if the two values were considered a match
  got: string; // The string representation of the 'got' value (possibly with markup)
  expected: string; // The string representation of the 'expected' value (possibly with markup)
}

/** Comparator is a function that compares whether the provided value matches an expectation. */
export interface Comparator {
  (got: Value): Comparison;
}

/**
 * compare() compares 'got' to 'expected', returning the Comparison information.
 * @param got the value obtained from the test
 * @param expected the expected value
 * @param cmpFloats the FloatMatch used to compare floating point values
 * @returns the comparison results
 */
export function compare(got: Value, expected: Value): Comparison {
  {
    // Check types
    const gTy = got.type;
    const eTy = expected.type;
    const bothFloatTypes = isFloatValue(got) && isFloatValue(expected);
    if (gTy !== eTy && !bothFloatTypes) {
      return {
        matched: false,
        got: `${Colors.red(gTy.toString())}(${got})`,
        expected: `${Colors.red(eTy.toString())}(${expected})`,
      };
    }
  }

  if (got instanceof Scalar) {
    const g = got;
    const e = expected as Scalar;
    const isFloat = g.type.kind === 'f64' || g.type.kind === 'f32' || g.type.kind === 'f16';
    const matched =
      (isFloat && (g.value as number) === (e.value as number)) || (!isFloat && g.value === e.value);
    return {
      matched,
      got: g.toString(),
      expected: matched ? Colors.green(e.toString()) : Colors.red(e.toString()),
    };
  }
  if (got instanceof Vector) {
    const gLen = got.elements.length;
    const eLen = (expected as Vector).elements.length;
    let matched = gLen === eLen;
    const gElements = new Array<string>(gLen);
    const eElements = new Array<string>(eLen);
    for (let i = 0; i < Math.max(gLen, eLen); i++) {
      if (i < gLen && i < eLen) {
        const g = got.elements[i];
        const e = (expected as Vector).elements[i];
        const cmp = compare(g, e);
        matched = matched && cmp.matched;
        gElements[i] = cmp.got;
        eElements[i] = cmp.expected;
        continue;
      }
      matched = false;
      if (i < gLen) {
        gElements[i] = got.elements[i].toString();
      }
      if (i < eLen) {
        eElements[i] = (expected as Vector).elements[i].toString();
      }
    }
    return {
      matched,
      got: `${got.type}(${gElements.join(', ')})`,
      expected: `${expected.type}(${eElements.join(', ')})`,
    };
  }
  throw new Error(`unhandled type '${typeof got}`);
}

/** @returns a Comparator that checks whether a test value matches any of the provided options */
export function anyOf(...expectations: (Value | Comparator)[]): Comparator {
  return got => {
    const failed = new Set<string>();
    for (const e of expectations) {
      let cmp: Comparison;
      if ((e as Value).type !== undefined) {
        const v = e as Value;
        cmp = compare(got, v);
      } else {
        const c = e as Comparator;
        cmp = c(got);
      }
      if (cmp.matched) {
        return cmp;
      }
      failed.add(cmp.expected);
    }
    return { matched: false, got: got.toString(), expected: [...failed].join(' or ') };
  };
}

export function intervalComparator(i: F32Interval): Comparator {
  return got => {
    let matched: boolean = false;
    const v = got as Scalar;
    if (v !== undefined && isFloatValue(got)) {
      if (i.contains(v.value as number)) {
        matched = true;
      }
    }

    return {
      matched,
      got: got.toString(),
      expected: `within ${i}`,
    };
  };
}
