import { ROArrayArray } from '../../../../../../common/util/types.js';
import { anyOf } from '../../../../../util/compare.js';
import { toVector } from '../../../../../util/conversion.js';
import { FP, FPKind, FPVector } from '../../../../../util/floating_point.js';
import { cartesianProduct } from '../../../../../util/math.js';
import { Case } from '../../case.js';
import { makeCaseCache } from '../../case_cache.js';
import { IntervalFilter } from '../../interval_filter.js';

// Using a bespoke implementation of make*Case and generate*Cases here
// since faceForwardIntervals is the only builtin with the API signature
// (vec, vec, vec) -> vec
//
// Additionally faceForward has significant complexities around it due to the
// fact that `dot` is calculated in it s operation, but the result of dot isn't
// used to calculate the builtin's result.

/**
 * @returns a Case for `faceForward`
 * @param kind what kind of floating point numbers being operated on
 * @param x the `x` param for the case
 * @param y the `y` param for the case
 * @param z the `z` param for the case
 * @param check what interval checking to apply
 * */
function makeCase(
  kind: FPKind,
  x: readonly number[],
  y: readonly number[],
  z: readonly number[],
  check: IntervalFilter
): Case | undefined {
  const fp = FP[kind];
  x = x.map(fp.quantize);
  y = y.map(fp.quantize);
  z = z.map(fp.quantize);

  const results = FP[kind].faceForwardIntervals(x, y, z);
  if (check === 'finite' && results.some(r => r === undefined)) {
    return undefined;
  }

  // Stripping the undefined results, since undefined is used to signal that an OOB
  // could occur within the calculation that isn't reflected in the result
  // intervals.
  const define_results = results.filter((r): r is FPVector => r !== undefined);

  return {
    input: [
      toVector(x, fp.scalarBuilder),
      toVector(y, fp.scalarBuilder),
      toVector(z, fp.scalarBuilder),
    ],
    expected: anyOf(...define_results),
  };
}

/**
 * @returns an array of Cases for `faceForward`
 * @param kind what kind of floating point numbers being operated on
 * @param xs array of inputs to try for the `x` param
 * @param ys array of inputs to try for the `y` param
 * @param zs array of inputs to try for the `z` param
 * @param check what interval checking to apply
 */
function generateCases(
  kind: FPKind,
  xs: ROArrayArray<number>,
  ys: ROArrayArray<number>,
  zs: ROArrayArray<number>,
  check: IntervalFilter
): Case[] {
  // Cannot use `cartesianProduct` here due to heterogeneous param types
  return cartesianProduct(xs, ys, zs)
    .map(e => makeCase(kind, e[0], e[1], e[2], check))
    .filter((c): c is Case => c !== undefined);
}

// Cases: [f32|f16]_vecN_[non_]const
const cases = (['f32', 'f16'] as const)
  .flatMap(trait =>
    ([2, 3, 4] as const).flatMap(dim =>
      ([true, false] as const).map(nonConst => ({
        [`${trait}_vec${dim}_${nonConst ? 'non_const' : 'const'}`]: () => {
          return generateCases(
            trait,
            FP[trait].sparseVectorRange(dim),
            FP[trait].sparseVectorRange(dim),
            FP[trait].sparseVectorRange(dim),
            nonConst ? 'unfiltered' : 'finite'
          );
        },
      }))
    )
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('faceForward', cases);
