/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/export const description = `
Execution tests for the 'reflect' builtin function

T is vecN<AbstractFloat>, vecN<f32>, or vecN<f16>
@const fn reflect(e1: T, e2: T ) -> T
For the incident vector e1 and surface orientation e2, returns the reflection
direction e1-2*dot(e2,e1)*e2.
`;import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../../gpu_test.js';
import { TypeF32, TypeVec } from '../../../../../util/conversion.js';
import { reflectInterval } from '../../../../../util/f32_interval.js';
import { sparseVectorF32Range } from '../../../../../util/math.js';
import { makeCaseCache } from '../../case_cache.js';
import {
allInputSources,

makeVectorPairToVectorIntervalCase,
run } from
'../../expression.js';

import { builtin } from './builtin.js';

export const g = makeTestGroup(GPUTest);

export const d = makeCaseCache('reflect', {
  f32_vec2: () => {
    return sparseVectorF32Range(2).flatMap((i) =>
    sparseVectorF32Range(2).map((j) => makeCaseVecF32(i, j)));

  },
  f32_vec3: () => {
    return sparseVectorF32Range(3).flatMap((i) =>
    sparseVectorF32Range(3).map((j) => makeCaseVecF32(i, j)));

  },
  f32_vec4: () => {
    return sparseVectorF32Range(4).flatMap((i) =>
    sparseVectorF32Range(4).map((j) => makeCaseVecF32(i, j)));

  }
});

/** @returns a `reflect` Case for a pair of vectors of f32s input */
const makeCaseVecF32 = (x, y) => {
  return makeVectorPairToVectorIntervalCase(x, y, reflectInterval);
};

g.test('abstract_float').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`abstract float tests`).
params((u) => u.combine('inputSource', allInputSources).combine('vectorize', [2, 3, 4])).
unimplemented();

g.test('f32_vec2').
specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions').
desc(`f32 tests using vec2s`).
params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec2');
  await run(
  t,
  builtin('reflect'),
  [TypeVec(2, TypeF32), TypeVec(2, TypeF32)],
  TypeVec(2, TypeF32),
  t.params,
  cases);

});

g.test('f32_vec3').
specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions').
desc(`f32 tests using vec3s`).
params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec3');
  await run(
  t,
  builtin('reflect'),
  [TypeVec(3, TypeF32), TypeVec(3, TypeF32)],
  TypeVec(3, TypeF32),
  t.params,
  cases);

});

g.test('f32_vec4').
specURL('https://www.w3.org/TR/WGSL/#numeric-builtin-functions').
desc(`f32 tests using vec4s`).
params((u) => u.combine('inputSource', allInputSources)).
fn(async (t) => {
  const cases = await d.get('f32_vec4');
  await run(
  t,
  builtin('reflect'),
  [TypeVec(4, TypeF32), TypeVec(4, TypeF32)],
  TypeVec(4, TypeF32),
  t.params,
  cases);

});

g.test('f16').
specURL('https://www.w3.org/TR/WGSL/#float-builtin-functions').
desc(`f16 tests`).
params((u) => u.combine('inputSource', allInputSources).combine('vectorize', [2, 3, 4])).
unimplemented();
//# sourceMappingURL=reflect.spec.js.map