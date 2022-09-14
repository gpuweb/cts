import { Colors } from '../../common/util/colors.js';
import { Expectation, toComparator } from '../shader/execution/expression/expression.js';

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
 * compares 'got' Value  to 'expected' Value, returning the Comparison information.
 * @param got the Value obtained from the test
 * @param expected the expected Value
 * @returns the comparison results
 */
function compareValue(got: Value, expected: Value): Comparison {
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

/**
 * Tests it a 'got' Value is contained in 'expected' interval, returning the Comparison information.
 * @param got the Value obtained from the test
 * @param expected the expected F32Interval
 * @returns the comparison results
 */
function compareInterval(got: Value, expected: F32Interval): Comparison {
  {
    // Check type
    const gTy = got.type;
    if (!isFloatValue(got)) {
      return {
        matched: false,
        got: `${Colors.red(gTy.toString())}(${got})`,
        expected: `floating point value`,
      };
    }
  }

  if (got instanceof Scalar) {
    const g = got.value as number;
    const matched = expected.contains(g);
    return {
      matched,
      got: g.toString(),
      expected: matched ? Colors.green(expected.toString()) : Colors.red(expected.toString()),
    };
  }

  // Vector results are currently not handled
  throw new Error(`unhandled type '${typeof got}`);
}

/**
 * Tests it a 'got' Value is contained in 'expected' vector, returning the Comparison information.
 * @param got the Value obtained from the test, is expected to be a Vector
 * @param expected the expected array of F32Intervals, one for each element of the vector
 * @returns the comparison results
 */
function compareVector(got: Value, expected: F32Interval[]): Comparison {
  // Check got type
  if (!(got instanceof Vector)) {
    return {
      matched: false,
      got: `${Colors.red((typeof got).toString())}(${got})`,
      expected: `Vector`,
    };
  }

  // Check element type
  {
    const gTy = got.type.elementType;
    if (!isFloatValue(got.elements[0])) {
      return {
        matched: false,
        got: `${Colors.red(gTy.toString())}(${got})`,
        expected: `floating point elements`,
      };
    }
  }

  if (got.elements.length !== expected.length) {
    return {
      matched: false,
      got: `Vector of ${got.elements.length} elements`,
      expected: `${expected.length} elements`,
    };
  }

  const results = got.elements.map((_, idx) => {
    const g = got.elements[idx].value as number;
    return { match: expected[idx].contains(g), index: idx };
  });

  const failures = results.filter(v => !v.match).map(v => v.index);
  if (failures.length !== 0) {
    const expected_string = expected.map((v, idx) =>
      idx in failures ? Colors.red(`[${v}]`) : Colors.green(`[${v}]`)
    );
    return {
      matched: false,
      got: `[${got.elements}]`,
      expected: `[${expected_string}]`,
    };
  }

  return {
    matched: true,
    got: `[${got.elements}]`,
    expected: `[${Colors.green(expected.toString())}]`,
  };
}

/**
 * compare() compares 'got' to 'expected', returning the Comparison information.
 * @param got the result obtained from the test
 * @param expected the expected result
 * @returns the comparison results
 */
export function compare(got: Value, expected: Value | F32Interval | F32Interval[]): Comparison {
  if (expected instanceof Array) {
    return compareVector(got, expected);
  }

  if (expected instanceof F32Interval) {
    return compareInterval(got, expected);
  }

  return compareValue(got, expected);
}

/** @returns a Comparator that checks whether a test value matches any of the provided options */
export function anyOf(...expectations: Expectation[]): Comparator {
  return got => {
    const failed = new Set<string>();
    for (const e of expectations) {
      const cmp = toComparator(e)(got);
      if (cmp.matched) {
        return cmp;
      }
      failed.add(cmp.expected);
    }
    return { matched: false, got: got.toString(), expected: [...failed].join(' or ') };
  };
}
