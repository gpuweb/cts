export const description = `
Execution Tests for the f32 arithmetic binary expression operations
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { correctlyRoundedMatch, intervalComparator } from '../../../../util/compare.js';
import { kValue } from '../../../../util/constants.js';
import { f32, TypeF32 } from '../../../../util/conversion.js';
import { divInterval } from '../../../../util/f32_interval';
import { biasedRange, fullF32Range, linearRange, quantizeToF32 } from '../../../../util/math.js';
import { Case, Config, makeBinaryF32Case, run } from '../expression.js';

import { binary } from './binary.js';

export const g = makeTestGroup(GPUTest);

g.test('addition')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x + y
Accuracy: Correctly rounded
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cfg: Config = t.params;
    cfg.cmpFloats = correctlyRoundedMatch();

    const makeCase = (lhs: number, rhs: number): Case => {
      return makeBinaryF32Case(lhs, rhs, (l: number, r: number): number => {
        return l + r;
      });
    };

    const cases: Array<Case> = [];
    const numeric_range = fullF32Range();
    numeric_range.forEach(lhs => {
      numeric_range.forEach(rhs => {
        cases.push(makeCase(lhs, rhs));
      });
    });

    run(t, binary('+'), [TypeF32, TypeF32], TypeF32, cfg, cases);
  });

g.test('subtraction')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x - y
Accuracy: Correctly rounded
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cfg: Config = t.params;
    cfg.cmpFloats = correctlyRoundedMatch();

    const makeCase = (lhs: number, rhs: number): Case => {
      return makeBinaryF32Case(lhs, rhs, (l: number, r: number): number => {
        return l - r;
      });
    };

    const cases: Array<Case> = [];
    const numeric_range = fullF32Range();
    numeric_range.forEach(lhs => {
      numeric_range.forEach(rhs => {
        cases.push(makeCase(lhs, rhs));
      });
    });

    run(t, binary('-'), [TypeF32, TypeF32], TypeF32, cfg, cases);
  });

g.test('multiplication')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x * y
Accuracy: Correctly rounded
`
  )
  .params(u =>
    u
      .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
      .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cfg: Config = t.params;
    cfg.cmpFloats = correctlyRoundedMatch();

    const makeCase = (lhs: number, rhs: number): Case => {
      return makeBinaryF32Case(lhs, rhs, (l: number, r: number): number => {
        return l * r;
      });
    };

    const cases: Array<Case> = [];
    const numeric_range = fullF32Range();
    numeric_range.forEach(lhs => {
      numeric_range.forEach(rhs => {
        cases.push(makeCase(lhs, rhs));
      });
    });

    run(t, binary('*'), [TypeF32, TypeF32], TypeF32, cfg, cases);
  });

g.test('division')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x / y
Accuracy: 2.5 ULP for |y| in the range [2^-126, 2^126]
`
  )
  .params(
    u => u.combine('storageClass', ['uniform'] as const)
    // u
    //   .combine('storageClass', ['uniform', 'storage_r', 'storage_rw'] as const)
    //   .combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const makeCase = (lhs: number, rhs: number): Case => {
      lhs = quantizeToF32(lhs);
      rhs = quantizeToF32(rhs);
      const interval = divInterval(lhs, rhs);
      return { input: [f32(lhs), f32(rhs)], expected: intervalComparator(interval) };
    };

    const cases: Array<Case> = [];

    const range_lower = 2 ** -126;
    const range_upper = 2 ** 126;

    const lhs_numeric_range = fullF32Range();
    const rhs_numeric_range = [
      // Defined accuracy range
      ...biasedRange(-range_upper, -range_lower, 100),
      ...biasedRange(range_lower, range_upper, 100),
      // Undefined accuracy range
      ...biasedRange(kValue.f32.negative.min, -range_upper, 100),
      ...biasedRange(range_upper, kValue.f32.positive.max, 100),
      ...linearRange(-range_lower, range_lower, 100),
    ];

    lhs_numeric_range.forEach(lhs => {
      rhs_numeric_range.forEach(rhs => {
        cases.push(makeCase(lhs, rhs));
      });
    });

    run(t, binary('/'), [TypeF32, TypeF32], TypeF32, t.params, cases);
  });

// Will be implemented as part larger derived accuracy task
g.test('modulus')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x % y
Accuracy: Derived from x - y * trunc(x/y)
`
  )
  .params(u => u.combine('placeHolder1', ['placeHolder2', 'placeHolder3']))
  .unimplemented();
