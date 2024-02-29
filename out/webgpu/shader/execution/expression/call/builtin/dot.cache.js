/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/import { assert } from '../../../../../../common/util/util.js';import { kValue } from '../../../../../util/constants.js';
import { FP } from '../../../../../util/floating_point.js';
import {
  calculatePermutations,
  sparseVectorI64Range,
  vectorI64Range } from
'../../../../../util/math.js';
import { generateVectorVectorToI64Cases } from '../../case.js';
import { makeCaseCache } from '../../case_cache.js';

function ai_dot(x, y) {
  assert(x.length === y.length, 'Cannot calculate dot for vectors of different lengths');
  const multiplications = x.map((_, idx) => x[idx] * y[idx]);
  if (multiplications.some(kValue.i64.isOOB)) return undefined;

  const result = multiplications.reduce((prev, curr) => prev + curr);
  if (kValue.i64.isOOB(result)) return undefined;

  // The spec does not state the ordering of summation, so all the
  // permutations are calculated and the intermediate results checked for
  // going OOB. vec2 does not need permutations, since a + b === b + a.
  // All the end results should be the same regardless of the order if the
  // intermediate additions stay inbounds.
  if (x.length !== 2) {
    let wentOOB = false;
    const permutations = calculatePermutations(multiplications);
    permutations.forEach((p) => {
      if (!wentOOB) {
        p.reduce((prev, curr) => {
          const next = prev + curr;
          if (kValue.i64.isOOB(next)) {
            wentOOB = true;
          }
          return next;
        });
      }
    });

    if (wentOOB) return undefined;
  }

  return !kValue.i64.isOOB(result) ? result : undefined;
}

// Cases: [f32|f16]_vecN_[non_]const
const float_cases = ['f32', 'f16'].
flatMap((trait) =>
[2, 3, 4].flatMap((N) =>
[true, false].map((nonConst) => ({
  [`${trait}_vec${N}_${nonConst ? 'non_const' : 'const'}`]: () => {
    // vec3 and vec4 require calculating all possible permutations, so their runtime is much
    // longer per test, so only using sparse vectors for them.
    return FP[trait].generateVectorPairToIntervalCases(
      N === 2 ? FP[trait].vectorRange(2) : FP[trait].sparseVectorRange(N),
      N === 2 ? FP[trait].vectorRange(2) : FP[trait].sparseVectorRange(N),
      nonConst ? 'unfiltered' : 'finite',
      FP[trait].dotInterval
    );
  }
}))
)
).
reduce((a, b) => ({ ...a, ...b }), {});

const cases = {
  ...float_cases,
  abstract_int_vec2: () => {
    return generateVectorVectorToI64Cases(vectorI64Range(2), vectorI64Range(2), ai_dot);
  },
  abstract_int_vec3: () => {
    return generateVectorVectorToI64Cases(sparseVectorI64Range(3), sparseVectorI64Range(3), ai_dot);
  },
  abstract_int_vec4: () => {
    return generateVectorVectorToI64Cases(sparseVectorI64Range(4), sparseVectorI64Range(4), ai_dot);
  }
};

export const d = makeCaseCache('dot', cases);
//# sourceMappingURL=dot.cache.js.map