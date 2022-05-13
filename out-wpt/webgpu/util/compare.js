/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ import { Colors } from '../../common/util/colors.js';
import { f32, isFloatValue, Scalar, Vector } from './conversion.js';
import { correctlyRounded, oneULP, withinULP } from './math.js';

/** Comparison describes the result of a Comparator function. */

/**
 * @returns a FloatMatch that returns true iff the two numbers are equal to, or
 * less than the specified absolute error threshold.
 */
export function absMatch(diff) {
  return (got, expected) => {
    if (got === expected) {
      return true;
    }
    if (!Number.isFinite(got) || !Number.isFinite(expected)) {
      return false;
    }
    return Math.abs(got - expected) <= diff;
  };
}

/**
 * @returns a FloatMatch that returns true iff the two numbers are within or
 * equal to the specified ULP threshold value.
 */
export function ulpMatch(ulp) {
  return (got, expected) => {
    if (got === expected) {
      return true;
    }
    return withinULP(got, expected, ulp);
  };
}

/**
 * @returns a FloatMatch that returns true iff |expected| is a correctly round
 * to |got|.
 * |got| must be expressible as a float32.
 */
export function correctlyRoundedMatch() {
  return (got, expected) => {
    return correctlyRounded(f32(got), expected);
  };
}

/**
 * compare() compares 'got' to 'expected', returning the Comparison information.
 * @param got the value obtained from the test
 * @param expected the expected value
 * @param cmpFloats the FloatMatch used to compare floating point values
 * @returns the comparison results
 */
export function compare(got, expected, cmpFloats) {
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
    const e = expected;
    const isFloat = g.type.kind === 'f64' || g.type.kind === 'f32' || g.type.kind === 'f16';
    const matched = (isFloat && cmpFloats(g.value, e.value)) || (!isFloat && g.value === e.value);
    return {
      matched,
      got: g.toString(),
      expected: matched ? Colors.green(e.toString()) : Colors.red(e.toString()),
    };
  }
  if (got instanceof Vector) {
    const gLen = got.elements.length;
    const eLen = expected.elements.length;
    let matched = gLen === eLen;
    const gElements = new Array(gLen);
    const eElements = new Array(eLen);
    for (let i = 0; i < Math.max(gLen, eLen); i++) {
      if (i < gLen && i < eLen) {
        const g = got.elements[i];
        const e = expected.elements[i];
        const cmp = compare(g, e, cmpFloats);
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
        eElements[i] = expected.elements[i].toString();
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
export function anyOf(...expectations) {
  return (got, cmpFloats) => {
    const failed = new Set();
    for (const e of expectations) {
      let cmp;
      if (e.type !== undefined) {
        const v = e;
        cmp = compare(got, v, cmpFloats);
      } else {
        const c = e;
        cmp = c(got, cmpFloats);
      }
      if (cmp.matched) {
        return cmp;
      }
      failed.add(cmp.expected);
    }
    return { matched: false, got: got.toString(), expected: [...failed].join(' or ') };
  };
}

/** @returns a Comparator that checks whether a result is within N * ULP of a target value, where N is defined by a function
 *
 * N is n(x), where x is the input into the function under test, not the result of the function.
 * For a function f(x) = X that is being tested, the acceptance interval is defined as within X +/- n(x) * ulp(X).
 */
export function ulpComparator(x, target, n) {
  const c = n(x);
  const match = ulpMatch(c);
  return (got, _) => {
    const cmp = compare(got, target, match);
    if (cmp.matched) {
      return cmp;
    }
    const ulp = Math.max(oneULP(target.value, true), oneULP(target.value, false));

    return {
      matched: false,
      got: got.toString(),
      expected: `within ${c} * ULP (${ulp}) of ${target}`,
    };
  };
}
