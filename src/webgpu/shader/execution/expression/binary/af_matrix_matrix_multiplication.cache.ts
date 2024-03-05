import { FP } from '../../../../util/floating_point.js';
import { sparseMatrixF64Range } from '../../../../util/math.js';
import { StochasticFilter } from '../../../../util/stochastic_filter.js';
import { makeCaseCache } from '../case_cache.js';

const sf = new StochasticFilter(0);
// Cases: matKxR_matCxK
const mat_mat_cases = ([2, 3, 4] as const)
  .flatMap(k =>
    ([2, 3, 4] as const).flatMap(cols =>
      ([2, 3, 4] as const).map(rows => ({
        [`mat${k}x${rows}_mat${cols}x${k}`]: () => {
          return sf.filter(
            FP.abstract.generateMatrixPairToMatrixCases(
              sparseMatrixF64Range(k, rows),
              sparseMatrixF64Range(cols, k),
              'finite',
              FP.abstract.multiplicationMatrixMatrixInterval
            )
          );
        },
      }))
    )
  )
  .reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('binary/af_matrix_matrix_multiplication', mat_mat_cases);
