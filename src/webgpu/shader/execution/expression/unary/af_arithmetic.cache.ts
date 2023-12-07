import { FP } from '../../../../util/floating_point.js';
import { scalarF64Range } from '../../../../util/math.js';
import { makeCaseCache } from '../case_cache.js';

export const d = makeCaseCache('unary/af_arithmetic', {
  negation: () => {
    return FP.abstract_float.generateScalarToIntervalCases(
      scalarF64Range({ neg_norm: 250, neg_sub: 20, pos_sub: 20, pos_norm: 250 }),
      'unfiltered',
      FP.abstract_float.negationInterval
    );
  },
});
