
export const description = `
Execution Tests for the f32 arithmetic binary expression operations
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { intervalComparator} from '../../../../util/compare.js';
import { f32, TypeF32 } from '../../../../util/conversion.js';
import { biasedRange, fullF32Range, quantizeToF32 } from '../../../../util/math.js';
import { DivisionFPIntervalBuilder } from '../../../../util/fp_interval';
import { Case, run } from '../expression.js';

import { binary } from './binary.js';

export const g = makeTestGroup(GPUTest);

g.test('division')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x / y
Accuracy: 2.5 ULP for |y| in the range [2^-126, 2^126]
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const builder = new DivisionFPIntervalBuilder();
    const makeCase = (lhs: number, rhs: number): Case => {
      lhs = quantizeToF32(lhs); // HACK: need to support both rounding modes over in the IntervalBuilders
      rhs = quantizeToF32(rhs); // HACK: need to support both rounding modes over in the IntervalBuilders
      const interval = builder.singular(lhs, rhs);
      return { input: [f32(lhs), f32(rhs)], expected: intervalComparator(interval) };
    };

    const cases: Array<Case> = [];

    const lhs_numeric_range = fullF32Range();
    const rhs_numeric_range = biasedRange(2 ** -126, 2 ** 126, 200).filter(value => {
      return value !== 0.0;
    });
    lhs_numeric_range.forEach(lhs => {
      rhs_numeric_range.forEach(rhs => {
        cases.push(makeCase(lhs, rhs));
      });
    });

    run(t, binary('/'), [TypeF32, TypeF32], TypeF32, t.params, cases);
  });
