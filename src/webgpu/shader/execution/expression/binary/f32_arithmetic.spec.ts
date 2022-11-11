export const description = `
Execution Tests for the f32 arithmetic binary expression operations
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { TypeF32 } from '../../../../util/conversion.js';
import {
  additionInterval,
  divisionInterval,
  multiplicationInterval,
  remainderInterval,
  subtractionInterval,
} from '../../../../util/f32_interval.js';
import { kVectorTestValues } from '../../../../util/math.js';
import { makeCaseCache } from '../case_cache.js';
import { allInputSources, Case, makeBinaryToF32IntervalCase, run } from '../expression.js';

import { binary } from './binary.js';

export const g = makeTestGroup(GPUTest);

export const d = makeCaseCache('binary/f32_arithmetic', {
  addition: () => {
    const makeCase = (lhs: number, rhs: number): Case => {
      return makeBinaryToF32IntervalCase(lhs, rhs, additionInterval);
    };

    return kVectorTestValues[2].map(v => {
      return makeCase(v[0], v[1]);
    });
  },
  subtraction: () => {
    const makeCase = (lhs: number, rhs: number): Case => {
      return makeBinaryToF32IntervalCase(lhs, rhs, subtractionInterval);
    };

    return kVectorTestValues[2].map(v => {
      return makeCase(v[0], v[1]);
    });
  },
  multiplication: () => {
    const makeCase = (lhs: number, rhs: number): Case => {
      return makeBinaryToF32IntervalCase(lhs, rhs, multiplicationInterval);
    };

    return kVectorTestValues[2].map(v => {
      return makeCase(v[0], v[1]);
    });
  },
  division: () => {
    const makeCase = (lhs: number, rhs: number): Case => {
      return makeBinaryToF32IntervalCase(lhs, rhs, divisionInterval);
    };

    return kVectorTestValues[2].map(v => {
      return makeCase(v[0], v[1]);
    });
  },
  remainder: () => {
    const makeCase = (lhs: number, rhs: number): Case => {
      return makeBinaryToF32IntervalCase(lhs, rhs, remainderInterval);
    };

    return kVectorTestValues[2].map(v => {
      return makeCase(v[0], v[1]);
    });
  },
});

g.test('addition')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x + y
Accuracy: Correctly rounded
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('addition');
    await run(t, binary('+'), [TypeF32, TypeF32], TypeF32, t.params, cases);
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
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('subtraction');
    await run(t, binary('-'), [TypeF32, TypeF32], TypeF32, t.params, cases);
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
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('multiplication');
    await run(t, binary('*'), [TypeF32, TypeF32], TypeF32, t.params, cases);
  });

g.test('division')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x / y
Accuracy: 2.5 ULP for |y| in the range [2^-126, 2^126]
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('division');
    await run(t, binary('/'), [TypeF32, TypeF32], TypeF32, t.params, cases);
  });

g.test('remainder')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x % y
Accuracy: Derived from x - y * trunc(x/y)
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('remainder');
    await run(t, binary('%'), [TypeF32, TypeF32], TypeF32, t.params, cases);
  });
