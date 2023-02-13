export const description = `
Execution Tests for the matrix arithmetic binary expression operations
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { TypeF32, TypeMat } from '../../../../util/conversion.js';
import { additionMatrixPairInterval } from '../../../../util/f32_interval.js';
import { sparseMatrixF32Range } from '../../../../util/math.js';
import { makeCaseCache } from '../case_cache.js';
import { allInputSources, generateMatrixPairToMatrixCases, run } from '../expression.js';

import { binary } from './binary.js';

export const g = makeTestGroup(GPUTest);

export const d = makeCaseCache('binary/matrix_arithmetic', {
  addition_2x2_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(2, 2),
      sparseMatrixF32Range(2, 2),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_2x2_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(2, 2),
      sparseMatrixF32Range(2, 2),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
  addition_2x3_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(2, 3),
      sparseMatrixF32Range(2, 3),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_2x3_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(2, 3),
      sparseMatrixF32Range(2, 3),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
  addition_2x4_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(2, 4),
      sparseMatrixF32Range(2, 4),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_2x4_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(2, 4),
      sparseMatrixF32Range(2, 4),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
  addition_3x2_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(3, 2),
      sparseMatrixF32Range(3, 2),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_3x2_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(3, 2),
      sparseMatrixF32Range(3, 2),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
  addition_3x3_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(3, 3),
      sparseMatrixF32Range(3, 3),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_3x3_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(3, 3),
      sparseMatrixF32Range(3, 3),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
  addition_3x4_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(3, 4),
      sparseMatrixF32Range(3, 4),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_3x4_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(3, 4),
      sparseMatrixF32Range(3, 4),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
  addition_4x2_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(4, 2),
      sparseMatrixF32Range(4, 2),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_4x2_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(4, 2),
      sparseMatrixF32Range(4, 2),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
  addition_4x3_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(4, 3),
      sparseMatrixF32Range(4, 3),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_4x3_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(4, 3),
      sparseMatrixF32Range(4, 3),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
  addition_4x4_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(4, 4),
      sparseMatrixF32Range(4, 4),
      'f32-only',
      additionMatrixPairInterval
    );
  },
  addition_4x4_non_const: () => {
    return generateMatrixPairToMatrixCases(
      sparseMatrixF32Range(4, 4),
      sparseMatrixF32Range(4, 4),
      'unfiltered',
      additionMatrixPairInterval
    );
  },
});

g.test('addition')
  .specURL('https://www.w3.org/TR/WGSL/#floating-point-evaluation')
  .desc(
    `
Expression: x + y, where x and y are matrices
Accuracy: Correctly rounded
`
  )
  .params(u =>
    u
      .combine('inputSource', allInputSources)
      .combine('cols', [2, 3, 4] as const)
      .combine('rows', [2, 3, 4] as const)
  )
  .fn(async t => {
    const cols = t.params.cols;
    const rows = t.params.rows;
    const cases = await d.get(
      t.params.inputSource === 'const'
        ? `addition_${cols}x${rows}_const`
        : `addition_${cols}x${rows}_non_const`
    );
    await run(
      t,
      binary('+'),
      [TypeMat(cols, rows, TypeF32), TypeMat(cols, rows, TypeF32)],
      TypeMat(cols, rows, TypeF32),
      t.params,
      cases
    );
  });
