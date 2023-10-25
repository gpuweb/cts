/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'atan2' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn atan2(e1: T ,e2: T ) -> T
Returns the arc tangent of e1 over e2. Component-wise when T is a vector.
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32, TypeF16 } from '../../../../../util/conversion.js';
import { FP } from '../../../../../util/floating_point.js';
import { linearRange, sparseF32Range, sparseF16Range } from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

const cases = ['f32', 'f16'].
flatMap((kind) =>
[true, false].map((nonConst) => ({
  [`${kind}_${nonConst ? 'non_const' : 'const'}`]: () => {
    const fp = FP[kind];
    // Using sparse range since there are N^2 cases being generated, and also including extra values
    // around 0, where there is a discontinuity that implementations may behave badly at.
    const numeric_range = [
    ...(kind === 'f32' ? sparseF32Range() : sparseF16Range()),
    ...linearRange(fp.constants().negative.max, fp.constants().positive.min, 10)];

    return fp.generateScalarPairToIntervalCases(
    numeric_range,
    numeric_range,
    nonConst ? 'unfiltered' : 'finite',
    fp.atan2Interval);

  }
}))).

reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('atan2', cases);

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`abstract float tests`).
params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

unimplemented();

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(
`
f32 tests

TODO(#792): Decide what the ground-truth is for these tests. [1]
`).

params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

fn(async (t) => {
  const cases = await d.get(`f32_${t.params.inputSource === 'const' ? 'const' : 'non_const'}`);
  await run(t, builtin('atan2'), [TypeF32, TypeF32], TypeF32, t.params, cases);
});

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`f16 tests`).
params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])).

beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('shader-f16');
}).
fn(async (t) => {
  const cases = await d.get(`f16_${t.params.inputSource === 'const' ? 'const' : 'non_const'}`);
  await run(t, builtin('atan2'), [TypeF16, TypeF16], TypeF16, t.params, cases);
});
//# sourceMappingURL=atan2.spec.js.map