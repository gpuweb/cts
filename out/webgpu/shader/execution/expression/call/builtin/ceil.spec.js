/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'ceil' builtin function

S is AbstractFloat, f32, f16
T is S or vecN<S>
@const fn ceil(e: T ) -> T
Returns the ceiling of e. Component-wise when T is a vector.

`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32, TypeF16 } from '../../../../../util/conversion.js';
import { FP } from '../../../../../util/floating_point.js';
import { makeCaseCache } from '../../case_cache.js';
import { allInputSources, run } from '../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

const kSmallMagnitudeTestValues = [0.1, 0.9, 1.0, 1.1, 1.9, -0.1, -0.9, -1.0, -1.1, -1.9];

// See https://github.com/gpuweb/cts/issues/2766 for details
const kIssue2766Value = {
  f32: 0x8000_0000,
  f16: 0x8000
};

// Cases: [f32|f16]
const cases = ['f32', 'f16'].
map((trait) => ({
  [`${trait}`]: () => {
    return FP[trait].generateScalarToIntervalCases(
      [...kSmallMagnitudeTestValues, kIssue2766Value[trait], ...FP[trait].scalarRange()],
      'unfiltered',
      FP[trait].ceilInterval
    );
  }
})).
reduce((a, b) => ({ ...a, ...b }), {});

export const d = makeCaseCache('ceil', cases);

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
  const cases = await d.get('f32');
  await run(t, builtin('ceil'), [TypeF32], TypeF32, t.params, cases);
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
  const cases = await d.get('f16');
  await run(t, builtin('ceil'), [TypeF16], TypeF16, t.params, cases);
});
//# sourceMappingURL=ceil.spec.js.map