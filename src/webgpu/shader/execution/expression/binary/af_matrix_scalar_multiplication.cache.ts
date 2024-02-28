import { FP } from '../../../../util/floating_point.js';
import { sparseMatrixF64Range, sparseScalarF64Range } from '../../../../util/math.js';
import { makeCaseCache } from '../case_cache.js';

// Cases: matCxR_scalar
const mat_scalar_cases = ([2, 3, 4] as const)
  .flatMap(cols =>
    ([2, 3, 4] as const).map(rows => ({
      [`mat${cols}x${rows}_scalar`]: () => {
        return FP.abstract.generateMatrixScalarToMatrixCases(
          sparseMatrixF64Range(cols, rows),
          sparseScalarF64Range(),
          'finite',
          FP.abstract.multiplicationMatrixScalarInterval
        );
      },
    }))
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

// Cases: scalar_matCxR
const scalar_mat_cases = ([2, 3, 4] as const)
  .flatMap(cols =>
    ([2, 3, 4] as const).map(rows => ({
      [`scalar_mat${cols}x${rows}`]: () => {
        return FP.abstract.generateScalarMatrixToMatrixCases(
          sparseScalarF64Range(),
          sparseMatrixF64Range(cols, rows),
          'finite',
          FP.abstract.multiplicationScalarMatrixInterval
        );
      },
    }))
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('binary/af_matrix_scalar_multiplication', {
  ...mat_scalar_cases,
  ...scalar_mat_cases,
});
