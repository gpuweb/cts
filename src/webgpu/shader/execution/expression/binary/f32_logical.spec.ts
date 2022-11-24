export const description = `
Execution Tests for the f32 logical binary expression operations
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { TypeBool, TypeF32 } from '../../../../util/conversion.js';
import { fullF32Range } from '../../../../util/math.js';
import { makeCaseCache } from '../case_cache.js';
import { allInputSources, generateBinaryToBooleanCases, run } from '../expression.js';

import { binary } from './binary.js';

export const g = makeTestGroup(GPUTest);

export const d = makeCaseCache('binary/f32_logical', {
  equals: () => {
    return generateBinaryToBooleanCases(
      fullF32Range(),
      fullF32Range(),
      (lhs: number, rhs: number): boolean => {
        return lhs === rhs;
      }
    );
  },
  not_equals: () => {
    return generateBinaryToBooleanCases(
      fullF32Range(),
      fullF32Range(),
      (lhs: number, rhs: number): boolean => {
        return lhs !== rhs;
      }
    );
  },
  less_than: () => {
    return generateBinaryToBooleanCases(
      fullF32Range(),
      fullF32Range(),
      (lhs: number, rhs: number): boolean => {
        return lhs < rhs;
      }
    );
  },
  less_equals: () => {
    return generateBinaryToBooleanCases(
      fullF32Range(),
      fullF32Range(),
      (lhs: number, rhs: number): boolean => {
        return lhs <= rhs;
      }
    );
  },
  greater_than: () => {
    return generateBinaryToBooleanCases(
      fullF32Range(),
      fullF32Range(),
      (lhs: number, rhs: number): boolean => {
        return lhs > rhs;
      }
    );
  },
  greater_equals: () => {
    return generateBinaryToBooleanCases(
      fullF32Range(),
      fullF32Range(),
      (lhs: number, rhs: number): boolean => {
        return lhs >= rhs;
      }
    );
  },
});

g.test('equals')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x == y
Accuracy: Correct result
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('equals');
    await run(t, binary('=='), [TypeF32, TypeF32], TypeBool, t.params, cases);
  });

g.test('not_equals')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x != y
Accuracy: Correct result
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('not_equals');
    await run(t, binary('!='), [TypeF32, TypeF32], TypeBool, t.params, cases);
  });

g.test('less_than')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x < y
Accuracy: Correct result
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('less_than');
    await run(t, binary('<'), [TypeF32, TypeF32], TypeBool, t.params, cases);
  });

g.test('less_equals')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x <= y
Accuracy: Correct result
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('less_equals');
    await run(t, binary('<='), [TypeF32, TypeF32], TypeBool, t.params, cases);
  });

g.test('greater_than')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x > y
Accuracy: Correct result
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('greater_than');
    await run(t, binary('>'), [TypeF32, TypeF32], TypeBool, t.params, cases);
  });

g.test('greater_equals')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x >= y
Accuracy: Correct result
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = await d.get('greater_equals');
    await run(t, binary('>='), [TypeF32, TypeF32], TypeBool, t.params, cases);
  });
