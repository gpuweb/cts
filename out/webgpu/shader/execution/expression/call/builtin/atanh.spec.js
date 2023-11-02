/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'atanh' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn atanh(e: T ) -> T
Returns the hyperbolic arc tangent of e. The result is 0 when abs(e) ≥ 1.
Computes the functional inverse of tanh.
Component-wise when T is a vector.
Note: The result is not mathematically meaningful when abs(e) >= 1.
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { kValue } from '../../../../../util/constants.js';
import { TypeF32, TypeF16 } from '../../../../../util/conversion.js';
import { FP } from '../../../../../util/floating_point.js';
import { biasedRange, fullF32Range, fullF16Range } from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

const f32_inputs = [
...biasedRange(kValue.f32.negative.less_than_one, -0.9, 20), // discontinuity at x = -1
-1,
...biasedRange(kValue.f32.positive.less_than_one, 0.9, 20), // discontinuity at x = 1
1,
...fullF32Range()];

const f16_inputs = [
...biasedRange(kValue.f16.negative.less_than_one, -0.9, 20), // discontinuity at x = -1
-1,
...biasedRange(kValue.f16.positive.less_than_one, 0.9, 20), // discontinuity at x = 1
1,
...fullF16Range()];


export const d = makeCaseCache('atanh', {
  f32_const: () => {
    return FP.f32.generateScalarToIntervalCases(f32_inputs, 'finite', FP.f32.atanhInterval);
  },
  f32_non_const: () => {
    return FP.f32.generateScalarToIntervalCases(f32_inputs, 'unfiltered', FP.f32.atanhInterval);
  },
  f16_const: () => {
    return FP.f16.generateScalarToIntervalCases(f16_inputs, 'finite', FP.f16.atanhInterval);
  },
  f16_non_const: () => {
    return FP.f16.generateScalarToIntervalCases(f16_inputs, 'unfiltered', FP.f16.atanhInterval);
  }
});

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`abstract float tests`).
params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])
).
unimplemented();

g.test('f32').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`f32 tests`).
params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])
).
fn(async (t) => {
  const cases = await d.get(t.params.inputSource === 'const' ? 'f32_const' : 'f32_non_const');
  await run(t, builtin('atanh'), [TypeF32], TypeF32, t.params, cases);
});

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`f16 tests`).
params((u) =>
u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4])
).
beforeAllSubcases((t) => {
  t.selectDeviceOrSkipTestCase('shader-f16');
}).
fn(async (t) => {
  const cases = await d.get(t.params.inputSource === 'const' ? 'f16_const' : 'f16_non_const');
  await run(t, builtin('atanh'), [TypeF16], TypeF16, t.params, cases);
});
//# sourceMappingURL=atanh.spec.js.map