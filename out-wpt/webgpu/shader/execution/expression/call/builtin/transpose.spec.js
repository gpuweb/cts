/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'transpose' builtin function

T is AbstractFloat, f32, or f16
@const transpose(e: matRxC<T> ) -> matCxR<T>
Returns the transpose of e.
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeAbstractFloat, TypeF16, TypeF32, TypeMat } from '../../../../../util/conversion.js';
import { FP } from '../../../../../util/floating_point.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, onlyConstInputSource, run } from '../../expression.js';

import { abstractBuiltin, builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

// Cases: [f32|f16|abstract]_matCxR_[non_]const
// abstract_matCxR_non_const is empty and not used
const cases = ['f32', 'f16', 'abstract'].
flatMap((trait) =>
[2, 3, 4].flatMap((cols) =>
[2, 3, 4].flatMap((rows) =>
[true, false].map((nonConst) => ({
  [`${trait}_mat${cols}x${rows}_${nonConst ? 'non_const' : 'const'}`]: () => {
    if (trait === 'abstract' && nonConst) {
      return [];
    }
    return FP[trait].generateMatrixToMatrixCases(
      FP[trait].sparseMatrixRange(cols, rows),
      nonConst ? 'unfiltered' : 'finite',
      FP[trait].transposeInterval
    );
  }
}))
)
)
).
reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('transpose', cases);

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#matrix-builtin-functions').
desc(`abstract float tests`).
params((u) =>
u.
combine('inputSource', onlyConstInputSource).
combine('cols', [2, 3, 4]).
combine('rows', [2, 3, 4])
).
fn(async (t) => {
  const cols = t.params.cols;
  const rows = t.params.rows;
  const cases = await d.get(`abstract_mat${cols}x${rows}_const`);
  await run(
    t,
    abstractBuiltin('transpose'),
    [TypeMat(cols, rows, TypeAbstractFloat)],
    TypeMat(rows, cols, TypeAbstractFloat),
    t.params,
    cases
  );
});

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#matrix-builtin-functions').
desc(`f32 tests`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('cols', [2, 3, 4]).
combine('rows', [2, 3, 4])
).
fn(async (t) => {
  const cols = t.params.cols;
  const rows = t.params.rows;
  const cases = await d.get(
    t.params.inputSource === 'const' ?
    `f32_mat${cols}x${rows}_const` :
    `f32_mat${cols}x${rows}_non_const`
  );
  await run(
    t,
    builtin('transpose'),
    [TypeMat(cols, rows, TypeF32)],
    TypeMat(rows, cols, TypeF32),
    t.params,
    cases
  );
});

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#matrix-builtin-functions').
desc(`f16 tests`).
params((u) =>
u.
combine('inputSource', allInputSources).
combine('cols', [2, 3, 4]).
combine('rows', [2, 3, 4])
).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('shader-f16');
}).
fn(async (t) => {
  const cols = t.params.cols;
  const rows = t.params.rows;
  const cases = await d.get(
    t.params.inputSource === 'const' ?
    `f16_mat${cols}x${rows}_const` :
    `f16_mat${cols}x${rows}_non_const`
  );
  await run(
    t,
    builtin('transpose'),
    [TypeMat(cols, rows, TypeF16)],
    TypeMat(rows, cols, TypeF16),
    t.params,
    cases
  );
});