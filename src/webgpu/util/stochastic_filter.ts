import { assert } from '../../common/util/util.js';

import { PRNG } from './prng.js';

/**
 * Used to remove entries from a list in a deterministic, but stochastic manner.
 * Uses the pseudo-number random number generator from prng.ts for selection.
 */
export class StochasticFilter {
  private readonly prng: PRNG;
  private ratio: number;

  /**
   * Constructor
   * @param seed init value to pass down to PRNG
   * @param ratio is a value between 0.0 and 1.0 indicating the number of
   *              entries that should be retained by the filter, 0.0 indicates
   *              none, 1.0 indicates all, defaults to 0.5.
   *              At least this many entries will be retained, but since arrays
   *              contain discrete number of entries, an extra element may need
   *              to be retained to guarantee this.
   *              For example given 5 entries and ratio 0.5, the result will
   *              have 3 elements so that 0.5 are retained.
   */
  constructor(seed: number, ratio: number = 0.5) {
    assert(ratio >= 0.0 && ratio <= 1.0, 'ratio needs to be in the range [0.0, 1.0]');
    this.prng = new PRNG(seed);
    this.ratio = ratio;
  }

  /**
   * @returns a list of filtered elements, order of the elements is preserved.
   * @param input is a list of elements to be filtered
   * @param ratio is the number of elements to retain, defaults to this.ratio.
   *              The calculation for result length uses ceil, so if the input
   *              is 10 elements long and ratio is set to 0.49, 5 elements will
   *              be retained, because 10 * 0.49 = 4.9, which ceils to 5.
   */
  public filter<T>(input: readonly T[], ratio = this.ratio): T[] {
    const target_length = Math.ceil(input.length * ratio);
    if (target_length === 0) {
      return [];
    }

    if (target_length === input.length) {
      return [...input];
    }

    return this.shuffle([...input.keys()]) // randomly shuffle list of 0 to input.length - 1 indices
      .slice(0, target_length - 1) // Take the first target_length indices
      .sort() // Get them back in order
      .map(idx => input[idx]); // Copy out the retained indice elements from input
  }

  /**
   * @returns the input, but shuffled.
   *          Implements Fisher–Yates as described in AoCP.
   */
  private shuffle<T>(input: readonly T[]): T[] {
    const result = [...input];
    let temp: T;
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.prng.random() * (i + 1));
      temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }
}
