/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { Colors } from '../../common/util/colors.js';import { toComparator } from '../shader/execution/expression/expression.js';
import { isFloatValue, Scalar, Vector } from './conversion.js';
import { F32Interval } from './f32_interval.js';

/** Comparison describes the result of a Comparator function. */











/**
 * compares 'got' Value  to 'expected' Value, returning the Comparison information.
 * @param got the Value obtained from the test
 * @param expected the expected Value
 * @returns the comparison results
 */
function compareValue(got, expected) {
  {
    // Check types
    const gTy = got.type;
    const eTy = expected.type;
    const bothFloatTypes = isFloatValue(got) && isFloatValue(expected);
    if (gTy !== eTy && !bothFloatTypes) {
      return {
        matched: false,
        got: `${Colors.red(gTy.toString())}(${got})`,
        expected: `${Colors.red(eTy.toString())}(${expected})` };

    }
  }

  if (got instanceof Scalar) {
    const g = got;
    const e = expected;
    const isFloat = g.type.kind === 'f64' || g.type.kind === 'f32' || g.type.kind === 'f16';
    const matched =
    isFloat && g.value === e.value || !isFloat && g.value === e.value;
    return {
      matched,
      got: g.toString(),
      expected: matched ? Colors.green(e.toString()) : Colors.red(e.toString()) };

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
        eElements[i] = expected.elements[i].toString();
      }
    }
    return {
      matched,
      got: `${got.type}(${gElements.join(', ')})`,
      expected: `${expected.type}(${eElements.join(', ')})` };

  }
  throw new Error(`unhandled type '${typeof got}`);
}

/**
 * Tests it a 'got' Value is contained in 'expected' interval, returning the Comparison information.
 * @param got the Value obtained from the test
 * @param expected the expected F32Interval
 * @returns the comparison results
 */
function compareInterval(got, expected) {
  {
    // Check type
    const gTy = got.type;
    if (!isFloatValue(got)) {
      return {
        matched: false,
        got: `${Colors.red(gTy.toString())}(${got})`,
        expected: `floating point value` };

    }
  }

  if (got instanceof Scalar) {
    const g = got.value;
    const matched = expected.contains(g);
    return {
      matched,
      got: g.toString(),
      expected: matched ? Colors.green(expected.toString()) : Colors.red(expected.toString()) };

  }

  // Vector results are currently not handled
  throw new Error(`unhandled type '${typeof got}`);
}

/**
 * compare() compares 'got' to 'expected', returning the Comparison information.
 * @param got the result obtained from the test
 * @param expected the expected result
 * @returns the comparison results
 */
export function compare(got, expected) {
  if (expected instanceof F32Interval) {
    return compareInterval(got, expected);
  }
  return compareValue(got, expected);
}

/** @returns a Comparator that checks whether a test value matches any of the provided options */
export function anyOf(...expectations) {
  return (got) => {
    const failed = new Set();
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
//# sourceMappingURL=compare.js.map