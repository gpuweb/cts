import { FP, FPVector } from '../../../../util/floating_point.js';
import { sparseScalarF64Range, sparseVectorF64Range } from '../../../../util/math.js';
import { makeCaseCache } from '../case_cache.js';

const additionVectorScalarInterval = (v: readonly number[], s: number): FPVector => {
  return FP.abstract_float.toVector(v.map(e => FP.abstract_float.additionInterval(e, s)));
};

const additionScalarVectorInterval = (s: number, v: readonly number[]): FPVector => {
  return FP.abstract_float.toVector(v.map(e => FP.abstract_float.additionInterval(s, e)));
};

const scalar_cases = {
  ['scalar']: () => {
    return FP.abstract_float.generateScalarPairToIntervalCases(
      sparseScalarF64Range(),
      sparseScalarF64Range(),
      'finite',
      FP.abstract_float.additionInterval
    );
  },
};

const vector_scalar_cases = ([2, 3, 4] as const)
  .map(dim => ({
    [`vec${dim}_scalar`]: () => {
      return FP.abstract_float.generateVectorScalarToVectorCases(
        sparseVectorF64Range(dim),
        sparseScalarF64Range(),
        'finite',
        additionVectorScalarInterval
      );
    },
  }))
  .reduce((a, b) => ({ ...a, ...b }), {});

const scalar_vector_cases = ([2, 3, 4] as const)
  .map(dim => ({
    [`scalar_vec${dim}`]: () => {
      return FP.abstract_float.generateScalarVectorToVectorCases(
        sparseScalarF64Range(),
        sparseVectorF64Range(dim),
        'finite',
        additionScalarVectorInterval
      );
    },
  }))
  .reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('binary/af_addition', {
  ...scalar_cases,
  ...vector_scalar_cases,
  ...scalar_vector_cases,
});
