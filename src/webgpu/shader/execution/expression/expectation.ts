import { ROArrayArray } from '../../../../common/util/types.js';
import { Comparator, compare } from '../../../util/compare.js';
import { Matrix, Value, Vector, isScalar } from '../../../util/conversion.js';
import { FPInterval } from '../../../util/floating_point.js';

export type Expectation =
  | Value
  | FPInterval
  | readonly FPInterval[]
  | ROArrayArray<FPInterval>
  | Comparator;

/** @returns if this Expectation actually a Comparator */
export function isComparator(e: Expectation): e is Comparator {
  return !(
    e instanceof FPInterval ||
    isScalar(e) ||
    e instanceof Vector ||
    e instanceof Matrix ||
    e instanceof Array
  );
}

/** @returns the input if it is already a Comparator, otherwise wraps it in a 'value' comparator */
export function toComparator(input: Expectation): Comparator {
  if (isComparator(input)) {
    return input;
  }

  return { compare: got => compare(got, input as Value), kind: 'value' };
}
