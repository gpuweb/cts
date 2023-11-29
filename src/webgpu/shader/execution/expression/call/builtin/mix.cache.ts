import { FP } from '../../../../../util/floating_point.js';
import { makeCaseCache } from '../../case_cache.js';

// Cases: [f32|f16]_[non_]const
const scalar_cases = (['f32', 'f16'] as const)
  .flatMap(trait =>
    ([true, false] as const).map(nonConst => ({
      [`${trait}_${nonConst ? 'non_const' : 'const'}`]: () => {
        return FP[trait].generateScalarTripleToIntervalCases(
          FP[trait].sparseScalarRange(),
          FP[trait].sparseScalarRange(),
          FP[trait].sparseScalarRange(),
          nonConst ? 'unfiltered' : 'finite',
          ...FP[trait].mixIntervals
        );
      },
    }))
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

// Cases: [f32|f16]_vecN_scalar_[non_]const
const vec_scalar_cases = (['f32', 'f16'] as const)
  .flatMap(trait =>
    ([2, 3, 4] as const).flatMap(dim =>
      ([true, false] as const).map(nonConst => ({
        [`${trait}_vec${dim}_scalar_${nonConst ? 'non_const' : 'const'}`]: () => {
          return FP[trait].generateVectorPairScalarToVectorComponentWiseCase(
            FP[trait].sparseVectorRange(dim),
            FP[trait].sparseVectorRange(dim),
            FP[trait].sparseScalarRange(),
            nonConst ? 'unfiltered' : 'finite',
            ...FP[trait].mixIntervals
          );
        },
      }))
    )
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('mix', {
  ...scalar_cases,
  ...vec_scalar_cases,
});
